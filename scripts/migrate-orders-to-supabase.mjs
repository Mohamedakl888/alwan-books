import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const sourceFile = path.join(path.resolve(process.env.DATA_DIR || "data"), "orders.json");
const bucket = process.env.SUPABASE_PHOTO_BUCKET || "child-photos";
const apply = process.argv.includes("--apply");

if (!fs.existsSync(sourceFile)) {
  throw new Error(`Local orders file not found: ${sourceFile}`);
}

const orders = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
if (!Array.isArray(orders)) throw new Error("Local orders file must contain an array.");
if (!apply) {
  console.log(`Dry run: found ${orders.length} orders. Review the Supabase schema, then run with --apply.`);
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serverKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) before applying the migration.");
}

const supabase = createClient(url, serverKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
function decodePhoto(value) {
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) throw new Error("An order contains an invalid child photo data URL.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 4_194_304) throw new Error("A child photo exceeds the 4 MB storage limit.");
  return {
    buffer,
    contentType: `image/${match[1].toLowerCase()}`,
    extension: match[1].toLowerCase() === "jpeg" ? "jpg" : "png"
  };
}

async function migrateOrder(order) {
  const createdAt = order.createdAt || new Date().toISOString();
  const safeId = order.id.replace(/[^A-Za-z0-9_-]/g, "_");
  const children = [];

  for (const [index, original] of (order.children || []).entries()) {
    const child = { ...original };
    const photo = child.photo;
    delete child.photo;

    if (child.photoPath) {
      children.push(child);
      continue;
    }

    delete child.photoPath;
    if (typeof photo === "string" && photo.startsWith("data:image/")) {
      const image = decodePhoto(photo);
      const photoPath = `${safeId}/${index}-legacy.${image.extension}`;
      const { error } = await supabase.storage.from(bucket).upload(photoPath, image.buffer, {
        contentType: image.contentType,
        upsert: true
      });
      if (error) throw new Error(`Photo migration failed for order ${order.id}: ${error.message}`);
      child.photoPath = photoPath;
    } else {
      child.photo = null;
    }
    children.push(child);
  }

  const row = {
    id: order.id,
    created_at: createdAt,
    updated_at: order.updatedAt || null,
    status: order.status || "new",
    customer: order.customer,
    children,
    package: order.package,
    total: order.total,
    payment_status: order.paymentStatus || "not_paid",
    payment_provider: order.paymentProvider || null,
    payment_reference: order.paymentReference || null,
    payment_url: order.paymentUrl || null,
    email_notification: order.emailNotification || { status: "not_configured" },
    whatsapp_notification: order.whatsappNotification || { status: "not_configured" }
  };

  const { error } = await supabase.from("orders").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`Order migration failed for ${order.id}: ${error.message}`);
}

for (const order of orders) {
  if (!order || typeof order.id !== "string" || !order.customer || !Array.isArray(order.children)) {
    throw new Error("The local orders file contains an invalid order record.");
  }
  await migrateOrder(order);
}

console.log(`Migrated ${orders.length} orders. The local JSON file was left unchanged.`);
