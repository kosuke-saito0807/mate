/* MATE partner gallery: approved URLs only; category photo fallback.
   Generic, keyboard-accessible one-to-five image carousel for CARE/SPARK.
   No script execution, no links to unreviewed images, and no image referrer. */
(function(global){
 "use strict";
 function safe(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
 function imageSafe(s){
   try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&/\.(jpg|jpeg|png|webp|avif)$/i.test(u.pathname)&&u.href.length<500&&!u.hash;}catch{return false}
 }
 function fallback(service,category){
   const c=String(category||"").toLowerCase();
   if(service==="CARE"){
     if(/病児|病後|看護/.test(c))return "assets/mate-care-scene-sick-v2.webp";
     if(/送迎|送り迎え/.test(c))return "assets/mate-care-scene-pickup-v2.webp";
     return "assets/mate-care-scene-urgent-v2.webp";
   }
   if(/ピアノ|音楽|歌|ギター|バイオリン/.test(c))return "assets/spark-first-piano-lesson.png";
   if(/プログラミング|ロボット|科学|stem|steam|英語|学習|塾/.test(c))return "assets/family-learning.png";
   return "assets/activities.png";
 }
 function render(data,service){
   const fallbackSrc=fallback(service,data.category);
   const images=(Array.isArray(data.images)?data.images:[]).filter(imageSafe).slice(0,5);
   const photos=images.length?images:[fallbackSrc];
   const alt=safe(data.name||"事業者")+"の掲載写真";
   return '<div class="mate-photo-carousel" data-mate-gallery="1" data-photo-index="0" data-fallback="'+safe(fallbackSrc)+'" aria-label="'+alt+'">'+
     '<div class="mate-photo-slides">'+photos.map((u,i)=>'<img src="'+safe(u)+'" alt="'+alt+(images.length?" "+(i+1)+"枚目":"（カテゴリーイメージ）")+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" '+(i?'hidden':'')+'>').join('')+'</div>'+
     (photos.length>1?'<button type="button" class="mate-photo-prev" aria-label="前の写真" data-photo-move="-1">‹</button><button type="button" class="mate-photo-next" aria-label="次の写真" data-photo-move="1">›</button><span class="mate-photo-count" aria-live="polite">1 / '+photos.length+'</span>':'')+
     (!images.length?'<span class="mate-photo-fallback">カテゴリーイメージ</span>':'')+
    '</div>';
 }
 document.addEventListener("click",function(event){
   const button=event.target.closest&&event.target.closest("[data-photo-move]");
   if(!button)return;
   const g=button.closest("[data-mate-gallery]");if(!g)return;
   event.stopPropagation();event.preventDefault();
   const imgs=[...g.querySelectorAll(".mate-photo-slides img")];
   if(imgs.length<2)return;
   const next=(Number(g.dataset.photoIndex||0)+Number(button.dataset.photoMove)+imgs.length)%imgs.length;
   imgs.forEach((img,i)=>{img.hidden=i!==next});g.dataset.photoIndex=String(next);
   const counter=g.querySelector(".mate-photo-count");if(counter)counter.textContent=(next+1)+" / "+imgs.length;
 });
 document.addEventListener("error",function(event){
   const img=event.target;
   if(!(img instanceof HTMLImageElement)||!img.closest("[data-mate-gallery]"))return;
   const container=img.closest("[data-mate-gallery]"),fallbackSrc=container.dataset.fallback;
   if(img.src.endsWith(fallbackSrc))return;
   img.src=fallbackSrc;img.alt="カテゴリーイメージ";
 },true);
 global.MATEGallery={render,fallback};
})(window);
