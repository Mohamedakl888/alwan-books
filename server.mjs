import express from "express";
import compression from "compression";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const app = express();
const port = Number(process.env.PORT || 8080);
const root = process.cwd();
const dist = path.join(root, "dist");
const adminPassword = process.env.ADMIN_PASSWORD || "change-me";
const notificationEmail = process.env.ORDER_NOTIFICATION_EMAIL || "wdmohamed762@gmail.com";
const photoRetentionMs = 7 * 24 * 60 * 60 * 1000;
const photoBucket = process.env.SUPABASE_PHOTO_BUCKET || "child-photos";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

function requireSupabase() {
  if (!supabase) {
    const error = new Error("Supabase is not configured");
    error.status = 503;
    throw error;
  }
  return supabase;
}

function databaseOrder(order) {
  return {
    id: order.id,
    created_at: order.createdAt,
    updated_at: order.updatedAt || null,
    status: order.status,
    customer: order.customer,
    children: order.children,
    package: order.package,
    total: order.total,
    payment_status: order.paymentStatus,
    payment_provider: order.paymentProvider || null,
    payment_reference: order.paymentReference || null,
    payment_url: order.paymentUrl || null,
    payment_status_token_hash: order.paymentStatusTokenHash || null,
    email_notification: order.emailNotification || { status: "pending" },
    whatsapp_notification: order.whatsappNotification || { status: "not_configured" }
  };
}

async function apiOrder(row, includeSignedPhotos = false) {
  const client = requireSupabase();
  const children = await Promise.all((row.children || []).map(async child => {
    const { photoPath, photo: ignoredPhoto, ...details } = child;
    let photo = null;
    if (photoPath) {
      photo = "[stored]";
      if (includeSignedPhotos) {
        const { data, error } = await client.storage.from(photoBucket).createSignedUrl(photoPath, 60 * 60);
        if (error) throw error;
        photo = data.signedUrl;
      }
    } else if (ignoredPhoto && !includeSignedPhotos) {
      photo = "[stored]";
    }
    return { ...details, photo };
  }));
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    customer: row.customer,
    children,
    package: row.package,
    total: row.total,
    paymentStatus: row.payment_status,
    paymentProvider: row.payment_provider,
    paymentReference: row.payment_reference,
    paymentUrl: row.payment_url,
    emailNotification: row.email_notification,
    whatsappNotification: row.whatsapp_notification
  };
}

async function findOrder(id) {
  const { data, error } = await requireSupabase().from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function removeStoredPhotos(paths) {
  if (!paths.length) return;
  const { error } = await requireSupabase().storage.from(photoBucket).remove(paths);
  if (error) throw error;
}

function decodeImageDataUrl(value) {
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 4_194_304) return null;
  return {
    buffer,
    contentType: `image/${match[1].toLowerCase()}`,
    extension: match[1].toLowerCase() === "jpeg" ? "jpg" : "png"
  };
}

async function storeOrderPhotos(order) {
  const client = requireSupabase();
  const savedPaths = [];
  try {
    for (const [index, child] of order.children.entries()) {
      if (!child.photo) continue;
      const image = decodeImageDataUrl(child.photo);
      if (!image) throw new Error("Invalid child photo data");
      const photoPath = `${order.id}/${index}-${crypto.randomUUID()}.${image.extension}`;
      const { error } = await client.storage.from(photoBucket).upload(photoPath, image.buffer, {
        contentType: image.contentType,
        upsert: false
      });
      if (error) throw error;
      savedPaths.push(photoPath);
      child.photoPath = photoPath;
      child.photo = null;
    }
    return savedPaths;
  } catch (error) {
    try {
      await removeStoredPhotos(savedPaths);
    } catch (cleanupError) {
      console.error(`Photo cleanup failed for ${order.id}:`, cleanupError.message);
    }
    throw error;
  }
}

