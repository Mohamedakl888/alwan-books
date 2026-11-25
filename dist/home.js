const modal = document.createElement('dialog');
modal.innerHTML = '<button type="button">إغلاق</button><img alt=""><p></p>';
document.body.append(modal);
modal.querySelector('button').onclick = () => modal.close();
modal.onclick = e => { if(e.target===modal) modal.close(); };
document.querySelectorAll('button img').forEach(img=>{
 img.closest('button').onclick=()=>{
  const large=modal.querySelector('img');
  large.src=img.src; large.alt=img.alt;
  modal.querySelector('p').textContent=img.alt;
  modal.showModal();
 };
});
document.querySelectorAll('#examples button[aria-label^="الصفحة"]').forEach((button,i)=>{
 button.onclick=()=>document.querySelectorAll('#examples li')[i]?.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
});
const menu=document.querySelector('button[aria-label="فتح القائمة"]');
if(menu){
 const nav=document.createElement('nav');nav.className='mobile-links';nav.hidden=true;
 nav.innerHTML=document.querySelector('header nav').innerHTML;
 menu.parentElement.append(nav);
 function toggle(open){nav.hidden=!open;menu.setAttribute('aria-expanded',String(open));}
 menu.onclick=()=>toggle(nav.hidden);
 document.addEventListener('click',e=>{if(!menu.contains(e.target))toggle(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')toggle(false);});
}

const mobileCta=document.createElement('div');
mobileCta.className='alwan-mobile-cta';
mobileCta.innerHTML='<span><strong>شاهد صفحتين مجانًا</strong>قبل إتمام الدفع</span><a href="customize.html">ابدأ تجربتك</a>';
document.body.append(mobileCta);

const footer=document.createElement('footer');
footer.className='alwan-footer';
footer.innerHTML=`
  <span class="brand-logo" role="img" aria-label="ألوان"></span>
  <p>كتاب تلوين مخصص باسم طفلك وصورته واهتمامات العالم اللي يحبّه.</p>
  <nav aria-label="روابط ألوان">
    <a href="#steps">كيف يعمل؟</a>
    <a href="#examples">أمثلة من الكتاب</a>
    <a href="#hero-cta-pdf">النسخ والأسعار</a>
    <a href="#faq">الأسئلة الشائعة</a>
  </nav>
  <small>© ${new Date().getFullYear()} ألوان — هدايا تصنع ذكريات</small>`;
const main=document.querySelector('main');
main?.insertAdjacentElement('afterend',footer);
