let active=0;
function render(){
 el('heading').textContent='اختر تفاصيل كتاب '+name(active)+' ❤️';
 el('kids').replaceChildren(...children.map((_,i)=>{
  const b=document.createElement('button');b.textContent=(active===i?'✓ ':'')+name(i);
  b.setAttribute('aria-pressed',active===i);b.onclick=()=>{active=i;render()};return b;
 }));
 document.querySelector('.add').hidden=children.length>=2;
 el('saving').textContent='ووفّر '+amount(price(sizes[0])*0.2)+' على الكتاب الثاني بنفس الحجم';
 for(const b of document.querySelectorAll('[data-size],[data-fast]')){
  const selected=b.dataset.size?Number(b.dataset.size)===sizes[active]:(b.dataset.fast==='yes')===fast;
  b.classList.toggle('chosen',selected);b.setAttribute('aria-pressed',selected);
 }
 const delivery=fast?'خلال ساعتين':'خلال 24 ساعة';
 el('arrival').textContent='✓ '+(children.length===1?'كتاب '+name(0)+' يوصلك':'كتب أطفالك توصلك')+' '+delivery+' من إتمام الطلب';
 const {subtotal,discount,total}=totals();
 el('lines').replaceChildren();line(el('lines'),'الكتب الرقمية PDF × '+children.length,amount(subtotal));
 if(discount)line(el('lines'),'خصم الكتاب الثاني (20%)','− '+amount(discount));
 line(el('lines'),fast?'التجهيز السريع (للطلب كاملًا)':'التسليم العادي',fast?amount(50):'مجانًا');
 el('total').textContent=amount(total);
 sessionStorage.setItem('alwan-options',JSON.stringify({sizes,fast}));
}
for(const b of document.querySelectorAll('[data-size]'))b.onclick=()=>{sizes[active]=Number(b.dataset.size);render()};
for(const b of document.querySelectorAll('[data-fast]'))b.onclick=()=>{fast=b.dataset.fast==='yes';render()};
el('review').onclick=()=>location.href='../review/';
render();