async function removeExpiredPhotos() {
  const client = requireSupabase();
  const cutoff = new Date(Date.now() - photoRetentionMs).toISOString();
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("orders")
      .select("id, children")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data.length) return;
    for (const row of data) {
      const expiredPaths = row.children.map(child => child.photoPath).filter(Boolean);
      if (!expiredPaths.length) continue;
      await removeStoredPhotos(expiredPaths);
      const children = row.children.map(child => {
        const { photoPath, ...details } = child;
        return photoPath ? { ...details, photo: null } : child;
      });
      const { error: updateError } = await client.from("orders").update({ children }).eq("id", row.id);
      if (updateError) throw updateError;
    }
    if (data.length < pageSize) return;
  }
}

function reportApiError(res, action, error) {
  console.error(`${action} failed:`, error.message);
  const status = error.status === 503 ? 503 : 500;
  res.status(status).json({
    error: status === 503 ? "قاعدة البيانات غير مضبوطة على الخادم." : "تعذّر إكمال العملية. راجع سجل الخادم."
  });
}

if (supabase) {
  void removeExpiredPhotos().catch(error => console.error("Photo retention cleanup failed:", error.message));
  setInterval(() => {
    void removeExpiredPhotos().catch(error => console.error("Photo retention cleanup failed:", error.message));
  }, 60 * 60 * 1000).unref();
} else {
  console.warn("Order APIs require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

function cleanText(value, limit = 300) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function createSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });
}

async function sendOrderNotification(order) {
  const attemptedAt = new Date().toISOString();
  try {
    const transport = createSmtpTransport();
    if (!transport) {
      order.emailNotification = { status: "not_configured", attemptedAt };
      return;
    }

    const children = order.children.map(child =>
      `- ${child.name}، العمر ${child.age}، الاهتمامات: ${child.interests}`
    ).join("\n");
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: notificationEmail,
      subject: `طلب جديد ${order.id}`,
      text: [
        `رقم الطلب: ${order.id}`,
        `العميل: ${order.customer.fullname}`,
        `الجوال: ${order.customer.mobile}`,
        `بريد العميل: ${order.customer.email}`,
        `الدولة: ${order.customer.country}`,
        `الأطفال:\n${children}`,
        `الإجمالي: ${order.total} ج.م.`,
        `التوصيل: ${order.package.delivery}`,
        `عرض التفاصيل في لوحة الإدارة: ${process.env.APP_URL || `http://localhost:${port}`}/control`
      ].join("\n\n")
    });
    order.emailNotification = { status: "sent", attemptedAt, sentAt: new Date().toISOString() };
  } catch (error) {
    console.error(`Order email notification failed for ${order.id}:`, error.message);
    order.emailNotification = { status: "failed", attemptedAt };
  }
}

