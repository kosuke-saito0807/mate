/* MATE partner photo picker: local files only, drag/drop or mobile gallery.
   Resize to JPEG, remove EXIF metadata, and submit as bounded base64 in the
   existing verified (Turnstile) form. No photo is sent until form submission. */
(function(){
"use strict";
const MAX=5,MAX_BYTES=240000,MAX_TOTAL=1050000;
function boot(form){
 const container=form.querySelector(".mate-image-fields");
 if(!container)return;
 const control=container.querySelector('input[type=file]'),zone=container.querySelector("[data-photo-drop]");
 const gallery=container.querySelector("[data-photo-preview]"),count=container.querySelector("[data-photo-count]");
 const field=container.querySelector('[name="listing_photo_payload"]');
 const rights=container.querySelector('[name="listing_image_rights"]');
 if(!control||!zone||!gallery||!field||!rights)return;
 let items=[],loading=false;
 const warn=msg=>{count.textContent=msg;count.setAttribute("role","status")};
 function paint(){
  gallery.replaceChildren();
  items.forEach((x,i)=>{
   const card=document.createElement("div");card.className="mate-upload-thumb";
   const img=document.createElement("img");img.src=x.preview;img.alt="選択した写真 "+(i+1);img.loading="lazy";
   const b=document.createElement("button");b.type="button";b.textContent="削除";b.setAttribute("aria-label","写真"+(i+1)+"を削除");
   b.onclick=()=>{items.splice(i,1);URL.revokeObjectURL(x.preview);paint()};
   card.append(img,b);gallery.append(card);
  });
  warn("選択中 "+items.length+" / "+MAX+"枚（最初の写真がサムネイル）");
 }
 async function jpeg(file){
  if(file.size>8*1024*1024)throw Error("元の写真は8MB以下にしてください");
  if(!/^image\/(jpeg|png|webp)$/i.test(file.type))throw Error("JPG・PNG・WebPの写真を選択してください");
  const bmp=await createImageBitmap(file);
  try{
   const max=850,scale=Math.min(1,max/Math.max(bmp.width,bmp.height)),w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
   if(!w||!h||w*h>1200000)throw Error("画像サイズを確認してください");
   const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)throw Error("画像を変換できません");
   ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);ctx.drawImage(bmp,0,0,w,h);
   let result;
   for(const q of [0.75,0.6,0.45]){result=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",q));if(result&&result.size<=MAX_BYTES)break}
   if(!result||result.size>MAX_BYTES)throw Error("画像を小さくできませんでした。別の写真をお試しください");
   const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(result)});
   return {encoded:base64,preview:URL.createObjectURL(result),size:result.size};
  }finally{bmp.close()}
 }
 async function add(files){
  if(loading)return;
  loading=true;zone.setAttribute("aria-busy","true");
  try{
   const selected=[...files];if(selected.length+items.length>MAX)throw Error("写真は最大5枚までです");
   const incoming=[];
   for(const file of selected){const out=await jpeg(file);incoming.push(out)}
   if([...items,...incoming].reduce((n,x)=>n+x.size,0)>MAX_TOTAL){
     incoming.forEach(x=>URL.revokeObjectURL(x.preview));
     throw Error("写真の合計サイズが大きすぎます。枚数を減らしてください");
   }
   items.push(...incoming);paint();
  }catch(err){warn(err instanceof Error?err.message:"写真を読み込めませんでした")}
  finally{loading=false;control.value="";zone.removeAttribute("aria-busy")}
 }
 control.addEventListener("change",()=>void add(control.files||[]));
 ["dragenter","dragover"].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.add("over")}));
 ["dragleave","drop"].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.remove("over")}));
 zone.addEventListener("drop",e=>void add(e.dataTransfer?.files||[]));
 // The primary form handler invokes populate synchronously on submit.
 window.MATEPhotoPicker=window.MATEPhotoPicker||new WeakMap();
 window.MATEPhotoPicker.set(form,{
  populate(){
   if(loading){warn("写真の読み込みが完了してから送信してください");return false}
   if(items.length&&!rights.checked){warn("写真の掲載権限への同意が必要です");return false}
   field.value=items.length?"MATE_PHOTOS_V1__"+JSON.stringify(items.map(x=>x.encoded)):"";
   return true;
  }
 });
 paint();
}
function ready(){document.querySelectorAll("form[data-mate-direct-listing]").forEach(boot)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready,{once:true});else ready();
})();