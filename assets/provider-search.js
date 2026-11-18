let D=[];
const n=v=>String(v??'').trim(),nm=p=>n(p.name||p.事業者名||p.会社名)||'シッター',ar=p=>n(p.area||p.エリア||p.対応エリア).split(/[、,・／/|\n]+/).map(x=>x.trim()).filter(Boolean),ur=p=>n(p.official_url||p.url||p.公式サイト||p.website);
const escapeHtml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Per-editorial-provider website screenshot preview with recognizable logo fallback. */
function mateEditorialThumb(p,service){
 const name=nm(p),id=n(p.id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,82);
 let host='';try{const u=new URL(ur(p));if(u.protocol==='https:')host=u.hostname.toLowerCase();}catch{}
 const hue=[...id].reduce((v,ch)=>(v*33+ch.charCodeAt(0))%360,127);
 const photo=service==='CARE'?'assets/editorial-thumbnails/care/'+id+'.webp':'assets/editorial-thumbnails/spark/'+id+'.webp';
 const favicon=host?'https://www.google.com/s2/favicons?domain='+encodeURIComponent(host)+'&sz=128':'';
 return '<a class="mate-editorial-thumb mate-thumbnail-fallback" style="--mate-hue:'+hue+'" data-editorial-thumbnail data-provider-id="'+escapeHtml(id)+'" href="'+escapeHtml(ur(p))+'" target="_blank" rel="noopener noreferrer" aria-label="'+escapeHtml(name)+'の公式サイトを開く">'+
  '<img class="mate-editorial-shot" data-editorial-shot src="'+escapeHtml(photo)+'" alt="'+escapeHtml(name)+'の公式Webサイト縮小プレビュー" loading="lazy" decoding="async" referrerpolicy="no-referrer">'+
  '<div class="mate-editorial-brand">'+(favicon?'<img class="mate-editorial-favicon" src="'+escapeHtml(favicon)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+
  '<span class="mate-editorial-name">'+escapeHtml(name)+'</span></div>'+
  (host?'<span class="mate-preview-source">公式サイト：'+escapeHtml(host)+'</span>':'')+'</a>';
}
document.addEventListener('load',e=>{const i=e.target;if(i&&i.matches&&i.matches('[data-editorial-shot]'))i.closest('.mate-editorial-thumb')?.classList.remove('mate-thumbnail-fallback');},true);
document.addEventListener('error',e=>{const i=e.target;if(i&&i.matches&&i.matches('[data-editorial-shot],.mate-editorial-favicon'))i.hidden=true;},true);
const ALL_PREFECTURES=["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
function fill(){const known=new Set(ALL_PREFECTURES);const more=[...new Set(D.flatMap(ar))].filter(x=>x&&!known.has(x)).sort((x,y)=>x.localeCompare(y,'ja'));const options=[...ALL_PREFECTURES,...more];['area'].forEach(id=>{const select=document.getElementById(id);const current=select.value;select.innerHTML=select.options[0].outerHTML+options.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');select.value=options.includes(current)?current:''})}
function card(p){let url=ur(p);try{if(!['https:','http:'].includes(new URL(url).protocol))url=''}catch{url=''}return `<article class="result" id="listing-${escapeHtml(n(p.id))}">${url?mateEditorialThumb(p,"CARE"):(window.MATEGallery?window.MATEGallery.render(p,"CARE"):"")}<p class="result-kicker">${p.editorial?"公開情報参考・事業者未確認":"正式掲載"}</p><h3>${escapeHtml(nm(p))}</h3><p>${escapeHtml(ar(p).join('・')||'対応エリアは公式サイトをご確認ください')}</p>${p.category?`<p class="result-kicker">${escapeHtml(n(p.category))}</p>`:""}${p.description?`<p class="result-description">${escapeHtml(n(p.description))}</p>`:""}${p.pricingNotes?`<p class="result-meta">料金：${escapeHtml(n(p.pricingNotes))}</p>`:""}${p.openingHours?`<p class="result-meta">対応時間：${escapeHtml(n(p.openingHours))}</p>`:""}${p.editorial?`<p class="result-meta">対象年齢・料金・利用条件は公式サイトでご確認ください。</p>`:""}${url?`<a class="provider-link" data-provider-id="${escapeHtml(n(p.id))}" href="${escapeHtml(url)}" target="_blank" rel="noopener">公式サイトを見る ↗</a>`:''}</article>`}
function render(){const query=n(document.getElementById('q').value).toLowerCase(),area=n(document.getElementById('area').value);let matches=D.filter(p=>(!query||JSON.stringify(p).toLowerCase().includes(query))&&(!area||ar(p).some(a=>a==='全国'||a===area||a.includes(area)||area.includes(a)&&ALL_PREFECTURES.includes(a))));if(document.getElementById('sort').value==='name')matches=matches.slice().sort((a,b)=>nm(a).localeCompare(nm(b),'ja'));const editorialCount=matches.filter(p=>p.editorial===true).length,approvedCount=matches.length-editorialCount;document.getElementById('results-count').textContent=matches.length+' 件の掲載情報（正式掲載 '+approvedCount+' 件・公開情報による参考紹介 '+editorialCount+' 件）';document.getElementById('results').innerHTML=matches.length?matches.map(card).join(''):'<div class="empty"><h3>'+ (D.length?'条件に合うシッターがありません':'新しい出会いを、準備しています。')+'</h3><p>'+ (D.length?'エリアやキーワードを変えてみてください。':'掲載許可をいただいたシッター事業者から順次公開します。')+'</p><p><a href="consult.html?service=CARE">シッターについて相談する ↗</a></p><p><a href="guide-sitter-choice.html">初めてのベビーシッター選び・依頼前のチェックポイント ↗</a></p></div>';}
var mateDeepLinkResolved=false;
function mateFocusListingHash(){
 if(mateDeepLinkResolved||!/^#listing-[a-z0-9_-]{6,95}$/i.test(location.hash))return;
 var id=location.hash.slice(1),target=document.getElementById(id);
 if(target){mateDeepLinkResolved=true;target.scrollIntoView({block:'center'});}
}
function resetSearch(){for(const id of ['q','area'])document.getElementById(id).value='';render()}
for(const id of ['q','area','sort'])document.getElementById(id).addEventListener(id==='q'?'input':'change',render);
Promise.allSettled([
 fetch('data.json?'+Date.now()).then(r=>{if(!r.ok)throw Error('approved load');return r.json()}),
 fetch('editorial-care.json?'+Date.now()).then(r=>{if(!r.ok)throw Error('editorial load');return r.json()})
]).then(([approvedResult,editorialResult])=>{
 const x=approvedResult.status==='fulfilled'?approvedResult.value:[];
 const raw=Array.isArray(x)?x:(Array.isArray(x.providers)?x.providers:Array.isArray(x.data)?x.data:[]);
 const editorial=editorialResult.status==='fulfilled'&&Array.isArray(editorialResult.value)?editorialResult.value:[];
 D=raw.concat(editorial.filter(p=>p.editorial===true&&p.approved===false).map(p=>({...p,area:p.region,official_url:p.url})));
 fill();render();mateFocusListingHash();
 const status=document.getElementById('care-data-status');
 if(approvedResult.status==='rejected'&&editorialResult.status==='rejected')status.textContent='掲載情報を取得できませんでした。時間をおいて再読み込みしてください。';
 else if(approvedResult.status==='rejected'||editorialResult.status==='rejected')status.textContent='一部の掲載情報を取得できませんでした。現在表示中の事業者情報は公式サイトでもご確認ください。';
 else status.textContent=D.length?'正式掲載と事業者未承認の参考紹介を区別して表示しています。料金・対象年齢・利用条件は各公式サイトでご確認ください。':'現在、掲載シッター事業者を募集中です。';
});

document.getElementById('results').addEventListener('click',event=>{const link=event.target.closest('a[data-provider-id]');if(link&&window.gtag){const id=String(link.dataset.providerId||'');if(/^[A-Za-z0-9_-]{1,80}$/.test(id)){gtag('event','provider_outbound',{service:'CARE',provider_id:id});gtag('event','mate_partner_click',{service:'CARE',partner_id:id})}}});