async function sendWhatsAppNotification(order, status) {
  const attemptedAt = new Date().toISOString();
  if (!order.customer.whatsappOptIn) {
    order.whatsappNotification = { status: "not_opted_in", attemptedAt };
    return;
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!accessToken || !phoneNumberId || !templateName) {
    order.whatsappNotification = { status: "not_configured", attemptedAt };
    return;
  }

  const statusText = {
    new: "تم استلام طلبك",
    preparing: "طلبك قيد التجهيز",
    ready: "طلبك جاهز",
    delivered: "تم تسليم طلبك",
    cancelled: "تم إلغاء الطلب",
    paid: "تم تأكيد الدفع"
  }[status] || "تم تحديث طلبك";
  const apiVersion = process.env.META_GRAPH_API_VERSION || "v27.0";
  try {
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: order.customer.mobile.replace(/\D/g, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "ar" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: order.id },
              { type: "text", text: statusText },
              { type: "text", text: `${order.total} جنيه مصري` }
            ]
          }]
        }
      }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Meta Graph API returned HTTP ${response.status}`);
    const result = await response.json();
    const messageId = result.messages?.[0]?.id;
    if (!messageId) throw new Error("Meta Graph API response did not contain a message ID");
    order.whatsappNotification = { status: "sent", attemptedAt, sentAt: new Date().toISOString(), messageId };
  } catch (error) {
    console.error(`WhatsApp notification failed for ${order.id}:`, error.message);
    order.whatsappNotification = { status: "failed", attemptedAt };
  }
}

function tapPhone(customer) {
  const countryCodes = {
    مصر: "20",
    السعودية: "966",
    الإمارات: "971",
    الكويت: "965",
    البحرين: "973",
    قطر: "974",
    "عُمان": "968",
    الأردن: "962"
  };
  const countryCode = countryCodes[customer.country];
  const digits = customer.mobile.replace(/\D/g, "");
  if (!countryCode || !digits.startsWith(countryCode)) return undefined;
  const number = digits.slice(countryCode.length);
  if (!/^\d{6,12}$/.test(number)) return undefined;
  return { country_code: Number(countryCode), number: Number(number) };
}

function paymentReturnUrl(orderId, token) {
  if (!process.env.APP_URL) return null;
  try {
    const base = new URL(process.env.APP_URL);
    if (base.protocol !== "https:") return null;
    const url = new URL("/payment/return", base);
    url.searchParams.set("order_id", orderId);
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return null;
  }
}

async function savePaymentFields(client, order) {
  const { error } = await client.from("orders").update({
    payment_status: order.paymentStatus,
    payment_provider: order.paymentProvider || null,
    payment_reference: order.paymentReference || null,
    payment_url: order.paymentUrl || null,
    payment_status_token_hash: order.paymentStatusTokenHash || null
  }).eq("id", order.id);
  if (error) throw error;
}

async function createTapPayment(order, client) {
  const secretKey = process.env.TAP_SECRET_KEY;
  const redirectUrl = paymentReturnUrl(order.id, order.paymentStatusToken);
  if (!secretKey || !redirectUrl) {
    return { status: "not_configured", paymentUrl: null, saved: true };
  }

  const nameParts = order.customer.fullname.split(/\s+/);
  const customer = {
    first_name: nameParts[0],
    last_name: nameParts.slice(1).join(" ") || nameParts[0],
    email: order.customer.email
  };
  const phone = tapPhone(order.customer);
  if (phone) customer.phone = phone;

  try {
    const response = await fetch("https://api.tap.company/v2/charges/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: order.total,
        currency: "EGP",
        customer_initiated: true,
        threeDSecure: true,
        save_card: false,
        description: `Alwan order ${order.id}`,
        order: { id: order.id },
        reference: {
          transaction: order.id,
          order: order.id,
          idempotent: crypto.createHash("sha256").update(order.paymentStatusToken).digest("hex")
        },
        metadata: { udf1: order.id },
        customer,
        source: { id: "src_all" },
        post: { url: new URL("/api/webhooks/tap", process.env.APP_URL).toString() },
        redirect: { url: redirectUrl }
      }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`TAP API returned HTTP ${response.status}`);
    const charge = await response.json();
    const transactionUrl = typeof charge.transaction?.url === "string" ? new URL(charge.transaction.url) : null;
    if (transactionUrl && transactionUrl.protocol !== "https:") throw new Error("TAP returned an insecure payment URL");
    if (!charge.id) throw new Error("TAP response did not contain a charge ID");

    order.paymentProvider = "tap";
    order.paymentReference = charge.id;
    order.paymentUrl = transactionUrl?.toString() || null;
    if (charge.status === "CAPTURED") order.paymentStatus = "paid";
    else if (charge.status === "INITIATED" || charge.status === "IN PROGRESS") order.paymentStatus = "pending";
    else order.paymentStatus = "failed";
    if (order.paymentStatus === "pending" && !order.paymentUrl) {
      throw new Error("TAP did not return a payment URL");
    }

    await savePaymentFields(client, order);
    return { status: order.paymentStatus, paymentUrl: order.paymentUrl, saved: true };
  } catch (error) {
    console.error(`TAP payment creation failed for ${order.id}:`, error.message);
    order.paymentProvider = "tap";
    order.paymentStatus = "failed";
    order.paymentUrl = null;
    try {
      await savePaymentFields(client, order);
    } catch (saveError) {
      console.error(`TAP payment status save failed for ${order.id}:`, saveError.message);
      return { status: "failed", paymentUrl: null, saved: false };
    }
    return { status: "failed", paymentUrl: null, saved: true };
  }
}

function verifyTapWebhook(charge, receivedHash) {
  const secretKey = process.env.TAP_SECRET_KEY;
  const amount = Number(charge.amount);
  if (!secretKey || !/^[a-f0-9]{64}$/i.test(receivedHash || "") ||
      typeof charge.id !== "string" || !charge.id || !Number.isFinite(amount) || amount <= 0 ||
      !charge.currency || !charge.status || !charge.transaction?.created) return false;
  const fields = [
    ["x_id", charge.id],
    ["x_amount", amount.toFixed(2)],
    ["x_currency", charge.currency],
    ["x_gateway_reference", charge.reference?.gateway || ""],
    ["x_payment_reference", charge.reference?.payment || ""],
    ["x_status", charge.status],
    ["x_created", charge.transaction?.created || ""]
  ];
  const source = fields.map(([key, value]) => `${key}${value}`).join("");
  const expected = crypto.createHmac("sha256", secretKey).update(source).digest();
  const received = Buffer.from(receivedHash, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function requireAdmin(req, res, next) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Basic ")) return res.status(401).set("WWW-Authenticate", 'Basic realm="Alwan Admin"').json({ error: "Authentication required" });
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  const password = separator === -1 ? "" : decoded.slice(separator + 1);
  if (password !== adminPassword) return res.status(401).set("WWW-Authenticate", 'Basic realm="Alwan Admin"').json({ error: "Invalid credentials" });
  next();
}

app.disable("x-powered-by");
app.use(express.json({ limit: "12mb" }));
app.use(compression());
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.post("/api/webhooks/tap", async (req, res) => {
  const charge = req.body;
  if (!charge || typeof charge !== "object" || !verifyTapWebhook(charge, req.get("hashstring"))) {
    return res.status(401).json({ error: "Invalid TAP signature" });
  }
  const orderId = charge.metadata?.udf1 || charge.reference?.order || charge.order?.id;
  if (typeof orderId !== "string" || !orderId) {
    return res.status(400).json({ error: "Missing order reference" });
  }

  try {
    const client = requireSupabase();
    const row = await findOrder(orderId);
    if (!row) return res.status(404).json({ error: "Order not found" });
    if (row.payment_provider !== "tap" || row.payment_reference !== charge.id ||
        charge.currency !== "EGP" || Number(charge.amount).toFixed(2) !== Number(row.total).toFixed(2)) {
      return res.status(409).json({ error: "Payment does not match the order" });
    }

    let paymentStatus = row.payment_status;
    if (row.payment_status !== "paid") {
      if (charge.status === "CAPTURED") paymentStatus = "paid";
      else if (["DECLINED", "CANCELLED", "ABANDONED", "FAILED"].includes(charge.status)) paymentStatus = "failed";
      else paymentStatus = "pending";
    }
    const { data: updated, error } = await client.from("orders")
      .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("payment_status", row.payment_status)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) return res.json({ received: true });

    if (paymentStatus === "paid" && row.payment_status !== "paid") {
      const order = await apiOrder({ ...row, payment_status: "paid" });
      await sendWhatsAppNotification(order, "paid");
      const { error: notificationError } = await client.from("orders")
        .update({ whatsapp_notification: order.whatsappNotification })
        .eq("id", orderId);
      if (notificationError) console.error(`WhatsApp payment status save failed for ${orderId}:`, notificationError.message);
    }
    res.json({ received: true });
  } catch (error) {
    reportApiError(res, "TAP webhook", error);
  }
});

app.get("/api/payments/:id/status", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).json({ error: "Payment status not found" });
  try {
    const order = await findOrder(req.params.id);
    if (!order || !order.payment_status_token_hash) {
      return res.status(404).json({ error: "Payment status not found" });
    }
    const expected = Buffer.from(order.payment_status_token_hash, "hex");
    const supplied = crypto.createHash("sha256").update(token).digest();
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      return res.status(404).json({ error: "Payment status not found" });
    }
    res.json({ id: order.id, status: order.payment_status });
  } catch (error) {
    reportApiError(res, "Payment status lookup", error);
  }
});

app.post("/api/trials", async (req, res) => {
  const mobile = cleanText(req.body.mobile, 20);
  if (!/^\d{7,12}$/.test(mobile)) return res.status(400).json({ error: "رقم الجوال غير صحيح" });
  try {
    const { data, error } = await requireSupabase()
      .from("trial_requests")
      .insert({ mobile })
      .select("id")
      .single();
    if (error) throw error;
    res.status(201).json({ id: data.id, status: "trial_requested" });
  } catch (error) {
    reportApiError(res, "Trial request creation", error);
  }
});

app.post("/api/orders", async (req, res) => {
  const body = req.body || {};
  const customer = body.customer || {};
  const children = Array.isArray(body.children) ? body.children : [];
  const options = body.package || {};
  const sizes = Array.isArray(options.sizes) ? options.sizes.map(Number) : [];
  const mobile = cleanText(customer.mobile, 20);
  const email = cleanText(customer.email, 160);
  if (
    !cleanText(customer.fullname, 100) ||
    !/^\+\d{9,16}$/.test(mobile) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    children.length < 1 ||
    children.length > 2 ||
    sizes.length !== children.length ||
    sizes.some(size => size !== 20 && size !== 32) ||
    typeof options.fast !== "boolean" ||
    children.some(child => !child || typeof child !== "object" || Array.isArray(child))
  ) {
    return res.status(400).json({ error: "بيانات الطلب غير مكتملة" });
  }

  const normalizedChildren = children.map(child => ({
    name: cleanText(child.name, 40),
    gender: cleanText(child.gender, 10),
    age: Number(child.age),
    interests: cleanText(child.interests, 300),
    photo: child.photo || null
  }));
  if (normalizedChildren.some(child =>
    !child.name ||
    !["ولد", "بنت"].includes(child.gender) ||
    !Number.isInteger(child.age) ||
    child.age < 1 ||
    child.age > 12 ||
    !child.interests ||
    (child.photo && (typeof child.photo !== "string" || child.photo.length > 5_500_000 || !decodeImageDataUrl(child.photo)))
  )) {
    return res.status(400).json({ error: "بيانات الطفل أو الصورة غير صحيحة" });
  }

  const priceFor = size => size === 32 ? 1200 : 1050;
  const subtotal = sizes.reduce((sum, size) => sum + priceFor(size), 0);
  const discount = sizes.length > 1 ? priceFor(sizes[1]) * 0.2 : 0;
  const delivery = options.fast ? 50 : 0;
  const total = subtotal - discount + delivery;
  const paymentStatusToken = crypto.randomBytes(32).toString("hex");
  const order = {
    id: `ALW-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: "new",
    customer: {
      fullname: cleanText(customer.fullname, 100),
      gender: cleanText(customer.gender, 10),
      mobile,
      email,
      country: cleanText(customer.country, 100),
      whatsappOptIn: customer.whatsappOptIn === true
    },
    children: normalizedChildren,
    package: { sizes, delivery: options.fast ? "express" : "standard", fast: options.fast },
    total,
    paymentStatus: "not_paid",
    paymentStatusToken,
    paymentStatusTokenHash: crypto.createHash("sha256").update(paymentStatusToken).digest("hex"),
    emailNotification: { status: "pending" },
    whatsappNotification: { status: "not_configured" }
  };

  let uploadedPhotoPaths = [];
  let inserted = false;
  try {
    const client = requireSupabase();
    uploadedPhotoPaths = await storeOrderPhotos(order);
    const { error } = await client.from("orders").insert(databaseOrder(order));
    if (error) throw error;
    inserted = true;

    await Promise.all([
      sendOrderNotification(order),
      sendWhatsAppNotification(order, "new")
    ]);
    let notificationSaved = true;
    const { error: notificationError } = await client.from("orders")
      .update({
        email_notification: order.emailNotification,
        whatsapp_notification: order.whatsappNotification
      })
      .eq("id", order.id);
    if (notificationError) {
      notificationSaved = false;
      console.error(`Order notification status save failed for ${order.id}:`, notificationError.message);
    }

    const payment = await createTapPayment(order, client);
    let paymentNotificationSaved = true;
    if (payment.status === "paid") {
      await sendWhatsAppNotification(order, "paid");
      const { error: paymentNotificationError } = await client.from("orders")
        .update({ whatsapp_notification: order.whatsappNotification })
        .eq("id", order.id);
      if (paymentNotificationError) {
        paymentNotificationSaved = false;
        console.error(`WhatsApp payment status save failed for ${order.id}:`, paymentNotificationError.message);
      }
    }
    res.status(201).json({
      id: order.id,
      status: order.status,
      total: order.total,
      notificationStatus: order.emailNotification.status,
      whatsappNotificationStatus: order.whatsappNotification.status,
      notificationSaved,
      paymentStatus: payment.status,
      paymentUrl: payment.paymentUrl,
      paymentSaved: payment.saved,
      paymentNotificationSaved
    });
  } catch (error) {
    if (!inserted && uploadedPhotoPaths.length) {
      try {
        await removeStoredPhotos(uploadedPhotoPaths);
      } catch (cleanupError) {
        console.error(`Photo rollback failed for ${order.id}:`, cleanupError.message);
      }
    }
    reportApiError(res, "Order creation", error);
  }
});

