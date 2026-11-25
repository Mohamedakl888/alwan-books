import express from "express";
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

app.post("/api/trials", (req, res) => {
  const mobile = cleanText(req.body.mobile, 20);
  if (!/^\d{7,12}$/.test(mobile)) return res.status(400).json({ error: "رقم الجوال غير صحيح" });
  res.status(201).json({ id: crypto.randomUUID(), status: "trial_requested" });
});

app.post("/api/orders", (req, res) => {
  const body = req.body || {};
  const customer = body.customer || {};
  const children = Array.isArray(body.children) ? body.children : [];
  if (!cleanText(customer.fullname, 100) || !cleanText(customer.mobile, 20) || !cleanText(customer.email, 160) || children.length === 0) {
    return res.status(400).json({ error: "بيانات الطلب غير مكتملة" });
  }

  const order = {
    id: `ALW-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: "new",
    customer: {
      fullname: cleanText(customer.fullname, 100),
      gender: cleanText(customer.gender, 10),
      mobile: cleanText(customer.mobile, 20),
      email: cleanText(customer.email, 160),
      country: cleanText(customer.country, 100)
    },
    children: children.slice(0, 2).map(child => ({
      name: cleanText(child.name, 40),
      gender: cleanText(child.gender, 10),
      age: cleanText(child.age, 10),
      interests: cleanText(child.interests, 300),
      photo: typeof child.photo === "string" && /^data:image\/(?:jpeg|png);base64,/i.test(child.photo) ? child.photo : null
    })),
    package: body.package && typeof body.package === "object" ? body.package : {},
    total: Number(body.total) || 0,
    paymentStatus: "not_paid"
  };

  const orders = readOrders();
  orders.unshift(order);
  writeOrders(orders);
  res.status(201).json({ id: order.id, status: order.status });
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
  res.type("html").send(homepage.replace("</footer>", '<a class="admin-dashboard-link" href="/admin">إدارة الطلبات</a></footer>'));
});

app.use("/admin", express.static(path.join(root, "admin")));
app.get("/admin", (_req, res) => res.redirect("/admin/dashboard.html"));
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(port, () => {
  console.log(`Alwan Books running at http://localhost:${port}`);
  if (adminPassword === "change-me") console.warn("Warning: set ADMIN_PASSWORD before exposing the admin dashboard.");
});
