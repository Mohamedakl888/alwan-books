const draft=JSON.parse(sessionStorage.getItem('alwan-draft')||'{}');
const children=draft.kids?.length?draft.kids:[draft];
const saved=JSON.parse(sessionStorage.getItem('alwan-options')||'{}');
const sizes=children.map((_,i)=>saved.sizes?.[i]===32?32:20);
let fast=saved.fast!==false;

const price=size=>size===32?1200:1050;
const amount=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' ج.م.';
const el=id=>document.getElementById(id);
const name=i=>children[i].child?.trim()||(i?'الطفل الثاني':'طفلك');
function line(target,label,value){
 const row=document.createElement('div');row.className='line';
 const text=document.createElement('span'),sum=document.createElement('b');
 text.textContent=label;sum.textContent=value;row.append(text,sum);target.append(row);
}
function totals(){
 const subtotal=sizes.reduce((sum,size)=>sum+price(size),0);
 const discount=sizes.length>1?price(sizes[1])*0.2:0;
 const delivery=fast?50:0;
 return {subtotal,discount,delivery,total:subtotal-discount+delivery};
}