app.get("/api/orders", requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await requireSupabase().from("orders").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(await Promise.all(data.map(order => apiOrder(order))));
  } catch (error) {
    reportApiError(res, "Order listing", error);
  }
});

app.get("/api/orders/:id", requireAdmin, async (req, res) => {
  try {
    const order = await findOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
    res.json(await apiOrder(order, true));
  } catch (error) {
    reportApiError(res, "Order details", error);
  }
});

app.patch("/api/orders/:id/status", requireAdmin, async (req, res) => {
  const allowed = ["new", "preparing", "ready", "delivered", "cancelled"];
  const status = cleanText(req.body.status, 20);
  if (!allowed.includes(status)) return res.status(400).json({ error: "حالة الطلب غير صحيحة" });
  try {
    const client = requireSupabase();
    const existing = await findOrder(req.params.id);
    if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
    const statusChanged = existing.status !== status;
    const { data, error } = await client.from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "الطلب غير موجود" });
    const order = await apiOrder(data);
    if (statusChanged) await sendWhatsAppNotification(order, status);
    const { error: notificationError } = await client.from("orders")
      .update({ whatsapp_notification: order.whatsappNotification })
      .eq("id", order.id);
    if (notificationError) {
      console.error(`WhatsApp status save failed for ${order.id}:`, notificationError.message);
    }
    res.json({
      id: order.id,
      status,
      whatsappNotificationStatus: order.whatsappNotification.status,
      whatsappNotificationSaved: !notificationError
    });
  } catch (error) {
    reportApiError(res, "Order status update", error);
  }
});

