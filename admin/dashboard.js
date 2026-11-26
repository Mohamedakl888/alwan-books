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
const notificationNames = { sent: "تم الإرسال", failed: "فشل الإرسال", not_configured: "البريد غير مضبوط", pending: "قيد الإرسال" };
const whatsappNotificationNames = { sent: "تم الإرسال", failed: "فشل الإرسال", not_configured: "واتساب غير مضبوط", not_opted_in: "لم يوافق العميل", pending: "قيد الإرسال" };
const paymentStatusNames = { not_paid: "غير مدفوع", pending: "قيد الدفع", paid: "مدفوع", failed: "فشل الدفع", refunded: "مسترد", not_configured: "الدفع غير مضبوط" };

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
    row.innerHTML = `<td><b></b></td><td></td><td></td><td></td><td><select></select></td><td></td><td></td><td><button class="view" type="button">عرض</button></td>`;
    row.children[0].textContent = order.id;
    row.children[1].textContent = order.customer.fullname;
    row.children[2].textContent = order.children.map(child => child.name).filter(Boolean).join("، ") || "—";
    row.children[3].textContent = `${Number(order.total).toLocaleString("ar-EG")} ج.م.`;
    const notificationStatus = order.emailNotification?.status || "not_configured";
    row.children[5].textContent = notificationNames[notificationStatus] || notificationStatus;
    row.children[5].className = `notification-${notificationStatus}`;
    row.children[6].textContent = formatDate(order.createdAt);
    const select = row.querySelector("select");
    select.setAttribute("aria-label", `تغيير حالة الطلب ${order.id}`);
    Object.entries(statusNames).forEach(([value, label]) => select.add(new Option(label, value)));
    select.value = order.status;
    select.onchange = async () => {
      const previousStatus = order.status;
      select.disabled = true;
      try {
        const result = await request(`/api/orders/${encodeURIComponent(order.id)}/status`, { method: "PATCH", body: JSON.stringify({ status: select.value }) });
        order.status = select.value;
        if (result.whatsappNotificationStatus) order.whatsappNotification = { status: result.whatsappNotificationStatus };
        dashboardMessage.textContent = result.whatsappNotificationSaved === false
          ? "تم تحديث الطلب لكن تعذّر حفظ حالة إشعار واتساب."
          : `تم تحديث حالة الطلب ${order.id}.`;
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
    cell.colSpan = 8;
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
  let savedStories = [];
  try {
    full = await request(`/api/orders/${encodeURIComponent(order.id)}`);
    savedStories = await request(`/api/orders/${encodeURIComponent(order.id)}/stories`);
  } catch (error) {
    dashboardMessage.textContent = error.message === "INVALID" ? "انتهت جلسة الدخول. سجّل الدخول مجددًا." : error.message;
    return;
  }
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
  full.children.forEach((child, childIndex) => {
    const card = document.createElement("article");
    card.innerHTML = "<h3></h3><p></p><p></p>";
    card.querySelector("h3").textContent = child.name || "طفل";
    card.querySelectorAll("p")[0].textContent = `${child.gender || "—"} · ${child.age ? child.age + " سنوات" : "العمر غير محدد"}`;
    card.querySelectorAll("p")[1].textContent = `الاهتمامات: ${child.interests || "—"}`;
    const storyTools = document.querySelector("#storyTools").content.cloneNode(true);
    const theme = storyTools.querySelector(".story-theme");
    const output = storyTools.querySelector(".story-output");
    const saveButton = storyTools.querySelector(".save-story");
    const copyButton = storyTools.querySelector(".copy-story");
    const downloadButton = storyTools.querySelector(".download-story");
    const savedStory = savedStories.find(story => story.child_index === childIndex);
    if (savedStory) {
      theme.value = savedStory.theme;
      output.value = savedStory.content;
      saveButton.disabled = false;
      copyButton.disabled = false;
      downloadButton.disabled = false;
    }
    storyTools.querySelector(".generate-story").onclick = () => {
      output.value = generateStory(child, theme.value);
      saveButton.disabled = false;
      copyButton.disabled = false;
      downloadButton.disabled = false;
    };
    saveButton.onclick = async () => {
      saveButton.disabled = true;
      try {
        await request(`/api/orders/${encodeURIComponent(full.id)}/stories/${childIndex}`, {
          method: "PUT",
          body: JSON.stringify({ theme: theme.value, content: output.value })
        });
        dashboardMessage.textContent = `تم حفظ قصة ${child.name || "الطفل"}.`;
      } catch (error) {
        dashboardMessage.textContent = error.message === "INVALID" ? "انتهت جلسة الدخول. سجّل الدخول مجددًا." : error.message;
      } finally {
        saveButton.disabled = false;
      }
    };
    copyButton.onclick = async () => {
      try {
        await navigator.clipboard.writeText(output.value);
        dashboardMessage.textContent = "تم نسخ القصة.";
      } catch {
        output.focus();
        output.select();
        dashboardMessage.textContent = "تعذّر النسخ التلقائي؛ تم تحديد القصة لنسخها يدويًا.";
      }
    };
    downloadButton.onclick = () => {
      const file = new Blob([output.value], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `قصة-${child.name || "طفل"}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    };
    card.append(storyTools);
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
  packageDetails.textContent = `الحالة: ${statusNames[full.status] || "غير معروفة"} · الإجمالي: ${Number(full.total).toLocaleString("ar-EG")} ج.م. · الدفع: ${paymentStatusNames[full.paymentStatus] || full.paymentStatus}`;
  const emailStatus = document.createElement("p");
  const notificationStatus = full.emailNotification?.status || "not_configured";
  emailStatus.textContent = `إشعار البريد: ${notificationNames[notificationStatus] || notificationStatus}`;
  const whatsappStatus = document.createElement("p");
  const whatsappNotificationStatus = full.whatsappNotification?.status || "not_configured";
  whatsappStatus.textContent = `إشعار واتساب: ${whatsappNotificationNames[whatsappNotificationStatus] || whatsappNotificationStatus}`;
  const paymentElements = [];
  if (full.paymentUrl) {
    const paymentLink = document.createElement("a");
    paymentLink.href = full.paymentUrl;
    paymentLink.target = "_blank";
    paymentLink.rel = "noopener noreferrer";
    paymentLink.textContent = "فتح رابط الدفع";
    paymentElements.push(paymentLink);
  }
  if (full.paymentStatus !== "paid" && full.paymentStatus !== "pending") {
    const retryPaymentButton = document.createElement("button");
    retryPaymentButton.type = "button";
    retryPaymentButton.className = "resend-notification";
    retryPaymentButton.textContent = "إنشاء رابط دفع";
    retryPaymentButton.onclick = async () => {
      retryPaymentButton.disabled = true;
      try {
        const result = await request(`/api/orders/${encodeURIComponent(full.id)}/payment`, { method: "POST" });
        dashboardMessage.textContent = result.paymentUrl
          ? "تم إنشاء رابط الدفع."
          : `حالة الدفع: ${paymentStatusNames[result.paymentStatus] || result.paymentStatus}`;
        await showOrder(full);
        await loadOrders();
      } catch (error) {
        dashboardMessage.textContent = error.message === "INVALID" ? "انتهت جلسة الدخول. سجّل الدخول مجددًا." : error.message;
        retryPaymentButton.disabled = false;
      }
    };
    paymentElements.push(retryPaymentButton);
  }
  const resendButton = document.createElement("button");
  resendButton.type = "button";
  resendButton.className = "resend-notification";
  resendButton.textContent = "إرسال إشعار الطلب إلى البريد مجددًا";
  resendButton.onclick = async () => {
    resendButton.disabled = true;
    try {
      const result = await request(`/api/orders/${encodeURIComponent(full.id)}/notification`, { method: "POST" });
      dashboardMessage.textContent = result.notificationSaved
        ? `حالة إشعار البريد: ${notificationNames[result.notificationStatus] || result.notificationStatus}`
        : "تمت محاولة الإرسال لكن تعذّر حفظ حالته في قاعدة البيانات.";
      await showOrder(full);
      await loadOrders();
    } catch (error) {
      dashboardMessage.textContent = error.message === "INVALID" ? "انتهت جلسة الدخول. سجّل الدخول مجددًا." : error.message;
      resendButton.disabled = false;
    }
  };
  const resendWhatsappButton = document.createElement("button");
  resendWhatsappButton.type = "button";
  resendWhatsappButton.className = "resend-notification";
  resendWhatsappButton.textContent = "إرسال تحديث واتساب مجددًا";
  resendWhatsappButton.onclick = async () => {
    resendWhatsappButton.disabled = true;
    try {
      const result = await request(`/api/orders/${encodeURIComponent(full.id)}/whatsapp-notification`, { method: "POST" });
      dashboardMessage.textContent = result.notificationSaved
        ? `حالة إشعار واتساب: ${whatsappNotificationNames[result.notificationStatus] || result.notificationStatus}`
        : "تمت محاولة الإرسال لكن تعذّر حفظ حالته في قاعدة البيانات.";
      await showOrder(full);
      await loadOrders();
    } catch (error) {
      dashboardMessage.textContent = error.message === "INVALID" ? "انتهت جلسة الدخول. سجّل الدخول مجددًا." : error.message;
      resendWhatsappButton.disabled = false;
    }
  };
  document.querySelector("#orderDetails").append(heading, customer, grid, packageDetails, ...paymentElements, emailStatus, resendButton, whatsappStatus, resendWhatsappButton);
  if (!dialog.open) dialog.showModal();
}

function generateStory(child, theme) {
  const name = child.name || "بطلنا الصغير";
  const interest = (child.interests || "الأشياء الجميلة").split(/[،,؛;]/)[0].trim();
  const feminine = child.gender === "بنت";
  const hero = feminine ? "البطلة" : "البطل";
  const suffix = feminine ? "ت" : "";
  const possessive = feminine ? "ها" : "ه";
  const learned = feminine ? "سعيدة" : "سعيدًا";
  const ready = feminine ? "مستعدة" : "مستعدًا";
  const friendVerb = feminine ? "تحب" : "يحب";
  const adventureVerb = feminine ? "تحكي مغامرتها" : "يحكي مغامرته";
  const startVerb = feminine ? "تبدأ" : "يبدأ";
  const friendPossessive = feminine ? "أصدقائها" : "أصدقائه";
  const familyPossessive = feminine ? "عائلتها" : "عائلته";
  const watchVerb = feminine ? "تراقب" : "يراقب";
  const searchVerb = feminine ? "بحثت" : "بحث";
  const because = feminine ? "لأنها" : "لأنه";
  const learnVerb = feminine ? "تعلمت" : "تعلم";
  const endings = {
    adventure: `في صباحٍ مشرق، وجد${suffix} ${name} خريطةً صغيرة تقود إلى حديقة الأسرار. قرر${suffix} أن ${startVerb} الرحلة، وكان اهتمام ${name} بـ${interest} يمنح${possessive} الشجاعة في الطريق.\n\nعند الجسر، ساعد${suffix} ${name} عصفورًا تائهًا، فأرشد${possessive} العصفور إلى الطريق الصحيح. وبقلبٍ شجاع، تابع${suffix} حتى وصل${suffix} إلى شجرة الأمنيات.\n\nاكتشف${suffix} ${name} أن أجمل كنز هو اللطف ومساعدة الآخرين. وعاد${suffix} إلى البيت ${learned}، ${adventureVerb} الجميلة.`,
    friendship: `في يومٍ لطيف، قابل${suffix} ${name} ${feminine ? "صديقةً جديدة" : "صديقًا جديدًا"} ${friendVerb} ${interest} أيضًا. واقترح${suffix} أن يبتكرا لعبةً يستمتع بها الجميع.\n\nتعاون${suffix} ${name} مع ${friendPossessive}، وتقاسموا الأفكار والأدوار. وحين واجهتهم مشكلة صغيرة، استمع كل واحد إلى الآخر حتى وجدوا الحل.\n\nتعلم${suffix} ${name} أن الصداقة تكبر بالتعاون والاهتمام. وفي نهاية اليوم، عاد الجميع سعداء واتفقوا على لقاءٍ جديد.`,
    discovery: `أمسك${suffix} ${name} دفترًا صغيرًا وبدأ${suffix} ${watchVerb} العالم من حول${possessive}. وكتب${suffix} سؤالًا عن ${interest}، ثم ${searchVerb} عن الإجابة خطوةً خطوة.\n\nاكتشف${suffix} ${name} فكرةً جديدة، وشارك${suffix} بها ${familyPossessive}. جرّبوا معًا، ولاحظوا كيف تقود الأسئلة الفضولية إلى اكتشافات ممتعة.\n\nشعر${suffix} ${name} بالفخر ${because} ${learnVerb} شيئًا جديدًا. وأغلق${suffix} دفتر${possessive} ${learned}، ${ready} لاكتشافٍ آخر غدًا.`
  };
  return `${hero} ${name}\n\n${endings[theme] || endings.adventure}`;
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
