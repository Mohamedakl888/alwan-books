const login = document.querySelector("#login");
const view = document.querySelector("#ordersView");
const logout = document.querySelector("#logout");
const loginForm = document.querySelector("#loginForm");
const password = document.querySelector("#password");
const loginError = document.querySelector("#loginError");
const dashboardMessage = document.querySelector("#dashboardMessage");
const refreshButton = document.querySelector("#refreshOrders");
let credentials = "";
let orders = [];

const statusNames = { new: "جديد", preparing: "قيد التحضير", ready: "جاهز", delivered: "تم التسليم", cancelled: "ملغي" };

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  if (response.status === 401) throw new Error("INVALID");
  if (!response.ok) throw new Error((await response.json()).error || "تعذّر تنفيذ الطلب");
  return response.status === 204 ? null : response.json();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function render() {
  const term = document.querySelector("#search").value.trim().toLowerCase();
  const status = document.querySelector("#statusFilter").value;
  const filtered = orders.filter(order => {
    const matchesStatus = !status || order.status === status;
    const haystack = [order.id, order.customer.fullname, order.customer.mobile, order.customer.email].join(" ").toLowerCase();
    return matchesStatus && (!term || haystack.includes(term));
  });
  document.querySelector("#totalCount").textContent = orders.length;
  document.querySelector("#newCount").textContent = orders.filter(order => order.status === "new").length;
  document.querySelector("#readyCount").textContent = orders.filter(order => order.status === "ready").length;
  const rows = filtered.map(order => {
    const row = document.createElement("tr");
    row.innerHTML = `<td><b></b></td><td></td><td></td><td></td><td><select></select></td><td></td><td><button class="view" type="button">عرض</button></td>`;
    row.children[0].textContent = order.id;
    row.children[1].textContent = order.customer.fullname;
    row.children[2].textContent = order.children.map(child => child.name).filter(Boolean).join("، ") || "—";
    row.children[3].textContent = `${Number(order.total).toLocaleString("ar-EG")} ج.م.`;
    row.children[5].textContent = formatDate(order.createdAt);
    const select = row.querySelector("select");
    select.setAttribute("aria-label", `تغيير حالة الطلب ${order.id}`);
    Object.entries(statusNames).forEach(([value, label]) => select.add(new Option(label, value)));
    select.value = order.status;
    select.onchange = async () => {
      const previousStatus = order.status;
      select.disabled = true;
      try {
        await request(`/api/orders/${encodeURIComponent(order.id)}/status`, { method: "PATCH", body: JSON.stringify({ status: select.value }) });
        order.status = select.value;
        dashboardMessage.textContent = `تم تحديث حالة الطلب ${order.id}.`;
        render();
      } catch (error) {
        select.value = previousStatus;
        dashboardMessage.textContent = error.message === "INVALID" ? "انتهت جلسة الدخول. سجّل الدخول مجددًا." : error.message;
      } finally {
        select.disabled = false;
      }
    };
    row.querySelector(".view").setAttribute("aria-label", `عرض الطلب ${order.id}`);
    row.querySelector(".view").onclick = () => showOrder(order);
    return row;
  });
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = orders.length ? "لا توجد طلبات تطابق البحث." : "لا توجد طلبات حتى الآن.";
    row.append(cell);
    rows.push(row);
  }
  document.querySelector("#orders").replaceChildren(...rows);
}

async function loadOrders() {
  refreshButton.disabled = true;
  dashboardMessage.textContent = "جارٍ تحديث الطلبات…";
  try {
    orders = await request("/api/orders");
    render();
    dashboardMessage.textContent = `تم تحديث الطلبات · ${orders.length} طلب`;
  } catch (error) {
    dashboardMessage.textContent = error.message === "INVALID" ? "انتهت جلسة الدخول. سجّل الدخول مجددًا." : error.message;
  } finally {
    refreshButton.disabled = false;
  }
}

async function showOrder(order) {
  let full = order;
  try { full = await request(`/api/orders/${encodeURIComponent(order.id)}`); } catch (error) { dashboardMessage.textContent = error.message === "INVALID" ? "انتهت جلسة الدخول. سجّل الدخول مجددًا." : error.message; return; }
  const dialog = document.querySelector("#orderDialog");
  document.querySelector("#orderDetails").innerHTML = "";
  const heading = document.createElement("h2");
  heading.id = "orderTitle";
  heading.textContent = `الطلب ${full.id}`;
  const customer = document.createElement("div");
  const addDetail = (label, value, direction) => {
    const row = document.createElement("p");
    const title = document.createElement("b");
    title.textContent = `${label}: `;
    const content = document.createElement("span");
    content.textContent = value || "—";
    if (direction) content.dir = direction;
    row.append(title, content);
    customer.append(row);
  };
  addDetail("العميل", full.customer.fullname);
  addDetail("الجوال", full.customer.mobile, "ltr");
  addDetail("البريد", full.customer.email, "ltr");
  addDetail("الدولة", full.customer.country);
  const grid = document.createElement("div");
  grid.className = "order-grid";
  full.children.forEach(child => {
    const card = document.createElement("article");
    card.innerHTML = "<h3></h3><p></p><p></p>";
    card.querySelector("h3").textContent = child.name || "طفل";
    card.querySelectorAll("p")[0].textContent = `${child.gender || "—"} · ${child.age ? child.age + " سنوات" : "العمر غير محدد"}`;
    card.querySelectorAll("p")[1].textContent = `الاهتمامات: ${child.interests || "—"}`;
    if (child.photo) {
      const image = document.createElement("img");
      image.className = "photo";
      image.src = child.photo;
      image.alt = `صورة ${child.name || "الطفل"}`;
      card.append(image);
    }
    grid.append(card);
  });
  const packageDetails = document.createElement("p");
  packageDetails.textContent = `الحالة: ${statusNames[full.status] || "غير معروفة"} · الإجمالي: ${Number(full.total).toLocaleString("ar-EG")} ج.م. · الدفع: ${full.paymentStatus}`;
  document.querySelector("#orderDetails").append(heading, customer, grid, packageDetails);
  dialog.showModal();
}

loginForm.onsubmit = async event => {
  event.preventDefault();
  credentials = btoa(`admin:${password.value}`);
  try {
    orders = await request("/api/orders");
    login.hidden = true;
    view.hidden = false;
    logout.hidden = false;
    password.value = "";
    render();
    dashboardMessage.textContent = `تم تحميل ${orders.length} طلب`;
  } catch (error) {
    credentials = "";
    loginError.textContent = error.message === "INVALID" ? "كلمة المرور غير صحيحة." : error.message;
  }
};

document.querySelector("#search").oninput = render;
document.querySelector("#statusFilter").onchange = render;
refreshButton.onclick = loadOrders;
document.querySelector("#closeDialog").onclick = () => document.querySelector("#orderDialog").close();
logout.onclick = () => {
  credentials = "";
  orders = [];
  view.hidden = true;
  logout.hidden = true;
  login.hidden = false;
};
