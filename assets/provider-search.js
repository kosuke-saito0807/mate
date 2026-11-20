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
/* Approved listings without licensed photos use the same branded visual frame. */
function mateApprovedThumb(p){
 const name=mateDisplayName(p),url=ur(p);let host='';
 try{const u=new URL(url);if(u.protocol==='https:')host=u.hostname.toLowerCase()}catch{}
 const favicon=host?'https://www.google.com/s2/favicons?domain='+encodeURIComponent(host)+'&sz=128':'';
 const html='<a class="mate-editorial-thumb mate-thumbnail-fallback mate-approved-brand" data-approved-brand data-provider-id="'+escapeHtml(n(p.id))+'" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+escapeHtml(name)+'の公式サイトを開く">'+
  '<div class="mate-editorial-brand">'+(favicon?'<img class="mate-editorial-favicon" src="'+escapeHtml(favicon)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+
  '<span class="mate-editorial-name">'+escapeHtml(name)+'</span></div>'+
  (host?'<span class="mate-preview-source">公式サイト：'+escapeHtml(host)+'</span>':'')+'</a>';
 return html;
}
function mateDisplayName(p){return nm(p).replace(/^(?:株式会社|有限会社|合同会社|一般社団法人|特定非営利活動法人)[ 　]*/,'').trim()||nm(p)}
document.addEventListener('load',e=>{const i=e.target;if(i&&i.matches&&i.matches('[data-editorial-shot]'))i.closest('.mate-editorial-thumb')?.classList.remove('mate-thumbnail-fallback');},true);
document.addEventListener('error',e=>{const i=e.target;if(i&&i.matches&&i.matches('[data-editorial-shot],.mate-editorial-favicon'))i.hidden=true;},true);
const ALL_PREFECTURES=["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
function fill(){const known=new Set(ALL_PREFECTURES);const more=[...new Set(D.flatMap(ar))].filter(x=>x&&!known.has(x)).sort((x,y)=>x.localeCompare(y,'ja'));const options=[...ALL_PREFECTURES,...more];['area'].forEach(id=>{const select=document.getElementById(id);const current=select.value;select.innerHTML=select.options[0].outerHTML+options.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');select.value=options.includes(current)?current:''})}
function detailLink(p){return 'provider.html?id='+encodeURIComponent(n(p.id));}
function card(p){
 let url=ur(p);try{if(new URL(url).protocol!=='https:')url=''}catch{url=''}
 const approved=p.editorial!==true,detail=approved?detailLink(p):'';
 const desc=n(p.description),limit=60,hasMore=desc.length>limit;
 const short=hasMore?desc.slice(0,limit).replace(/[\r\n]+/g,' ').trim()+'…':desc;
 const hasGallery=approved&&Array.isArray(p.images)&&p.images.length>0&&Boolean(window.MATEGallery);
 const media=p.editorial?mateEditorialThumb(p,"CARE"):(hasGallery?window.MATEGallery.render(p,"CARE",detail):mateApprovedThumb(p));
 const thumb=approved&&!hasGallery?media.replace('href="'+escapeHtml(url)+'"','href="'+escapeHtml(detail)+'"').replace(/target="_blank" rel="noopener noreferrer"/,'').replace('の公式サイトを開く','の掲載詳細を見る'):media;
 const longAction=hasMore?(approved?'<a class="result-inline-more" href="'+escapeHtml(detail)+'">続きを読む</a>':'<button type="button" class="result-inline-more" data-more-id="'+escapeHtml(n(p.id))+'">続きを読む</button>'):'';
 const area=ar(p).join('・')||'公式サイトでご確認ください';
 const category=n(p.category)||'サービス内容は公式サイトでご確認ください';
 const price=approved&&p.pricingNotes?'<p class="result-price" title="'+escapeHtml(n(p.pricingNotes))+'"><strong>料金目安：</strong>'+escapeHtml(n(p.pricingNotes).slice(0,55))+'</p>':'';
 return '<article class="result" id="listing-'+escapeHtml(n(p.id))+'">'+thumb+
  '<h3>'+escapeHtml(mateDisplayName(p))+'</h3>'+
  '<p class="result-quick-meta"><strong>対象エリア：</strong>'+escapeHtml(area)+'</p>'+
  '<p class="result-quick-meta"><strong>サービス：</strong>'+escapeHtml(category)+'</p>'+
  '<p class="result-description">'+escapeHtml(short)+(longAction?' '+longAction:'')+'</p>'+
  price+
  (approved?'<a class="provider-link" data-provider-id="'+escapeHtml(n(p.id))+'" href="'+escapeHtml(detail)+'">詳細を見る ↗</a>':
   (url?'<a class="provider-link" data-provider-id="'+escapeHtml(n(p.id))+'" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">公式サイトを見る ↗</a>':''))+
  '</article>';
}
document.addEventListener('click',function(e){
 const more=e.target.closest?.('[data-more-id]');if(!more)return;
 const p=D.find(x=>n(x.id)===more.dataset.moreId);if(!p||!p.editorial)return;
 const dialog=document.getElementById('reference-detail-dialog');if(!dialog)return;
 dialog.querySelector('[data-ref-name]').textContent=nm(p);
 dialog.querySelector('[data-ref-copy]').textContent=n(p.description);
 const anchor=dialog.querySelector('[data-ref-link]');anchor.href=ur(p);
 dialog.showModal();
});

let visibleLimit=18;
function refineBlock(total,through){
 const options=document.getElementById('area').innerHTML;
 return '<section class="care-results-refine" aria-label="シッター検索と絞り込み">'+
  '<div class="care-refine-heading"><strong>ここまで '+through+' / '+total+' 件</strong><span>探したい事業者がまだ見つからない方へ</span></div>'+
  '<form data-care-refine class="care-refine-form">'+
  '<label>キーワード<input name="refine-q" type="search" maxlength="100" autocomplete="off" placeholder="会社名・サービス内容" value="'+escapeHtml(document.getElementById('q').value)+'"></label>'+
  '<label>対象エリア<select name="refine-area">'+options+'</select></label>'+
  '<button type="submit">この条件で絞り込む</button>'+
  '<a href="#find" class="care-results-up">検索一覧へ戻る ↑</a></form></section>';
}
function render(){
 const query=n(document.getElementById('q').value).toLowerCase(),area=n(document.getElementById('area').value);
 let matches=D.filter(p=>(!query||JSON.stringify(p).toLowerCase().includes(query))&&(!area||ar(p).some(a=>a==='全国'||a===area||a.includes(area)||area.includes(a)&&ALL_PREFECTURES.includes(a))));
 matches=matches.slice().sort((a,b)=>Number(a.editorial===true)-Number(b.editorial===true)||(document.getElementById('sort').value==='name'?nm(a).localeCompare(nm(b),'ja'):0));
 const editorialCount=matches.filter(p=>p.editorial===true).length,approvedCount=matches.length-editorialCount;
 const shown=matches.slice(0,visibleLimit);
 document.getElementById('results-count').textContent=matches.length+'件';
 document.getElementById('results-count').setAttribute('aria-label',matches.length+'件の候補、'+shown.length+'件表示中。事業者確認済み'+approvedCount+'件、編集部の参考紹介'+editorialCount+'件');
 if(!matches.length){
  document.getElementById('results').innerHTML='<div class="empty"><h3>'+(D.length?'条件に合うシッターがありません':'新しい出会いを、準備しています。')+'</h3><p>'+(D.length?'エリアやキーワードを変えてみてください。':'掲載許可をいただいたシッター事業者から順次公開します。')+'</p><p><a href="consult.html?service=CARE">シッターについて相談する ↗</a></p><p><a href="guide-sitter-choice.html">初めてのベビーシッター選び ↗</a></p></div>';
  return;
 }
 const parts=[];
 shown.forEach((p,i)=>{parts.push(card(p));if(i===11&&shown.length>=13)parts.push(refineBlock(matches.length,i+1));});
 if(matches.length>shown.length){
  parts.push('<section class="care-results-pagination" aria-label="さらに一覧を見る">'+
    '<strong>表示中 '+shown.length+' / '+matches.length+' 件</strong><p>残りの事業者を見るか、条件で絞り込めます。</p>'+
    '<div class="care-pagination-actions"><button type="button" data-show-more>さらに '+Math.min(18,matches.length-shown.length)+' 件を見る</button>'+
    '<button type="button" data-show-all>すべての事業者を表示</button><a href="#find">検索・絞り込みに戻る ↑</a></div>'+
    '</section>');
 }else if(shown.length>12){parts.push(refineBlock(matches.length,shown.length));}
 document.getElementById('results').innerHTML=parts.join('');
 document.querySelectorAll('[data-care-refine] select[name="refine-area"]').forEach(el=>{el.value=area});
}
document.getElementById('results').addEventListener('click',event=>{
 if(event.target.closest('[data-show-more]')){visibleLimit+=18;render();}
 if(event.target.closest('[data-show-all]')){visibleLimit=D.length;render();}
});
document.getElementById('results').addEventListener('submit',event=>{
 const form=event.target.closest('[data-care-refine]');if(!form)return;
 event.preventDefault();
 document.getElementById('q').value=form.elements.namedItem('refine-q').value;
 document.getElementById('area').value=form.elements.namedItem('refine-area').value;
 visibleLimit=18;render();
 document.getElementById('find').scrollIntoView({behavior:'smooth',block:'start'});
});
var mateDeepLinkResolved=false;
function mateFocusListingHash(){
 if(mateDeepLinkResolved||!/^#listing-[a-z0-9_-]{6,95}$/i.test(location.hash))return;
 var id=location.hash.slice(1),target=document.getElementById(id);
 if(target){mateDeepLinkResolved=true;target.scrollIntoView({block:'center'});}
 else if(D.some(p=>'listing-'+n(p.id)===id)){visibleLimit=D.length;render();const found=document.getElementById(id);if(found){mateDeepLinkResolved=true;found.scrollIntoView({block:'center'});}}
}
function resetSearch(){for(const id of ['q','area'])document.getElementById(id).value='';visibleLimit=18;render()}
for(const id of ['q','area','sort'])document.getElementById(id).addEventListener(id==='q'?'input':'change',()=>{visibleLimit=18;render()});
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
 else status.textContent=D.length?'正式掲載と編集部の参考情報は区別して表示しています。':'現在、掲載シッター事業者を募集中です。';
 if(approvedResult.status==='rejected'||editorialResult.status==='rejected')status.classList.add('show-error');else status.classList.remove('show-error');
});

document.getElementById('results').addEventListener('click',event=>{const link=event.target.closest('a[data-provider-id]');if(link&&window.gtag){const id=String(link.dataset.providerId||'');if(/^[A-Za-z0-9_-]{1,80}$/.test(id)){gtag('event','provider_outbound',{service:'CARE',provider_id:id});gtag('event','mate_partner_click',{service:'CARE',partner_id:id})}}});
