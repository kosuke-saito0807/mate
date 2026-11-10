/* MATE partner gallery: approved URLs only; category photo fallback.
   Generic, keyboard-accessible one-to-five image carousel for CARE/SPARK.
   No script execution, no links to unreviewed images, and no image referrer. */
(function(global){
 "use strict";
 function safe(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
 function imageSafe(s){
   if(/^\/assets\/partner-media\/(?:care|spark)\/[0-9a-f-]{36}\/[0-9]{2}-[0-9a-f]{16}\.jpg$/.test(String(s||"")))return true;
   try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&/\.(jpg|jpeg|png|webp|avif)$/i.test(u.pathname)&&u.href.length<500&&!u.hash;}catch{return false}
 }
 function fallback(service,category,description){
   const c=(String(category||"")+" "+String(description||"").slice(0,250)).toLowerCase();
   if(service==="CARE"){
     if(/病児|病後|看護/.test(c))return "assets/mate-care-scene-sick-v2.webp";
     if(/送迎|送り迎え/.test(c))return "assets/mate-care-scene-pickup-v2.webp";
     return "assets/mate-care-scene-urgent-v2.webp";
   }
   if(/ピアノ|音楽|歌|ギター|バイオリン|バンド/.test(c))return "assets/mate-category-piano.svg";
   if(/プログラミング|コーディング|コード|アプリ|ゲーム開発|ロボット|python|scratch|stem|steam/.test(c))return "assets/mate-category-coding.svg";
   if(/サッカー|野球|体操|運動|スポーツ|ダンス|バレエ|スイミング|水泳/.test(c))return "assets/mate-category-sports.svg";
   if(/絵画|アート|工作|造形|美術|イラスト|クラフト/.test(c))return "assets/mate-category-art.svg";
   if(/英語|英会話|語学|学習|塾|算数|国語/.test(c))return "assets/mate-category-learning.svg";
   if(/科学|実験|理科|自然体験|農業/.test(c))return "assets/mate-category-science.svg";
   return "assets/mate-category-learning.svg";
 }
 function render(data,service){
   const fallbackSrc=fallback(service,data.category,data.description);
   const images=(Array.isArray(data.images)?data.images:[]).filter(imageSafe).slice(0,5);
   const photos=images.length?images:[fallbackSrc];
   const alt=safe(data.name||"事業者")+"の掲載写真";
   return '<div class="mate-photo-carousel" data-mate-gallery="1" data-photo-index="0" data-fallback="'+safe(fallbackSrc)+'" aria-label="'+alt+'">'+
     '<div class="mate-photo-slides">'+photos.map((u,i)=>'<img class="'+(images.length?'mate-real-photo':'mate-category-photo')+'" src="'+safe(u)+'" alt="'+alt+(images.length?" "+(i+1)+"枚目":"（カテゴリーイメージ）")+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" '+(i?'hidden':'')+'>').join('')+'</div>'+
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
   img.src=fallbackSrc;img.className="mate-category-photo";img.alt="カテゴリーイメージ";
 },true);
 global.MATEGallery={render,fallback};
})(window);
