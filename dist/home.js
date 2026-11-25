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
 const nav=document.createElement('nav');nav.className='mobile-links';nav.setAttribute('aria-label','القائمة الرئيسية');nav.hidden=true;
 nav.innerHTML=document.querySelector('header nav').innerHTML;
 const start=document.createElement('a');start.className='mobile-links-cta';start.href='customize.html';start.textContent='خصص كتاب طفلك';
 nav.append(start);
 menu.parentElement.append(nav);
 function toggle(open){nav.hidden=!open;menu.setAttribute('aria-expanded',String(open));}
 menu.onclick=()=>toggle(nav.hidden);
 document.addEventListener('click',e=>{if(!menu.contains(e.target))toggle(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')toggle(false);});
}

const mobileActions=document.createElement('div');
mobileActions.className='alwan-mobile-actions-bar';

const whatsapp=document.createElement('a');
whatsapp.className='whatsapp-float';
whatsapp.href='https://wa.me/966562994612?text='+encodeURIComponent('مرحبًا، أود الاستفسار عن كتاب ألوان.');
whatsapp.target='_blank';
whatsapp.rel='noopener noreferrer';
whatsapp.setAttribute('aria-label','تواصل معنا عبر واتساب');
whatsapp.title='تواصل معنا عبر واتساب';
whatsapp.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.2 11.6a8.2 8.2 0 0 1-12.1 7.2L4 20l1.2-4a8.2 8.2 0 1 1 15-4.4Z"></path><path d="M9 8.4c.2-.5.5-.5.8-.5l.8 1.8-1 1.1a8 8 0 0 0 3.7 3.7l1.1-1 1.8.8c0 .4-.1.7-.5 1-1 .9-3.1.1-5.3-2.1C8.3 11 8.1 9.4 9 8.4Z"></path></svg>';

const mobileStart=document.createElement('a');
mobileStart.className='alwan-mobile-start-float';
mobileStart.href='customize.html';
mobileStart.textContent='خصص كتاب طفلك';
mobileStart.setAttribute('aria-label','خصص كتاب طفلك');
mobileActions.append(mobileStart,whatsapp);
document.body.append(mobileActions);

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