app.post("/api/orders/:id/whatsapp-notification", requireAdmin, async (req, res) => {
  try {
    const row = await findOrder(req.params.id);
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });
    const order = await apiOrder(row);
    await sendWhatsAppNotification(order, order.status);
    const { error } = await requireSupabase().from("orders")
      .update({ whatsapp_notification: order.whatsappNotification })
      .eq("id", order.id);
    if (error) {
      console.error(`WhatsApp status save failed for ${order.id}:`, error.message);
      return res.json({ id: order.id, notificationStatus: order.whatsappNotification.status, notificationSaved: false });
    }
    res.json({ id: order.id, notificationStatus: order.whatsappNotification.status, notificationSaved: true });
  } catch (error) {
    reportApiError(res, "WhatsApp notification", error);
  }
});

app.post("/api/orders/:id/notification", requireAdmin, async (req, res) => {
  try {
    const row = await findOrder(req.params.id);
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });
    const order = await apiOrder(row);
    await sendOrderNotification(order);
    const { error } = await requireSupabase().from("orders")
      .update({ email_notification: order.emailNotification })
      .eq("id", order.id);
    if (error) {
      console.error(`Order email status save failed for ${order.id}:`, error.message);
      return res.json({ id: order.id, notificationStatus: order.emailNotification.status, notificationSaved: false });
    }
    res.json({ id: order.id, notificationStatus: order.emailNotification.status, notificationSaved: true });
  } catch (error) {
    reportApiError(res, "Order email notification", error);
  }
});

