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

const previewParams=new URLSearchParams(location.hash.slice(1));
const previewId=previewParams.get('preview_id');
const resumeToken=previewParams.get('token');
if(previewId&&resumeToken){
 const status=document.getElementById('preview-status');
 const images=[document.getElementById('first'),document.getElementById('second')];
 images.forEach(image=>image.removeAttribute('src'));
 const deleteButton=document.getElementById('delete-preview');
 const retryButton=document.getElementById('retry-preview');
 let stopped=false;
 deleteButton.hidden=false;
 retryButton.hidden=true;
 deleteButton.onclick=async()=>{
  if(!confirm('سيتم حذف صورة الطفل وبيانات المعاينة نهائيًا. هل تريد المتابعة؟'))return;
  deleteButton.disabled=true;
  try{
   const response=await fetch(`/api/previews/${encodeURIComponent(previewId)}`,{method:'DELETE',headers:{'X-Preview-Token':resumeToken}});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'تعذّر حذف المعاينة.');
   try{
    const saved=JSON.parse(localStorage.getItem('alwan-preview')||'null');
    if(saved?.id===previewId)localStorage.removeItem('alwan-preview');
   }catch{}
   status.textContent='تم حذف صورة الطفل وبيانات المعاينة.';
   images.forEach(image=>image.removeAttribute('src'));
   deleteButton.hidden=true;
   retryButton.hidden=true;
   stopped=true;
  }catch(error){status.textContent=error.message||'تعذّر حذف المعاينة.';deleteButton.disabled=false}
 };
 const poll=async()=>{
  try{
   const response=await fetch(`/api/previews/${encodeURIComponent(previewId)}`,{headers:{'X-Preview-Token':resumeToken},cache:'no-store'});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'تعذّر تحميل حالة المعاينة.');
   firstHeading.textContent='معاينة كتاب '+(result.child?.name||'طفلك');
   document.querySelector('#choices').textContent=[result.child?.gender,result.child?.age?result.child.age+' سنوات':'',result.child?.interests].filter(Boolean).join(' · ');
   if(result.status==='completed'&&result.pages.length>=2){
    images.forEach((image,index)=>image.src=result.pages[index].url);
    status.textContent='صفحتا التلوين المخصصتان جاهزتان.';
    retryButton.hidden=true;
    return true;
   }
   const labels={queued:'حُفظت المعاينة وتنتظر بدء التوليد.',processing:'يجري توليد صفحتي المعاينة.',needs_review:'الصورة قيد مراجعة الإدارة قبل التوليد.',failed:'تعذّر توليد المعاينة. تواصل مع الإدارة للمساعدة.',cancelled:'أُلغيت المعاينة.'};
   status.textContent=labels[result.status]||'جارٍ التحقق من حالة المعاينة…';
   retryButton.hidden=result.status!=='failed';
   return ['failed','cancelled','needs_review'].includes(result.status);
  }catch(error){status.textContent=error.message||'تعذّر الاتصال بالخادم.';return false}
 };
 let attempts=0,delay=5000;
 const refresh=async()=>{
  if(stopped)return;
  const finished=await poll();
  attempts++;
  if(stopped)return;
  if(!finished&&attempts<120){
   setTimeout(refresh,delay);
   delay=Math.min(Math.round(delay*1.4),30000);
  }else if(!finished){
   status.textContent+=' يمكنك الرجوع لاحقًا لمتابعة الحالة.';
  }
 };
 retryButton.onclick=async()=>{
  retryButton.disabled=true;
  try{
   const response=await fetch(`/api/previews/${encodeURIComponent(previewId)}/retry`,{
    method:'POST',
    headers:{'X-Preview-Token':resumeToken}
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'تعذّرت إعادة المحاولة.');
   stopped=false;attempts=0;delay=5000;retryButton.hidden=true;
   status.textContent='أُعيدت المعاينة إلى قائمة التوليد.';
   refresh();
  }catch(error){status.textContent=error.message||'تعذّرت إعادة المحاولة.'}
  finally{retryButton.disabled=false}
 };
 refresh();
}else{
 document.getElementById('preview-status').textContent='صفحتان توضيحيتان من رسومات الكتاب.';
}
