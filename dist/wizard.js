const draft=JSON.parse(sessionStorage.getItem('alwan-draft')||'{}');
const kids=draft.kids||[draft];
const order=new URLSearchParams(location.search).get('stage')==='order';
const preview=document.querySelector('.preview');
const firstHeading=document.querySelector('#title');
firstHeading.textContent=order?'مراجعة بيانات الطلب':(kids[0].child?'كتاب '+kids[0].child:'معاينة الكتاب');
document.querySelector('#choices').textContent=kids.map(k=>[k.child,k.gender,k.age?k.age+' سنوات':'',k.extra||k.interests?.join('، ')].filter(Boolean).join(' · ')).join(' / ');
const pages=chooseSamplePages(kids[0].extra);
['first','second'].forEach((id,i)=>document.getElementById(id).src=pages[i]);

document.getElementById('like-trial').onclick=()=>{
 if(kids[0].child && kids[0].photoChecked===1)sessionStorage.setItem('alwan-liked-return','1');
};