app.post("/api/orders/:id/payment", requireAdmin, async (req, res) => {
  try {
    const client = requireSupabase();
    const row = await findOrder(req.params.id);
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });
    if (row.payment_status === "paid") {
      return res.status(409).json({ error: "تم دفع هذا الطلب بالفعل" });
    }
    if (row.payment_status === "pending") {
      if (row.payment_url) return res.json({ paymentStatus: "pending", paymentUrl: row.payment_url, paymentSaved: true });
      return res.status(409).json({ error: "يوجد دفع قيد المعالجة بدون رابط؛ راجع TAP قبل إعادة المحاولة." });
    }

    const order = await apiOrder(row);
    order.paymentStatusToken = crypto.randomBytes(32).toString("hex");
    order.paymentStatusTokenHash = crypto.createHash("sha256").update(order.paymentStatusToken).digest("hex");
    const payment = await createTapPayment(order, client);
    res.json({
      paymentStatus: payment.status,
      paymentUrl: payment.paymentUrl,
      paymentSaved: payment.saved
    });
  } catch (error) {
    reportApiError(res, "TAP payment retry", error);
  }
});

app.get("/api/orders/:id/stories", requireAdmin, async (req, res) => {
  try {
    const order = await findOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
    const { data, error } = await requireSupabase().from("stories")
      .select("id, child_index, theme, content, created_at, updated_at")
      .eq("order_id", order.id)
      .order("child_index");
    if (error) throw error;
    res.json(data);
  } catch (error) {
    reportApiError(res, "Order stories lookup", error);
  }
});

