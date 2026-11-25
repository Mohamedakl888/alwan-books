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
el('pay').textContent='ادفع الآن '+amount(order.total);
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
document.querySelector('form').onsubmit=e=>{
 e.preventDefault();
 const digits=el('mobile').value.replace(/[٠-٩]/g,d=>d.charCodeAt(0)-1632).replace(/[\s()-]/g,'');
 if(!/^\d{7,12}$/.test(digits)){el('mobile').setCustomValidity('أدخل رقم الجوال بدون مفتاح الدولة.');el('mobile').reportValidity();return}
 el('paymentStatus').textContent='بوابة الدفع غير مربوطة حاليًا. لم يُرسل الطلب أو يُخصم أي مبلغ.';
};
