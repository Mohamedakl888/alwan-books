const order=totals();
const deliveryText=fast?'توصيل سريع':'توصيل عادي';
children.forEach((child,index)=>{
 const article=document.createElement('article');
 article.className='book';
 article.innerHTML='<div class="row"><div class="heading"><i></i><div><b></b><br><small class="pill"></small></div></div><a>تعديل ‹</a></div><dl><div><dt>الجنس</dt><dd></dd></div><div><dt>العمر</dt><dd></dd></div><div><dt>الاهتمامات</dt><dd></dd></div></dl>';
 article.querySelector('i').textContent=index+1;
 article.querySelector('b').textContent=name(index);
 article.querySelector('small').textContent=child.photo?'✓ الصورة مرفقة':'الصورة غير مرفقة';
 article.querySelector('a').href='../../../customize.html#child-'+(index+1);
 const values=[child.gender,child.age?child.age+' سنوات':'',child.extra||child.interests?.join('، ')];
 article.querySelectorAll('dd').forEach((field,i)=>field.textContent=values[i]||'—');
 el('books').append(article);
 line(el('items'),'كتاب '+name(index)+' · '+sizes[index]+' صفحة',amount(price(sizes[index])));
});
if(order.discount)line(el('items'),'خصم الكتاب الثاني (20%)','− '+amount(order.discount));
line(el('items'),deliveryText,fast?amount(order.delivery):'مجانًا');
el('total').textContent=amount(order.total);
el('pay').textContent='إتمام الطلب · '+amount(order.total);
el('package').textContent=sizes.map((size,i)=>(children.length>1?name(i)+' · ':'')+size+' صفحة').join('، ')+' · نسخة رقمية · '+deliveryText;
el('eta').textContent=fast?'التسليم خلال ساعتين':'التسليم خلال 24 ساعة';
document.querySelector('.add').hidden=children.length>=2;
el('saving').textContent='ووفّر '+amount(price(sizes[0])*0.2)+' على الكتاب الثاني بنفس الحجم';
el('apply').onclick=()=>el('couponMessage').textContent=el('coupon').value.trim()?'لا توجد أكواد خصم مفعّلة حاليًا.':'أدخل كود الخصم.';
const countries=[['مصر','+20','🇪🇬'],['السعودية','+966','🇸🇦'],['الإمارات','+971','🇦🇪'],['الكويت','+965','🇰🇼'],['البحرين','+973','🇧🇭'],['قطر','+974','🇶🇦'],['عُمان','+968','🇴🇲'],['الأردن','+962','🇯🇴']];
for(const [country,code,flag] of countries){
 el('country').add(new Option(flag+' '+country,country));
 el('prefix').add(new Option(flag+' '+code,code));
}
el('mobile').oninput=()=>el('mobile').setCustomValidity('');
document.querySelector('form').onsubmit=async e=>{
 e.preventDefault();
 const digits=el('mobile').value.replace(/[٠-٩]/g,d=>d.charCodeAt(0)-1632).replace(/[\s()-]/g,'');
 if(!/^\d{7,12}$/.test(digits)){el('mobile').setCustomValidity('أدخل رقم الجوال بدون مفتاح الدولة.');el('mobile').reportValidity();return}
 const draft=JSON.parse(sessionStorage.getItem('alwan-draft')||'{}');
 const kids=draft.kids?.length?draft.kids:[draft];
 const payload={
  customer:{
   fullname:document.querySelector('[name=fullname]').value.trim(),
   gender:document.querySelector('[name=gender]:checked')?.value||'',
   mobile:'+'+el('prefix').value.replace(/\D/g,'')+digits,
   email:document.querySelector('input[type=email]').value.trim(),
   country:el('country').value,
   whatsappOptIn:el('whatsappOptIn').checked,
   aiProcessingConsent:el('aiProcessingConsent').checked
  },
  children:kids.map(k=>({
   name:k.child||'',
   gender:k.gender||'',
   age:k.age||'',
   interests:k.extra||k.interests?.join('، ')||'',
   photo:k.photo||null
  })),
  package:{sizes,delivery:fast?'express':'standard',fast},
  total:order.total
 };
 const button=el('pay');
 button.disabled=true;
 el('paymentStatus').textContent='جارٍ تسجيل الطلب…';
 try{
  const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'تعذّر تسجيل الطلب');
  const message='تم تسجيل الطلب '+result.id+' بإجمالي '+amount(result.total)+
   (result.notificationStatus==='sent'?' · تم إرسال إشعار الطلب إلى الإدارة.':' · تم حفظ الطلب ويمكن مراجعة إشعار البريد من لوحة الإدارة.')+
   (result.whatsappNotificationStatus==='sent'?' تم إرسال تحديث واتساب.':'');
  if(result.paymentStatus==='pending'&&result.paymentUrl){
   el('paymentStatus').textContent='تم حفظ الطلب. جارٍ تحويلك إلى بوابة الدفع الآمنة…';
   location.assign(result.paymentUrl);
   return;
  }
  el('paymentStatus').textContent=message+
   (result.paymentStatus==='paid'?' · تم تأكيد الدفع.':
    result.paymentStatus==='failed'?' · تعذّر إنشاء عملية الدفع؛ تواصل معنا لإكمال الدفع.':
    ' · الدفع الإلكتروني غير مفعّل؛ لم يتم خصم أي مبلغ.');
  button.textContent='تم تسجيل الطلب ✓';
 }catch(error){
  button.disabled=false;
  el('paymentStatus').textContent=error.message;
 }
};
