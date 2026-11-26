const form=document.querySelector('form');
const host=document.querySelector('#children');
const labels=['الاسم','ولد أو بنت؟','العمر','الصورة','الاهتمامات'];
const suggestions=['يحب رحلات المنطاد والجزر العائمة','يحب القطارات ويتخيل نفسه قائد الرحلة','يحب الاختراعات وصنع الطائرات','يحب الطائرات الورقية الملونة','يحب اكتشاف الأحافير والديناصورات','يحب تركيب روبوتات تساعد أصدقاءه','يحب تحضير الحلويات في مخبزه الصغير','يتخيل نفسه يبحر ويبحث عن كنز الألوان','يحب مسرح الدمى وتأليف الحكايات','يحب مراقبة النجوم من المرصد','يحب زراعة الزهور والعناية بالحدائق'];
let previous={};
try{previous=JSON.parse(sessionStorage.getItem('alwan-draft')||'{}')}catch{}
const kids=previous.kids?.slice(0,2)||[{child:previous.child||'',extra:previous.extra||previous.interests?.join('، ')||''}];
const interest=new URLSearchParams(location.search).get('interest');
if(interest && !kids[0].extra?.includes(interest))kids[0].extra=[kids[0].extra,interest].filter(Boolean).join('، ').slice(0,300);
const checklist=k=>[k.child?.trim(),k.gender,k.age,k.photo && k.photoChecked===1,k.extra?.trim()];
function save(){
 const k=kids[0];
 const interests=['السيارات','كرة القدم','الفضاء','الرسم والفن'].filter(x=>k.extra?.includes(x));
 try{sessionStorage.setItem('alwan-draft',JSON.stringify({kids,child:k.child||'',extra:k.extra||'',interests}));return true}
 catch{document.querySelector('#error').textContent='تعذّر حفظ البيانات على هذا الجهاز.';return false}
}
function update(){
 const k=kids[0],name=k.child?.trim()||'طفلك';
 document.querySelector('#pitch').textContent='أكمل بيانات '+name+' وشاهد صفحتين من كتابه مجانًا.';
 document.querySelector('#cta').textContent='شاهد تجربتك المجانية لكتاب '+name;
 document.querySelector('#steps').replaceChildren(...labels.map((label,i)=>{
  const badge=document.createElement('span'),done=kids.every(v=>checklist(v)[i]);badge.className=done?'done':'';badge.textContent=(done?'✓ ':'')+label;return badge;
 }));
 Array.from(host.children).forEach((el,i)=>{
  const kid=kids[i],find=s=>el.querySelector(s),name=kid.child?.trim()||'طفلك';
  const n=checklist(kid).filter(Boolean).length;
  find('.name').textContent=kid.child||('الطفل '+(i?'الثاني':'الأول'));
  find('.progress').textContent=n===5?'✓ جاهز للتجربة المجانية':'اكتمل '+n+' من 5 حقول';
  find('.summary i').textContent=n===5?'✓':'✦';
  find('.years').textContent=kid.age||'';find('.likes').textContent='وش يحب '+name+'؟';
  find('.prompt').textContent='ما الذي سيجعل '+name+' يقول: «هذا كتابي أنا!»؟';
  find('.count').textContent=(kid.extra||'').length+'/300';
  find('.feedback').textContent=kid.extra?.trim()?'رائع! سنحوّل هذه التفاصيل إلى مغامرات خاصة بعالم '+name+'.':'';
  const thumb=find('.thumb');thumb.hidden=el.dataset.restoredPhoto==='yes'||!(kid.photo && kid.photoChecked===1);
  if(!thumb.hidden && thumb.getAttribute('src')!==kid.photo)thumb.src=kid.photo;
  for(const btn of el.querySelectorAll('.ideas button'))btn.classList.toggle('active',(kid.extra||'').includes(btn.dataset.idea));
 });
 document.querySelector('.another').hidden=kids.length===2;
}
function build(k,index){
 const el=document.querySelector('#card').content.firstElementChild.cloneNode(true);
 const find=s=>el.querySelector(s);
 const name=find('[name=child]'),area=find('textarea');
 name.value=k.child||'';area.value=k.extra||'';
 function commit(){document.querySelector('#error').textContent='';update();save()}
 name.oninput=()=>{k.child=name.value;commit()};area.oninput=()=>{k.extra=area.value;commit()};
 function radio(parent,key,values){
  for(const [value,text] of values){
   const lab=document.createElement('label'),input=document.createElement('input');
   input.type='radio';input.name=key+index;input.required=true;input.value=value;input.checked=k[key]===value;
   input.onchange=()=>{k[key]=value;commit()};lab.append(input,text);parent.append(lab);
  }
 }
 radio(find('.gender'),'gender',[['ولد','👦 ولد'],['بنت','👧 بنت']]);
 radio(find('.ages'),'age',Array.from({length:12},(_,i)=>[String(i+1),String(i+1)]));
 bindPhotoUpload(el,k,commit);
 for(const idea of suggestions){
  const btn=document.createElement('button');btn.type='button';btn.dataset.idea=idea;btn.textContent='+ '+idea;
  btn.onclick=()=>{
   const parts=area.value.split('،').map(x=>x.trim()).filter(Boolean);
   const next=(parts.includes(idea)?parts.filter(x=>x!==idea):[...parts,idea]).join('، ');
   if(next.length>300){document.querySelector('#error').textContent='الحد الأقصى 300 حرف.';return}
   area.value=next;k.extra=next;commit();
  };find('.ideas').append(btn);
 }
 const summary=find('.summary'),fields=find('.fields');
 summary.onclick=()=>{fields.hidden=!fields.hidden;summary.setAttribute('aria-expanded',String(!fields.hidden));find('.caret').textContent=fields.hidden?'⌄':'⌃'};
 if(index){const rm=find('.remove');rm.hidden=false;rm.onclick=()=>{kids.pop();el.remove();commit()}}
 el.id='child-'+(index+1);
 host.append(el);
}
kids.forEach(build);update();
if(location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView();
document.querySelector('#offer button').onclick=()=>document.querySelector('#offer').hidden=true;
document.querySelector('#add').onclick=()=>{if(kids.length===2)return;kids.push({});build(kids[1],1);update();save();host.lastElementChild.querySelector('[name=child]').focus()};
if(new URLSearchParams(location.search).has('add') && kids.length===1)document.querySelector('#add').click();
form.noValidate=true;
form.onsubmit=e=>{
 e.preventDefault();
 for(let i=0;i<kids.length;i++){
  const missing=checklist(kids[i]).findIndex(x=>!x);
  if(missing<0)continue;
  const el=host.children[i];if(el.querySelector('.fields').hidden)el.querySelector('.summary').click();
  const input=el.querySelector(['[name=child]','.gender input','.ages input','[type=file]','textarea'][missing]);
  document.querySelector('#error').textContent='أكمل حقل «'+labels[missing]+'» للطفل '+(i+1)+'.';
  input.focus();input.scrollIntoView({block:'center'});return;
 }
 if(!save())return;
 if(e.submitter?.value==='order'){location.href='create/personalized/size/';return}
 document.getElementById('trial-title').textContent='صفحتان من كتاب '+kids[0].child.trim();
 showTrialStep();
 trialSheet.showModal();
};

const trialSheet=document.getElementById('trial-sheet');
const contact=document.getElementById('trial-contact');
trialSheet.querySelector('.trial-close').onclick=()=>trialSheet.close();
contact.oninput=()=>{contact.elements.mobile.setCustomValidity('');contact.querySelector('.trial-message').textContent=''};
contact.onsubmit=async event=>{
 event.preventDefault();
 const digits=contact.elements.mobile.value.replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632).replace(/[ ()-]/g,'');
 if(!/^\d{7,12}$/.test(digits)){
  contact.elements.mobile.setCustomValidity('أدخل رقم جوال صحيحًا بدون مفتاح الدولة.');
  contact.elements.mobile.reportValidity();return;
 }
 contact.querySelector('.trial-message').textContent='جارٍ تسجيل طلب التجربة…';
 try{
  const response=await fetch('/api/trials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   parentName:contact.elements.parentName.value.trim(),
   parentGender:contact.elements.parentGender.value,
   mobile:digits
  })});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'تعذّر تسجيل طلب التجربة');
  contact.querySelector('.trial-message').textContent='تم تسجيل طلب التجربة '+result.id+'. إرسال واتساب والرمز يتطلب ربط مزوّد الرسائل.';
 }catch(error){contact.querySelector('.trial-message').textContent=error.message}
};
const preparation=document.getElementById('prep');
const intro=trialSheet.querySelector('.trial-intro');
let preparedKey='',run=0;
function draftKey(){return JSON.stringify([kids[0].child,kids[0].extra,kids[0].photo])}
async function previewFingerprint(value){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
const resumePreview=document.getElementById('resume-preview');
const viewPages=document.getElementById('view-pages');
function previewUrl(preview){return `preview.html#preview_id=${encodeURIComponent(preview.id)}&token=${encodeURIComponent(preview.token)}`}
function updateResumePreview(){
 try{
 const saved=JSON.parse(localStorage.getItem('alwan-preview')||'null');
 if(saved?.id&&saved?.token){resumePreview.href=previewUrl(saved);resumePreview.hidden=false}
 }catch{}
}
updateResumePreview();
function showTrialStep(){
 const show=preparedKey===draftKey();
 preparation.hidden=!show;intro.hidden=show;contact.hidden=show;
}
async function preparePages(){
 const task=++run,key=draftKey();preparedKey=key;showTrialStep();
 const name=kids[0].child.trim(),rows=[...preparation.querySelectorAll('li')];
 const title=document.getElementById('prep-title'),status=document.getElementById('prep-status');
 const view=viewPages,retry=document.getElementById('retry-pages');
 title.textContent='نجهّز تجربتك المجانية لكتاب '+name+' ❤️';
 view.hidden=retry.hidden=true;
 if(!document.getElementById('aiProcessingConsent').checked){
 contact.querySelector('.trial-message').textContent='يلزم إقرار ولي الأمر بالموافقة قبل معالجة الصورة.';
 preparation.hidden=true;intro.hidden=false;contact.hidden=false;return;
 }
 if(!kids[0].photo||kids[0].photoChecked!==1){
 contact.querySelector('.trial-message').textContent='أكمل فحص صورة الطفل أولًا.';
 preparation.hidden=true;intro.hidden=false;contact.hidden=false;return;
 }
 rows.forEach(row=>{row.dataset.state='waiting';row.querySelector('small').textContent='في قائمة الانتظار'});
 status.textContent='جارٍ حفظ المعاينة والصورة المضغوطة بأمان…';
 try{
 const fingerprint=await previewFingerprint(key);
 let saved=null;
 try{saved=JSON.parse(localStorage.getItem('alwan-preview')||'null')}catch{}
 if(!saved||saved.fingerprint!==fingerprint||!saved.id||!saved.token){
  const response=await fetch('/api/previews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   aiProcessingConsent:true,
   child:{name:kids[0].child,gender:kids[0].gender,age:Number(kids[0].age),interests:kids[0].extra,photo:kids[0].photo}
  })});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'تعذّر حفظ المعاينة');
  saved={id:result.id,token:result.resumeToken,fingerprint};
  try{localStorage.setItem('alwan-preview',JSON.stringify(saved))}catch{}
 }
 if(task!==run)return;
 rows.forEach(row=>{row.dataset.state='queued';row.querySelector('small').textContent='محفوظ'});
 view.href=previewUrl(saved);view.hidden=false;view.textContent='متابعة حالة المعاينة';
 updateResumePreview();
 status.textContent='تم حفظ طلب المعاينة والصفحتين في قائمة التوليد. يمكنك إغلاق الصفحة والعودة عبر الرابط المحفوظ؛ ستظهر الصفحتان بعد تفعيل عامل التوليد.';
 }catch(error){
 if(task===run){
  status.textContent=error.message||'تعذّر حفظ المعاينة. حاول مرة أخرى.';
  retry.hidden=false;
  rows.forEach(row=>{row.dataset.state='failed';row.querySelector('small').textContent='تعذّر الحفظ'});
 }
 }
}
document.getElementById('prepare-example').onclick=preparePages;
document.getElementById('retry-pages').onclick=preparePages;

const siblingOffer=document.getElementById('sibling-offer');
siblingOffer.querySelector('.sibling-close').onclick=()=>siblingOffer.close();
document.getElementById('accept-sibling').onclick=()=>{
 siblingOffer.close();
 document.getElementById('add').click();
};
document.getElementById('continue-single').onclick=()=>{
 siblingOffer.close();
 form.requestSubmit(form.querySelector('.order'));
};
if(likedReturn){
 if(kids.length===1){
  const selected=JSON.parse(sessionStorage.getItem('alwan-options')||'{}').sizes?.[0];
  const savings=selected===32?'240.00':'210.00';
  document.getElementById('sibling-saving').textContent='وفّر '+savings+' ج.م. على الكتاب الثاني بنفس الباقة';
  siblingOffer.showModal();
 }else form.requestSubmit(form.querySelector('.order'));
}
