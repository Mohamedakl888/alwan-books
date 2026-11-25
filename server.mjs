import express from "express";
import compression from "compression";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const app = express();
const port = Number(process.env.PORT || 8080);
const root = process.cwd();
const dist = path.join(root, "dist");
const dataDir = path.join(root, "data");
const ordersFile = path.join(dataDir, "orders.json");
const adminPassword = process.env.ADMIN_PASSWORD || "change-me";
const photoRetentionMs = 7 * 24 * 60 * 60 * 1000;

fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, "[]\n");

function readOrders() {
  return JSON.parse(fs.readFileSync(ordersFile, "utf8"));
}

function writeOrders(orders) {
  const temporary = `${ordersFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(orders, null, 2));
  fs.renameSync(temporary, ordersFile);
}

function removeExpiredPhotos() {
  const orders = readOrders();
  const cutoff = Date.now() - photoRetentionMs;
  let changed = false;
  for (const order of orders) {
    if (Date.parse(order.createdAt) > cutoff) continue;
    for (const child of order.children || []) {
      if (child.photo) {
        child.photo = null;
        changed = true;
      }
    }
  }
  if (changed) writeOrders(orders);
}

removeExpiredPhotos();
setInterval(removeExpiredPhotos, 60 * 1000).unref();

function cleanText(value, limit = 300) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
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

app.post("/api/trials", (req, res) => {
  const mobile = cleanText(req.body.mobile, 20);
  if (!/^\d{7,12}$/.test(mobile)) return res.status(400).json({ error: "رقم الجوال غير صحيح" });
  res.status(201).json({ id: crypto.randomUUID(), status: "trial_requested" });
});

app.post("/api/orders", (req, res) => {
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
    (child.photo && (typeof child.photo !== "string" || child.photo.length > 5_500_000 || !/^data:image\/(?:jpeg|png);base64,/i.test(child.photo)))
  )) {
    return res.status(400).json({ error: "بيانات الطفل أو الصورة غير صحيحة" });
  }

  const priceFor = size => size === 32 ? 1200 : 1050;
  const subtotal = sizes.reduce((sum, size) => sum + priceFor(size), 0);
  const discount = sizes.length > 1 ? priceFor(sizes[1]) * 0.2 : 0;
  const delivery = options.fast ? 50 : 0;
  const total = subtotal - discount + delivery;
  const order = {
    id: `ALW-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: "new",
    customer: {
      fullname: cleanText(customer.fullname, 100),
      gender: cleanText(customer.gender, 10),
      mobile,
      email,
      country: cleanText(customer.country, 100)
    },
    children: normalizedChildren,
    package: { sizes, delivery: options.fast ? "express" : "standard", fast: options.fast },
    total,
    paymentStatus: "not_paid"
  };

  const orders = readOrders();
  orders.unshift(order);
  writeOrders(orders);
  res.status(201).json({ id: order.id, status: order.status, total: order.total });
});

app.get("/api/orders", requireAdmin, (_req, res) => {
  res.json(readOrders().map(order => ({ ...order, children: order.children.map(child => ({ ...child, photo: child.photo ? "[stored]" : null })) })));
});

app.get("/api/orders/:id", requireAdmin, (req, res) => {
  const order = readOrders().find(item => item.id === req.params.id);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  res.json(order);
});

app.patch("/api/orders/:id/status", requireAdmin, (req, res) => {
  const allowed = ["new", "preparing", "ready", "delivered", "cancelled"];
  const status = cleanText(req.body.status, 20);
  if (!allowed.includes(status)) return res.status(400).json({ error: "حالة الطلب غير صحيحة" });
  const orders = readOrders();
  const order = orders.find(item => item.id === req.params.id);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  order.status = status;
  order.updatedAt = new Date().toISOString();
  writeOrders(orders);
  res.json({ id: order.id, status: order.status });
});

app.get(["/", "/index.html"], (_req, res) => {
  const homepage = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  if (!homepage.includes("</footer>")) return res.status(500).send("Homepage footer was not found");
  const enhancedHomepage = homepage
    .replace("</head>", '<link rel="preload" as="image" href="assets/book-cloud-quest.webp" fetchpriority="high"></head>')
    .replace(/(<img\b[^>]*src="assets\/book-cloud-quest\.webp"[^>]*)(>)/, '$1 fetchpriority="high"$2')
    .replace("</footer>", '<a class="admin-dashboard-link" href="/admin">إدارة الطلبات</a></footer>');
  res.type("html").send(enhancedHomepage);
});

app.use("/admin", express.static(path.join(root, "admin")));
app.get("/admin", (_req, res) => res.redirect("/admin/dashboard.html"));
app.use("/assets", express.static(path.join(dist, "assets"), { maxAge: "1d" }));
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(port, () => {
  console.log(`Alwan Books running at http://localhost:${port}`);
  if (adminPassword === "change-me") console.warn("Warning: set ADMIN_PASSWORD before exposing the admin dashboard.");
});
