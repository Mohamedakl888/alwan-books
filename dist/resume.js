const returnPanel=document.getElementById('return-panel');
const editor=document.querySelector('main');
function hasDraft(){
 try{
  const draft=JSON.parse(sessionStorage.getItem('alwan-draft'));
  return Boolean(draft && (draft.kids||[draft]).some(k=>k.child?.trim()||k.age||k.gender||k.photo||k.extra?.trim()||k.interests?.length));
 }catch{return false}
}
function showEditor(){
 returnPanel.hidden=true;
 editor.hidden=false;
 const script=document.createElement('script');
 script.src='customize.js';
 document.body.append(script);
}
document.getElementById('resume').onclick=showEditor;
const restartDialog=document.getElementById('restart-dialog');
document.getElementById('restart').onclick=()=>restartDialog.showModal();
restartDialog.querySelector('.sheet-close').onclick=()=>restartDialog.close();
document.getElementById('keep-order').onclick=()=>{
 restartDialog.close();
 showEditor();
};
document.getElementById('clear-order').onclick=()=>{
 sessionStorage.removeItem('alwan-draft');
 sessionStorage.removeItem('alwan-options');
 location.replace('customize.html');
};
const likedReturn=sessionStorage.getItem('alwan-liked-return')==='1';
sessionStorage.removeItem('alwan-liked-return');
if(hasDraft() && !likedReturn)returnPanel.hidden=false;
else showEditor();
window.addEventListener('pagehide',()=>{editor.hidden=true;returnPanel.hidden=true});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
