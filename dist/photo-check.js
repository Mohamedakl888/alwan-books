let photoModelReady;
function loadPhotoModels(){
 if(!photoModelReady){
  photoModelReady=(async()=>{
   const folder='assets/photo-model';
   if(!window.faceapi){
    await new Promise((resolve,reject)=>{
     const script=document.createElement('script');script.onload=resolve;script.onerror=reject;
     script.src=folder+'/face-api.js';document.head.append(script);
    });
   }
   const api=window.faceapi;
   await api.tf.ready();
   await Promise.all([api.nets.tinyFaceDetector,api.nets.faceLandmark68TinyNet,api.nets.ageGenderNet].map(net=>net.loadFromUri(folder)));
   return api;
  })().catch(error=>{photoModelReady=null;throw error});
 }
 return photoModelReady;
}
function checkFacePixels(canvas,box){
 const patch=document.createElement('canvas');patch.width=patch.height=80;
 const ctx=patch.getContext('2d');ctx.drawImage(canvas,box.x,box.y,box.width,box.height,0,0,80,80);
 const pixels=ctx.getImageData(0,0,80,80).data;
 const light=new Float32Array(6400);
 for(let i=0;i<light.length;i++)light[i]=0.299*pixels[4*i]+0.587*pixels[4*i+1]+0.114*pixels[4*i+2];
 let sum=0,energy=0,count=0;
 for(let y=8;y<72;y++)for(let x=8;x<72;x++){
  const i=y*80+x,edge=4*light[i]-light[i-1]-light[i+1]-light[i-80]-light[i+80];
  sum+=light[i];energy+=edge*edge;count++;
 }
 if(sum/count<32||sum/count>236)return 'جرّب إضاءة متوازنة تُظهر ملامح الوجه.';
 if(energy/count<14)return 'الصورة مشوّشة. اختر صورة أكثر وضوحًا.';
 return '';
}
async function inspectPortrait(canvas){
 const api=await loadPhotoModels();
 const faces=await api.detectAllFaces(canvas,new api.TinyFaceDetectorOptions({inputSize:416,scoreThreshold:0.33})).withFaceLandmarks(true).withAgeAndGender();
 if(!faces.length)return 'لم يظهر وجه واضح. اختر صورة أمامية بإضاءة جيدة.';
 if(faces.length>1)return 'تظهر عدة وجوه. اختر صورة لطفل واحد.';
 const face=faces[0],box=face.detection.box;
 if(box.width<60 || box.width/canvas.width<0.14)return 'الوجه بعيد. اختر صورة أقرب للطفل.';
 const quality=checkFacePixels(canvas,box);if(quality)return quality;
 const points=face.landmarks.positions;
 const left=points[36].x,right=points[45].x;
 const nose=(points[30].x-left)/Math.max(1,right-left);
 if(nose<0.17||nose>0.83)return 'الوجه جانبي. اختر صورة ينظر فيها الطفل للأمام.';
 if(!Number.isFinite(face.age))throw Error('analysis unavailable');
 if(face.age>=22)return 'يبدو أن الصورة ليست لطفل. هذا المنتج مخصّص حاليًا لصور الأطفال.';
 return '';
}
function bindPhotoUpload(el,k,commit){
 const find=s=>el.querySelector(s),file=find('[type=file]'),photo=find('.photo'),portrait=find('.portrait');
 const result=find('.result'),retry=find('.retry');
 let version=0;
 function displayPhoto(src){
  portrait.hidden=!src;photo.classList.toggle('filled',!!src);
  find('.photo-guide').hidden=!!src;find('.upload-hint').hidden=!!src;
  find('.pick').textContent=src?'تغيير الصورة':'اختيار صورة';
  find('.photoTitle').textContent=src?'صورتك المرفوعة':'اسحب الصورة هنا';
  if(src)portrait.src=src;else portrait.removeAttribute('src');
 }
 function state(type,message=''){
  result.hidden=false;result.dataset.state=type;
  find('.result-icon').textContent={busy:'…',accepted:'✓',rejected:'📷'}[type];
  find('.result-title').textContent={busy:'جارٍ تحليل الصورة…',accepted:'تمت الموافقة على الصورة!',rejected:'نحتاج صورة أوضح'}[type];
  find('.reason').textContent=message;retry.hidden=type!=='rejected';
 }
 async function examine(src,expected){
  const img=new Image();img.src=src;await img.decode();
  if(expected!==version)return;
  const ratio=Math.min(1,1600/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const preview=canvas.toDataURL('image/jpeg',0.83);displayPhoto(preview);
  const reason=await inspectPortrait(canvas);
  if(expected!==version||!el.isConnected)return;
  if(reason)state('rejected',reason);
  else{k.photo=preview;k.photoChecked=1;state('accepted')}
  commit();
 }
 async function select(blob,oldSrc){
  if(!blob&&!oldSrc)return;
  const expected=++version;
  delete el.dataset.restoredPhoto;
  k.photo='';k.photoChecked=0;displayPhoto('');state('busy');commit();
  if(blob && !['image/jpeg','image/png'].includes(blob.type)){
   state('rejected','اختر ملف JPG أو PNG.');return;
  }
  if(blob && blob.size>12*1024*1024){
   state('rejected','حجم الصورة كبير جدًا. اختر صورة أقل من 12 ميجابايت.');return;
  }
  const src=oldSrc||URL.createObjectURL(blob);
  try{await examine(src,expected)}
  catch{if(expected===version)state('rejected','تعذّر فحص الصورة. حاول مرة أخرى أو اختر صورة أخرى.')}
  finally{if(!oldSrc)URL.revokeObjectURL(src)}
 }
 retry.onclick=()=>file.click();
 file.onchange=()=>{const selected=file.files[0];file.value='';select(selected)};
 photo.ondragover=e=>e.preventDefault();
 photo.ondrop=e=>{e.preventDefault();select(e.dataTransfer.files[0])};
 if(k.photo && k.photoChecked===1){
  displayPhoto(k.photo);portrait.removeAttribute('src');portrait.hidden=true;el.dataset.restoredPhoto='yes';
  find('.photoTitle').textContent='صورتك محفوظة — الصورة المصغّرة لا تظهر بعد إعادة الفتح';
  state('accepted');
 }
 else if(k.photo){const legacy=k.photo;queueMicrotask(()=>select(null,legacy))}
}
