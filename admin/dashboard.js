const login = document.querySelector("#login");
const view = document.querySelector("#ordersView");
const logout = document.querySelector("#logout");
const loginForm = document.querySelector("#loginForm");
const password = document.querySelector("#password");
const loginError = document.querySelector("#loginError");
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
    const haystack = [order.id, order.customer.fullname, order.customer.mobile, order.customer.email].join(" ").toLower();
    return matchesStatus && (!term || haystack.includes(term));
  });
  document.querySelector("#totalCount").textContent = orders.length;
  document.querySelector("#newCount").textContent = orders.filter(order => order.status === "new").length;
  document.querySelector("#readyCount").textContent = orders.filter(order => order.status === "ready").length;
  document.querySelector("#orders").replaceChildren(...filtered.map(order => {
    const row = document.createElement("tr");
    row.innerHTML = `<td><b></b></td><td></td><td></td><td></td><td><select></select></td><td></td><td><button class="view" type="button">عرض</button></td>`;
    row.children[0].textContent = order.id;
    row.children[1].textContent = order.customer.fullname;
    row.children[2].textContent = order.children.map(child => child.name).filter(Boolean).join("، ") || "—";
    row.children[3].textContent = `${Number(order.total).toLocaleString("ar-EG")} ج.م.`;
    row.children[5].textContent = formatDate(order.createdAt);
    const select = row.querySelector("select");
    Object.entries(statusNames).forEach(([value, label]) => select.add(new Option(label, value)));
    select.value = order.status;
    select.onchange = async () => {
      try {
        await request(`/api/orders/${encodeURIComponent(order.id)}/status`, { method: "PATCH", body: JSON.stringify({ status: select.value }) });
        order.status = select.value;
        render();
      } catch (error) {
        alert(error.message === "INVALID" ? "انتهت جلسة الدخول" : error.message);
      }
    };
    row.querySelector(".view").onclick = () => showOrder(order);
    return row;
  }));
}

async function showOrder(order) {
  let full = order;
  try { full = await request(`/api/orders/${encodeURIComponent(order.id)}`); } catch (error) { alert(error.message); return; }
  const dialog = document.querySelector("#orderDialog");
  document.querySelector("#orderDetails").innerHTML = "";
  const heading = document.createElement("h2");
  heading.textContent = `الطلب ${full.id}`;
  const customer = document.createElement("p");
  customer.innerHTML = `<b>العميل:</b> ${full.customer.fullname}<br><b>الجوال:</b> <span dir="ltr">${full.customer.mobile}</span><br><b>البريد:</b> ${full.customer.email}<br><b>الدولة:</b> ${full.customer.country}`;
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
  packageDetails.innerHTML = `<b>الحالة:</b> ${statusNames[full.status]}<br><b>الإجمالي:</b> ${Number(full.total).toLocaleString("ar-EG")} ج.م.<br><b>الدفع:</b> ${full.paymentStatus}`;
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
  } catch (error) {
    credentials = "";
    loginError.textContent = error.message === "INVALID" ? "كلمة المرور غير صحيحة." : error.message;
  }
};

document.querySelector("#search").oninput = render;
document.querySelector("#statusFilter").onchange = render;
document.querySelector("#closeDialog").onclick = () => document.querySelector("#orderDialog").close();
logout.onclick = () => {
  credentials = "";
  orders = [];
  view.hidden = true;
  logout.hidden = true;
  login.hidden = false;
};