app.put("/api/orders/:id/stories/:childIndex", requireAdmin, async (req, res) => {
  const childIndex = Number(req.params.childIndex);
  const theme = cleanText(req.body.theme, 20);
  const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
  if (!Number.isInteger(childIndex) || childIndex < 0 || childIndex > 1 ||
      !["adventure", "friendship", "discovery"].includes(theme) ||
      !content || content.length > 20_000) {
    return res.status(400).json({ error: "بيانات القصة غير صحيحة" });
  }

  try {
    const order = await findOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
    if (childIndex >= order.children.length) return res.status(400).json({ error: "الطفل غير موجود في هذا الطلب" });
    const { data, error } = await requireSupabase().from("stories")
      .upsert({
        order_id: order.id,
        child_index: childIndex,
        theme,
        content,
        updated_at: new Date().toISOString()
      }, { onConflict: "order_id,child_index" })
      .select("id, child_index, theme, content, created_at, updated_at")
      .single();
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    reportApiError(res, "Story save", error);
  }
});

app.get(["/", "/index.html"], (_req, res) => {
  const homepage = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  if (!homepage.includes("</footer>")) return res.status(500).send("Homepage footer was not found");
  const enhancedHomepage = homepage
    .replace("</head>", '<link rel="preload" as="image" href="assets/book-cloud-quest.webp" fetchpriority="high"></head>')
    .replace(/(<img\b[^>]*src="assets\/book-cloud-quest\.webp"[^>]*)(>)/, '$1 fetchpriority="high"$2');
  res.type("html").send(enhancedHomepage);
});

app.use("/control", express.static(path.join(root, "admin")));
app.get("/control", (_req, res) => res.redirect("/control/dashboard.html"));
app.use("/admin", (req, res) => {
  res.redirect(301, `/control${req.originalUrl.slice("/admin".length)}`);
});
app.use("/assets", express.static(path.join(dist, "assets"), { maxAge: "1d" }));
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(port, () => {
  console.log(`Alwan Books running at http://localhost:${port}`);
  if (adminPassword === "change-me") console.warn("Warning: set ADMIN_PASSWORD before exposing the admin dashboard.");
});
