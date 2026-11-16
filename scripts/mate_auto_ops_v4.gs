/**
 * MATE AutoOps V4: prospect CSV import, opt-out quarantine, low-volume
 * first-contact outreach and evidence-gated referral ledger.
 *
 * Install as an additional .gs file in the existing dedicated MATE Google Apps
 * Script project. Uses existing Sheets; does not alter form handlers or CMS.
 * Initial state: external outreach OFF. Internal review drafts are ON, max 3/day,
 * one per service, addressed only to the operator; no third-party email is sent.
 * Does NOT approve a listing or share family PII.
 * CSV input is limited to owner-approved, appropriately licensed HTTPS sources.
 *
 * Required Script Properties to enable actual mail:
 *   MATE_AUTO_SEND = ON
 *   MATE_OUTREACH_PHASE = PILOT (1/day), DAILY_30 (30 total/day), or the legacy phases
 *   Phase OFF or unset forbids all external sending even if other toggles are ON.
 *   MATE_SENDER_NAME = MATE運営事務局 (brand-only; never disclose personal name)
 *   MATE_SENDER_ADDRESS = verified full business address, stored privately in GAS properties
 *   MATE_LEGAL_ADDRESS_PAGE_VERIFIED = YES only once the public operator page
 *     shows legally sufficient sender name, actual address and contact details
 *   MATE_AUTO_SEND_LEGAL_REVIEWED = YES
 *   (optional) MATE_DAILY_CAP = 30 in DAILY_30 (global 30/day, fair allocation by eligibility)
 *   Monitoring BCC intentionally disabled. MATE_OWNER_COPY_EMAIL is ignored.
 *   MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED = YES, opt-in to vetted publicly posted business addresses
 *   (optional) MATE_PUBLIC_SITE_AUDIT = OFF, disables safe automatic public-site review
 */
const MATE_V4=Object.freeze({
  bookId:'1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ',
  account:'kosodatemate@gmail.com',
  sources:'収集元設定V1',leads:'営業候補_自動収集',
  sent:'営業送信ログV4',optouts:'配信停止V1',
  inquiries:'問い合わせ管理',referrals:'送客実績V1',
  maxCSVBytes:600000,maxNewLeadsPerRun:200,version:'2026-11-16-zero-send-diagnostics'
});
function mateV4Book_(){
  if(String(Session.getEffectiveUser().getEmail()||'').toLowerCase()!==MATE_V4.account)
    throw Error('MATE専用アカウントで実行してください');
  return SpreadsheetApp.openById(MATE_V4.bookId);
}
function mateV4Tab_(b,name){
  const s=b.getSheetByName(name);if(!s)throw Error('必須タブなし: '+name);return s;
}
function mateV4Rows_(s){
  const data=s.getDataRange().getDisplayValues();
  if(data.length<2)return [];
  const headings=data.shift();
  // Preserve physical row numbers even when a sheet has blank rows.
  // Source-status writes must never point to the wrong business.
  return data.map((r,i)=>({values:r,row:i+2}))
    .filter(x=>x.values.some(c=>String(c).trim()))
    .map(({values:r,row})=>{
      const o={_row:row};headings.forEach((h,j)=>o[h]=String(r[j]||'').trim());return o;
    });
}
function mateV4San_(s,n){
  const v=String(s==null?'':s).trim().replace(/[\x00-\x08\x0b-\x1f]/g,'').slice(0,n);
  return /^[=+\-@]/.test(v)?"'"+v:v;
}
function mateV4Append_(s,values){s.appendRow(values.map(v=>mateV4San_(v,900)))}
function mateV4BatchAppend_(s,rows){
  if(!rows.length)return 0;
  const width=rows[0].length;
  if(rows.some(r=>r.length!==width))throw Error('CSV batch width mismatch');
  const safe=rows.map(r=>r.map(v=>mateV4San_(v,900)));
  s.getRange(s.getLastRow()+1,1,safe.length,width).setValues(safe);
  return safe.length;
}
function mateV4Jst_(){return Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd HH:mm:ss')}
function mateV4Date_(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s)))return null;const d=new Date(s+'T00:00:00+09:00');return Number.isFinite(+d)?d:null}
function mateV4Fresh_(s,maxDays){
  const d=mateV4Date_(s);return !!d&&Date.now()-d.getTime()>=0&&Date.now()-d.getTime()<=maxDays*86400000;
}
// Apps Script V8 does NOT expose the browser's URL constructor.
function mateV4Host_(raw){
  const s=String(raw||'').trim();
  if(s.length>500||/[\\\s]/.test(s))return '';
  const m=s.match(/^https:\/\/([^\/?#:@]+)(?::(\d+))?(?:[\/?#]|$)/i);
  if(!m||m[2])return '';
  const host=m[1].toLowerCase().replace(/^www\./,'');
  // Imported spreadsheet values must never direct UrlFetchApp to literal IPs
  // or internal/reserved hostnames. Official businesses have public DNS names.
  if(/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)||
     /\.(?:local|localhost|internal|invalid|test|example|onion)$/.test(host)||
     /^(?:localhost|metadata\.google\.internal)$/i.test(host))return '';
  if(host.length>253||!host.includes('.')||!host.split('.').every(
    part=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)))return '';
  return host;
}
function mateV4Https_(s){return !!mateV4Host_(s)}
/**
 * Public municipal data often stores official sites as http:// or www...
 * Upgrade to HTTPS as a DISCOVERY HINT only. Never use this conversion
 * as evidence that the HTTPS site exists or permits outreach.
 */
function mateV4CandidateHttps_(raw){
  const x=String(raw||'').trim();
  if(!x||x.length>500||/[\\\s<>"'@]/.test(x))return '';
  const url=/^https:\/\//i.test(x)?x:
    /^http:\/\//i.test(x)?'https://'+x.slice(7):
    /^www\./i.test(x)?'https://'+x:'';
  return mateV4Host_(url)?url:'';
}

function mateV4SameBusinessHost_(a,b){
  const clean=x=>String(mateV4Host_(x)||'').replace(/^www\./,'');
  const ha=clean(a),hb=clean(b);
  return !!ha&&ha===hb;
}
function mateV4Email_(s){
  const x=String(s||'').trim().toLowerCase();
  if(!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(x)||x.length>250)return '';
  // Avoid mistakenly marketing to private personal inboxes.
  // Block reserved example domains; these are not real business recipients.
  if(/@(example\.(?:com|net|org|jp)|example\.co\.jp)$/i.test(x))return '';
  if(/@(gmail\.com|yahoo\.co\.jp|yahoo\.com|icloud\.com|outlook\.com|hotmail\.com)$/i.test(x))return '';
  // Regular image / font assets such as mail@2x.png are not mailboxes.
  // A regex match inside a website's markup is insufficient evidence.
  if(/\.(?:png|jpe?g|gif|webp|svg|ico|bmp|avif|tiff?|css|js|json|xml|woff2?|ttf|otf|map|pdf|html?|mp4|webm|zip)$/i.test(x))return '';
  const domain=x.split('@')[1];
  if(!domain.split('.').slice(0,-1).every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))return '';
  return x;
}
/**
 * Owner-requested permanent exclusion: never solicit CodeCamp or CodeCampKIDS,
 * including group-branded classrooms and domain mailboxes. This is a hard
 * outbound gate independent of mutable lead statuses or stale GAS properties.
 */
function mateV4OwnerBlocked_(lead){
  const fields=typeof lead==='string'?[lead]:[
    lead['事業者名'],lead['公式URL'],lead['窓口URL'],
    lead['確認元URL'],lead['業務用メール']];
  const combined=fields.map(v=>String(v||'').normalize('NFKC').toLowerCase()).join(' ');
  return /code[\s._-]*camp|コード[\s　]*キャンプ/i.test(combined)||
    /@(?:[a-z0-9-]+\.)*codecamp(?:kids)?\.(?:jp|co\.jp|com)\b/i.test(combined);
}
function mateV4Key_(service,website,name){
  const host=mateV4Host_(website);if(!host)throw Error('Invalid HTTPS website');
  const input=service+'|'+host+'|'+String(name||'').trim().toLowerCase();
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,input)
    .slice(0,14).map(x=>('0'+((x+256)%256).toString(16)).slice(-2)).join('');
}
function mateV4SourceCsv_(url){
  if(!mateV4Https_(url))throw Error('CSVは公開HTTPS URLのみ');
  const resp=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true,timeout:15000});
  if(resp.getResponseCode()!==200)throw Error('CSV HTTP '+resp.getResponseCode());
  const blob=resp.getBlob();
  if(blob.getBytes().length>MATE_V4.maxCSVBytes)throw Error('CSV exceeds size limit');
  // Japanese municipality CSVs may be UTF-8 with BOM or Windows Shift_JIS.
  // Only decode for discovery; never use CSV assertions as sales permission.
  const parse=encoding=>{
    const rows=Utilities.parseCsv(blob.getDataAsString(encoding).replace(/^\uFEFF/,''));
    const keys=(rows.shift()||[]).map(x=>String(x).replace(/^\uFEFF/,'').trim().toLowerCase().replace(/\s+/g,''));
    return {keys,rows};
  };
  let parsed=parse('UTF-8');
  if(parsed.keys.some(k=>k.includes('\uFFFD')))parsed=parse('Shift_JIS');
  const keys=parsed.keys,rows=parsed.rows;
  const required=['service','name','website','region','email','contact_url','source_url','mail_basis','checked_at','solicitation_prohibited'];
  if(required.every(k=>keys.includes(k)))
    return rows.map(row=>{const o={};keys.forEach((k,i)=>o[k]=String(row[i]||'').trim());return o});
  const columns={
    name:['事業者名','法人名','企業名','教室名','施設名','施設名称','名称','事業所名','観光施設名','施設・スポット名','店舗名','事業者名称','施設名称(日本語)'],
    website:['公式url','ホームページ','ホームページurl','ウェブサイト','ウェブサイトurl','webサイト','webサイトurl','url','公式サイト','公式サイトurl','関連url','リンク先url','施設url','施設ホームページ','サイトurl','ホームページアドレス','公式ホームページ','ウェブページ','url(公式)','website','weburl','施設url(公式)'],
    region:['都道府県','住所','所在地','地域','エリア','所在地_連結表記','所在地(住所)'],
    email:['メール','メールアドレス','公開メール','e-mail','email'],
    contact_url:['問い合わせurl','問合せurl','お問い合わせurl'],
  };
  const at=k=>{for(const alias of columns[k]){const i=keys.indexOf(alias);if(i>=0)return i}return -1};
  const indexes={};for(const key of Object.keys(columns))indexes[key]=at(key);
  if(indexes.name<0){
    const missing='名称';
    throw Error('CSV列不足 ('+missing+') / 見出し: '+keys.slice(0,12).join(',').slice(0,125));
  }
  return rows.map(row=>{
    const get=k=>indexes[k]<0?'':String(row[indexes[k]]||'').trim();
    return {name:get('name'),website:mateV4CandidateHttps_(get('website')),region:get('region'),
      email:get('email'),contact_url:mateV4CandidateHttps_(get('contact_url')),service:'',
      source_url:url,mail_basis:'UNVERIFIED',checked_at:'',
      solicitation_prohibited:'FALSE'};
  });
}
/**
 * The owner must provide a licensed, public HTTPS CSV in 収集元設定V1.
 * Each source row needs 再利用許諾確認=確認済み and 有効=TRUE.
 * No search-engine scraping, personal contacts, or inferred email addresses.
 */
function mateV4SeedExistingCRM(){
  const b=mateV4Book_(),dest=mateV4Tab_(b,MATE_V4.leads);
  const existing=new Set(mateV4Rows_(dest).map(x=>x['重複キー']).filter(Boolean));
  const rows=mateV4Rows_(mateV4Tab_(b,'3サービス営業リスト'));
  let added=0;
  for(const x of rows){
    if(added>=MATE_V4.maxNewLeadsPerRun)break;
    const svc=x['サービス'],name=x['企業・教室名'],url=x['公式・窓口URL'];
    if(mateV4OwnerBlocked_({'事業者名':name,'公式URL':url,'業務用メール':x['メール（未再確認）']}))continue;
    if(!['CARE','SPARK','PLAY'].includes(svc)||!name||!mateV4Https_(url))continue;
    const key=mateV4Key_(svc,url,name);
    if(existing.has(key))continue;
    mateV4Append_(dest,[
      'CRM-'+key,mateV4Jst_(),svc,name,url,x['エリア']||'',
      mateV4RoleEmail_(x['メール（未再確認）']),url,url,'UNVERIFIED',x['確認日']||'',
      key,'FALSE','窓口確認待ち','既存CRMより引継ぎ。公開メールは自動送信の許可証拠ではない。',
      'CRM ID='+x['ID']
    ]);
    existing.add(key);added++;
  }
  return added;
}
/** Import extra *existing* sector directories into review-only prospect queue.
 * These are NOT opt-in records: never place them in the send-ready state.
 * Dedupe by official HTTPS host+company+service, across the main CRM and queue.
 */
function mateV4SeedSectorDirectories(){
  const b=mateV4Book_(),dest=mateV4Tab_(b,MATE_V4.leads);
  const queue=mateV4Rows_(dest),seen=new Set(queue.map(x=>x['重複キー']).filter(Boolean));
  const seenBusinessHosts=new Set(queue.filter(x=>['CARE','SPARK','PLAY'].includes(x['サービス']))
    .map(x=>x['サービス']+'|'+mateV4Host_(x['公式URL'])).filter(x=>!x.endsWith('|')));
  // Same company may have a dedicated booking subdomain and a separate
  // corporate domain. Dedupe verified entity names too, not just URLs.
  const companyKey=name=>String(name||'').replace(/\s|　/g,'')
    .replace(/(?:特定非営利活動法人|認定NPO法人|NPO法人|株式会社|合同会社|有限会社|一般社団法人|社会福祉法人)/g,'')
    .toLowerCase();
  const seenCompanies=new Set(queue.filter(x=>['CARE','SPARK','PLAY'].includes(x['サービス']))
    .map(x=>x['サービス']+'|'+companyKey(x['事業者名'])).filter(x=>!x.endsWith('|')));
  const crm=mateV4Rows_(mateV4Tab_(b,'3サービス営業リスト'));
  for(const x of crm){
    try{if(['CARE','SPARK','PLAY'].includes(x['サービス'])&&mateV4Https_(x['公式・窓口URL']))
      seen.add(mateV4Key_(x['サービス'],x['公式・窓口URL'],x['企業・教室名']));
    }catch(e){}
  }
  // Reuse already curated operator sheets. Do NOT import private mailbox
  // addresses, approval claims or stale previous review flags from them.
  // They are discovery leads only, never a permission to email.
  const sources=[
    {tab:'SPARK営業候補',service:'SPARK',name:'企業・教室名',site:'公式・窓口URL',region:'都県・対象'},
    {tab:'営業管理DB',service:'CARE',name:'事業者名',site:'公式サイト',region:'エリア'},
    {tab:'東京都認定_営業優先',service:'CARE',name:'事業所名',site:'公式サイト',region:'エリア'},
    {tab:'今すぐ営業リスト',service:'CARE',name:'統合営業先名',site:'公式サイト',region:'届出元・エリア'},
    {tab:'権限移譲区市_営業候補',service:'CARE',name:'事業所名',site:'公式サイト',region:'自治体'}
  ];
  let total=0,byService={CARE:0,SPARK:0,PLAY:0};
  for(const source of sources){
    const rows=mateV4Rows_(mateV4Tab_(b,source.tab));
    for(const x of rows){
      if(total>=MATE_V4.maxNewLeadsPerRun)break;
      const name=String(x[source.name]||'').trim(),site=x[source.site];
      if(!name||!mateV4Https_(site)||/テスト|架空|ダミー/.test(name)||
         mateV4OwnerBlocked_({'事業者名':name,'公式URL':site}))continue;
      const host=mateV4Host_(site),hostKey=source.service+'|'+host;
      const company=source.service+'|'+companyKey(name);
      if(!host||seenBusinessHosts.has(hostKey)||seenCompanies.has(company))continue;
      // Do not solicit natural persons, generic institutions, or personal
      // Gmail accounts solely because they appear in government directories.
      if(source.tab==='東京都認定_営業優先'&&
         !/(株式会社|有限会社|合同会社|一般社団法人|特定非営利活動法人|NPO法人|社会福祉法人)/.test(name)&&
         !/^(?:ベビーシッターのHAS|Humanity Sitter|マザーズシッター)$/.test(name))continue;
      let key;
      try{key=mateV4Key_(source.service,site,name)}catch(e){continue}
      if(seen.has(key))continue;
      mateV4Append_(dest,[
        'SECTOR-'+key,mateV4Jst_(),source.service,name,site,x[source.region]||'',
        '',site,site,'UNVERIFIED','',key,'未確認','窓口確認待ち',
        '既存の'+source.tab+'から候補発見。公式の業務用メール・営業拒否表示・最新根拠は自動監査まで未確認。送信不可。',
        '公式企業サイトで確認できた場合のみ候補昇格。掲載・契約許諾とは無関係。'
      ]);
      seen.add(key);seenBusinessHosts.add(hostKey);seenCompanies.add(company);
      total++;byService[source.service]++;
    }
  }
  return {total,byService};
}
/** Business fit is a rank hint only; never implies solicitation consent. */
function mateV4FitScore_(x){
  const name=String(x['事業者名']||'').toLowerCase();
  const tests={
    CARE:/ベビーシッター|シッター|訪問保育|病児|保育|nanny|sitter|child.?care|送迎/i,
    SPARK:/ピアノ|音楽|music|英語|english|プログラミング|coding|ロボット|ダンス|体操|バレエ|スクール|教室|school/i,
    PLAY:/体験|ワークショップ|陶芸|工房|農業|収穫|親子|craft|pottery|museum|ミュージアム|アート|キャンプ/i
  };
  return tests[x['サービス']]&&tests[x['サービス']].test(name)?3:1;
}
/** Prevent a second pitch to the same email even if a previous campaign
 * was sent manually (outside the V4 ledger). On history-read failure, do
 * NOT send. Gmail threads may also contain replies, so check actual sender.
 */
function mateV4HistoricCampaignRecipients_(){
  // Gmail does not offer a scalable full-history search on every hourly run.
  // Legacy (pre-V4) messages live in a fixed cutover window; the append-only
  // V4 sheet protects all subsequent campaign recipients indefinitely.
  // A recent mailbox scan catches manual sends and logging failures.
  const queries=[
    'in:sent after:2025/11/11 before:2026/11/12 "MATE" "無料掲載"',
    'in:sent newer_than:7d "MATE" "無料掲載"'
  ];
  const recipients=new Set();
  for(const query of queries){
    const threads=GmailApp.search(query,0,350);
    if(threads.length>=350)
      throw Error('重複防止用Gmail照合の上限に達しました: '+query);
    for(const thread of threads)for(const msg of thread.getMessages()){
      const subject=String(msg.getSubject()||'');
      const from=String(msg.getFrom()||'').toLowerCase();
      if(!/【MATE (CARE|SPARK|PLAY)】/.test(subject)||!/無料掲載/.test(subject)||
         !from.includes(MATE_V4.account))continue;
      const to=String(msg.getTo()||'').toLowerCase();
      for(const match of to.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[])
        recipients.add(match);
    }
  }
  return recipients;
}
/** Round-robin across service buckets, with category-fit ordering within each.
 * One campaign per recipient globally: never prioritize volume over relevance.
 */
function mateV4BalancedQueue_(rows,today){
  const services=['CARE','SPARK','PLAY'],buckets={CARE:[],SPARK:[],PLAY:[]};
  // If one operator has multiple MATE service matches, use the best-fitting
  // pitch once, rather than letting the arbitrary service order choose it.
  const bestByEmail=new Map(),unaddressed=[];
  for(const x of rows){
    if(!buckets[x['サービス']]||mateV4OwnerBlocked_(x))continue;
    const email=mateV4Email_(x['業務用メール']);
    if(!email){unaddressed.push(x);continue}
    const previous=bestByEmail.get(email);
    if(!previous||mateV4FitScore_(x)>mateV4FitScore_(previous))
      bestByEmail.set(email,x);
  }
  for(const x of [...bestByEmail.values(),...unaddressed])
    buckets[x['サービス']].push(x);
  for(const service of services)buckets[service].sort((a,b)=>
    mateV4FitScore_(b)-mateV4FitScore_(a)||
    String(b['根拠確認日時']||'').localeCompare(String(a['根拠確認日時']||'')));
  const offset=Number(String(today).replace(/-/g,''))%3,order=services.slice(offset).concat(services.slice(0,offset));
  const result=[];
  while(order.some(s=>buckets[s].length))for(const service of order)
    if(buckets[service].length)result.push(buckets[service].shift());
  return result;
}
/**
 * Discover organization-level CSV sources in BODIK's official CKAN catalogue.
 * Metadata and licence checks are not permission to solicit recipients.
 * Only government-published, CC BY/CC0 CSV resources hosted by BODIK are
 * registered; lead addresses and claims of consent are never imported here.
 * Bounded: at most 3 catalogue queries and 6 NEW source registrations/day.
 */
function mateV4DiscoverLicensedPublicCsvSources(){
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty('MATE_SOURCE_CATALOG_DISCOVERY')==='OFF')return 'OFF';
  const today=mateV4Jst_().slice(0,10);
  const dateKey='MATE_SOURCE_CATALOG_DISCOVERY_LAST';
  if(p.getProperty(dateKey)===today)return 'ALREADY_CHECKED';
  const b=mateV4Book_(),tab=mateV4Tab_(b,MATE_V4.sources);
  const sources=mateV4Rows_(tab);
  const seen=new Set(sources.map(x=>x['サービス']+'|'+String(x['取得元CSV HTTPS URL']||'').trim()));
  const sourceCeiling=1200;
  if(seen.size>=sourceCeiling)return {mode:'SOURCE_LIMIT',sourceCount:seen.size};
  // Discover across two different keywords per service each day.
  // At most six catalogue queries, with a separate cursor per keyword.
  const dayNo=Number(today.replace(/-/g,''));
  const searches=[
    {service:'CARE',queries:['居宅訪問型保育','ベビーシッター','訪問保育','病児保育','保育事業者','子育て支援事業所','認可外保育施設'],
      fit:/居宅訪問|ベビーシッター|訪問保育|病児保育|保育事業者|子育て支援事業所|認可外保育施設/},
    {service:'SPARK',queries:['スポーツ教室','文化教室','音楽教室','学習塾','スポーツクラブ','英会話教室','プログラミング教室','ピアノ教室','各種学校'],
      fit:/スポーツ教室|文化教室|音楽教室|学習塾|習い事|スポーツクラブ|英会話教室|プログラミング教室|ピアノ教室|各種学校/},
    {service:'PLAY',queries:['観光施設一覧','体験施設','博物館一覧','体験活動','文化施設一覧','レジャー施設','科学館','農業体験','ワークショップ'],
      fit:/観光施設|体験施設|体験活動|博物館|ミュージアム|文化施設|レジャー施設|科学館|農業体験|ワークショップ/}
  ];
  let found=0,queried=0,failures=0,checked=0;
  const queries=[...searches,...searches];
  for(const [index,item] of queries.entries()){
    if(found>=24||seen.size>=sourceCeiling)break;
    try{
      const queryIndex=(dayNo+Math.floor(index/searches.length))%item.queries.length;
      const query=item.queries[queryIndex];
      // A cursor belongs to a keyword, not an entire service category.
      const cursorKey='MATE_CATALOG_CURSOR_'+item.service+'_'+queryIndex;
      const cursor=Math.max(0,Number(p.getProperty(cursorKey)||0)||0);
      const url='https://data.bodik.jp/api/3/action/package_search?q='+
        encodeURIComponent(query)+'&rows=60&start='+cursor+'&sort=metadata_modified+desc';
      const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false,timeout:14000,
        headers:{Accept:'application/json'}});
      if(response.getResponseCode()!==200)throw Error('catalog HTTP status');
      const json=JSON.parse(response.getContentText('UTF-8'));
      if(json.success!==true||!Array.isArray(json.result&&json.result.results))
        throw Error('unexpected catalog schema');
      queried++;
      const returned=json.result.results.length;
      const total=Math.max(0,Number(json.result.count)||0);
      p.setProperty(cursorKey,returned===0||(total>0&&cursor+returned>=total)?'0':String(cursor+returned));
      for(const dataset of json.result.results){
        checked++;
        if(found>=24||seen.size>=sourceCeiling)break;
        const title=String(dataset.title||'');
        const publisher=String(dataset.organization&&dataset.organization.title||'');
        const license=String(dataset.license_id||'').toLowerCase();
        if(!item.fit.test(title)||!/(?:都|道|府|県|市|区|町|村)$/.test(publisher)||
           !/^(?:cc-by(?:-[0-9.]+)?(?:-jp)?|cc-zero|cc0)$/.test(license))continue;
        if(/個人情報|個人名簿|園児名簿|保護者名簿|世帯|相談履歴|児童名簿/.test(title))continue;
        const resources=Array.isArray(dataset.resources)?dataset.resources:[];
        const csv=resources.find(resource=>{
          const u=String(resource.url||'');
          const size=Number(resource.size||0);
          return /^csv$/i.test(String(resource.format||''))&&
            /^https:\/\/data\.bodik\.jp\/dataset\//i.test(u)&&
            (size===0||size<=MATE_V4.maxCSVBytes)&&
            !/名簿|個人情報|児童名|保護者|世帯|相談記録/.test(String(resource.name||''));
        });
        if(!csv)continue;
        const csvUrl=String(csv.url);
        const key=item.service+'|'+csvUrl;
        if(seen.has(key))continue;
        const name=(publisher+' '+title+'（BODIK '+license.toUpperCase()+'）').slice(0,130);
        mateV4Append_(tab,[item.service,name,csvUrl,'確認済み','TRUE','','CKAN公開メタデータでライセンス・自治体発行を確認。掲載や営業への同意ではない。']);
        seen.add(key);found++;
      }
    }catch(err){
      failures++;
      console.log('SOURCE_CATALOG_LOOKUP_FAILED '+item.service+'; retry next day');
    }
  }
  // Even a complete API outage must not trigger 3 new searches hourly.
  // A fresh search is attempted on the next JST day instead.
  p.setProperty(dateKey,today);
  return {queried,metadataChecked:checked,registered:found,failures,
    autoEmailApproval:false,onlyPublicLicensedCSV:true};
}

/**
 * Fair CSV-source scheduler: unimported/least-recently-checked sources first,
 * round-robin CARE, SPARK and PLAY. Prevents the first eight rows from starving
 * all later public datasets as the source registry grows.
 */
function mateV4SourceDue_(src,today){
  const last=String(src['最終取込日時']||''),url=String(src['取得元CSV HTTPS URL']||'');
  const overture=/raw\.githubusercontent\.com\/kosuke-saito0807\/mate\/main\/data\/mate_overture_(?:discovery|recent)\.csv/.test(url);
  const date=last.slice(0,10);
  if(overture){
    if(date!==today)return true;
    // Eight updates/day in the free rolling source; maximum once per JST 3h slot.
    const currentHour=Number(mateV4Jst_().slice(11,13));
    const lastHour=Number(last.slice(11,13));
    return Number.isFinite(currentHour)&&Number.isFinite(lastHour)&&
      Math.floor(currentHour/3)>Math.floor(lastHour/3);
  }
  if(date===today)return false;
  // Licensed municipal inventories producing zero new businesses should not
  // consume the limited GAS runtime every morning. Refresh every two weeks.
  // Failed fetches remain eligible the following day, and newly added sources
  // still run immediately.
  if(/^0 件取込/.test(String(src['前回結果']||''))){
    const previous=Date.parse(date+'T00:00:00+09:00');
    const now=Date.parse(today+'T00:00:00+09:00');
    if(Number.isFinite(previous)&&Number.isFinite(now)&&
       now>=previous&&now-previous<14*86400000)return false;
  }
  return true;
}

function mateV4BalancedSourceQueue_(sources,today){
  const services=['CARE','SPARK','PLAY'],buckets={CARE:[],SPARK:[],PLAY:[]};
  for(const src of sources){
    const svc=src['サービス'],last=String(src['最終取込日時']||'');
    if(!buckets[svc]||src['有効']!=='TRUE'||
       src['再利用許諾確認']!=='確認済み'||
       !mateV4Https_(src['取得元CSV HTTPS URL'])||
       !mateV4SourceDue_(src,today))continue;
    buckets[svc].push(src);
  }
  for(const service of services)buckets[service].sort((a,b)=>
    String(a['最終取込日時']||'').localeCompare(String(b['最終取込日時']||'')));
  const queue=[];
  while(services.some(service=>buckets[service].length)){
    for(const service of services)if(buckets[service].length)
      queue.push(buckets[service].shift());
  }
  return queue;
}
/**
 * Raw prospect stage: missing official websites never become sendable leads.
 * These are only public organizational/facility names from permitted datasets.
 * Do not store phone numbers, personal email addresses or street addresses.
 */
function mateV4NameOnlyKey_(service,name,region){
  const text=[service,String(name||'').normalize('NFKC').replace(/\s/g,'').toLowerCase(),
    String(region||'').normalize('NFKC').replace(/\s/g,'').toLowerCase()].join('|');
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text)
    .slice(0,14).map(x=>('0'+((x+256)%256).toString(16)).slice(-2)).join('');
}
function mateV4CandidateRegion_(raw){
  const txt=String(raw||'').normalize('NFKC').trim();
  const match=txt.match(/^(?:東京都|北海道|大阪府|京都府|.{2,3}県)(?:[^0-9]{0,12}[市区町村])?/);
  return match?match[0].slice(0,25):'';
}
function mateV4StageNameOnly_(sheet,seen,x,service,sourceUrl){
  const name=String(x.name||'').trim();
  const region=mateV4CandidateRegion_(x.region);
  if(!name||name.length<4||name.length>120||!region||
     /テスト|ダミー|個人情報|園児名簿|児童名簿/.test(name)||
     /^[一-龥]{2,5}$/.test(name)||
     mateV4OwnerBlocked_({'事業者名':name})||
     !mateV4Https_(sourceUrl))return false;
  const key=mateV4NameOnlyKey_(service,name,region);
  if(seen.has(key))return false;
  // Discovery-only and never an email-eligible state.
  mateV4Append_(sheet,[key,mateV4Jst_(),service,name,region,sourceUrl,
    '公式URL未確認','自治体データの公開名称のみ。事業者性・対象年齢・公式URL・窓口・利用許可は未確認。送信禁止。']);
  seen.add(key);return true;
}

/**
 * General-web prospect discovery via the documented Brave Search API.
 * An operator-owned API token is required in private Script Properties:
 * MATE_BRAVE_SEARCH_API_KEY. No token => no requests or paid API usage.
 * Search results go ONLY to a review queue; they are never approved for mail.
 * The daily search budget is 6 queries (<=120 results before exclusions).
 */
/**
 * API-key-free optional candidate discovery from OpenStreetMap Overpass.
 * Private.coffee permits commercial use, but shared infrastructure requires
 * strict fair-use: ONE small geographical query/day, no parallel requests.
 * OSM ODbL data stays in a separate unattributed-to-sales staging queue.
 * No contact details or emails are extracted; NEVER auto-send from map data.
 */
function mateV4DiscoverFreeOsmCandidates(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('MATE_FREE_OSM_DISCOVERY')==='OFF')return 'OFF';
  const today=mateV4Jst_().slice(0,10),key='MATE_FREE_OSM_LAST';
  if(props.getProperty(key)===today)return 'ALREADY_CHECKED';
  // Reserve first. Public services must not be hammered on failed requests.
  props.setProperty(key,today);
  const b=mateV4Book_(),sheet=mateV4Tab_(b,'営業候補_Web検索_未確認');
  const existing=mateV4Rows_(sheet),verified=mateV4Rows_(mateV4Tab_(b,MATE_V4.leads));
  const seen=new Set([
    ...existing.map(x=>x['サービス']+'|'+mateV4Host_(x['候補URL'])),
    ...verified.map(x=>x['サービス']+'|'+mateV4Host_(x['公式URL']))
  ].filter(x=>!x.endsWith('|')));
  // One bounded neighbourhood per day across a large Japanese city pool.
  // 24 cities * 9 distinct tiles = 216 days before a full repetition.
  // This increases reach WITHOUT increasing public API call frequency.
  const centers=[
    ['東京',35.680,139.735],['横浜',35.462,139.628],
    ['大阪',34.685,135.500],['名古屋',35.172,136.907],
    ['福岡',33.591,130.404],['札幌',43.063,141.352],
    ['神戸',34.689,135.195],['京都',35.011,135.768],
    ['川崎',35.530,139.699],['さいたま',35.861,139.645],
    ['千葉',35.607,140.107],['仙台',38.268,140.870],
    ['広島',34.395,132.456],['静岡',34.975,138.383],
    ['浜松',34.711,137.726],['岡山',34.665,133.919],
    ['熊本',32.803,130.708],['北九州',33.883,130.875],
    ['新潟',37.916,139.036],['金沢',36.561,136.656],
    ['宇都宮',36.558,139.883],['高松',34.342,134.046],
    ['鹿児島',31.597,130.558],['那覇',26.213,127.680]
  ];
  const dateDays=Math.floor(Date.parse(today+'T00:00:00Z')/86400000);
  const tileIndex=dateDays%(centers.length*9);
  const city=centers[Math.floor(tileIndex/9)];
  const tile=tileIndex%9,dx=(tile%3)-1,dy=Math.floor(tile/3)-1;
  // Approx 5-7 km per box; no worldwide or whole-city Overpass query.
  const lat=city[1]+dy*0.055,lon=city[2]+dx*0.075;
  const area={name:city[0]+' '+(tile+1)+'/9',
    box:[lat-0.025,lon-0.035,lat+0.025,lon+0.035]
      .map(x=>Number(x.toFixed(5)))};
  const bbox=area.box.join(',');
  // Require a known business site; omit personal phone/address/email tags.
  const query='[out:json][timeout:18][maxsize:12000000];('+
    'nwr["website"]["name"]["leisure"~"^(sports_centre|dance|fitness_centre)$"]('+bbox+');'+
    'nwr["website"]["name"]["amenity"~"^(arts_centre|music_school|language_school)$"]('+bbox+');'+
    'nwr["website"]["name"]["shop"~"^(craft|art|toys)$"]('+bbox+');'+
    'nwr["website"]["name"]["club"~"^(sport|music)$"]('+bbox+');'+
    ');out tags 125;';
  try{
    const response=UrlFetchApp.fetch('https://overpass.private.coffee/api/interpreter',{
      method:'post',contentType:'application/x-www-form-urlencoded',
      payload:'data='+encodeURIComponent(query),muteHttpExceptions:true,
      followRedirects:false,timeout:25000,
      headers:{'User-Agent':'MATE-ProspectDiscovery/1.0 (https://care.kosodatemate.jp/operator.html)',
        Accept:'application/json'}});
    if(response.getResponseCode()!==200)
      return {area:area.name,status:'HTTP_'+response.getResponseCode(),added:0};
    const json=JSON.parse(response.getContentText('UTF-8'));
    const records=Array.isArray(json.elements)?json.elements:[];
    let added=0,skipped=0;
    for(const item of records){
      const tags=item.tags||{},site=mateV4CandidateHttps_(tags.website||'');
      const host=mateV4Host_(site),name=String(tags.name||'').trim();
      const category=tags.leisure||tags.amenity||tags.shop||tags.club||'';
      const service=/^(sports_centre|dance|fitness_centre|music_school|language_school|sport|music)$/.test(category)?
        'SPARK':'PLAY';
      const dedupe=service+'|'+host;
      if(!host||!name||name.length<4||name.length>130||seen.has(dedupe)||
         mateV4OwnerBlocked_({'事業者名':name,'公式URL':site})){
        skipped++;continue;
      }
      mateV4Append_(sheet,['OSM-'+service+'-'+item.type+'-'+item.id,mateV4Jst_(),service,
        name,site,'OpenStreetMap '+area.name,
        '公式URL・運営者未確認',
        '© OpenStreetMap contributors / ODbL; map record is discovery only. '+
          '営業メール送信不可。公式サイト・事業者性・窓口・営業拒否表示の独立確認が必要。']);
      seen.add(dedupe);added++;
    }
    return {area:area.name,received:records.length,added,skipped,
      sendable:0,licence:'ODbL',source:'OpenStreetMap'};
  }catch(e){
    console.log('OSM_DISCOVERY_FAILED '+String(e).slice(0,120));
    return {area:area.name,status:'FETCH_FAILED',added:0};
  }
}

function mateV4DiscoverGeneralWebProspects(){
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty('MATE_WEB_SEARCH_DISCOVERY')==='OFF')return 'OFF';
  const token=String(p.getProperty('MATE_BRAVE_SEARCH_API_KEY')||'').trim();
  if(!token)return 'WEB_SEARCH_KEY_NOT_CONFIGURED_NO_REQUESTS';
  const today=mateV4Jst_().slice(0,10),key='MATE_WEB_SEARCH_LAST';
  if(p.getProperty(key)===today)return 'ALREADY_SEARCHED';
  // Reserve first: transient errors must not cause repeated paid API calls.
  p.setProperty(key,today);
  const b=mateV4Book_(),tab=mateV4Tab_(b,'営業候補_Web検索_未確認');
  const existing=mateV4Rows_(tab);
  const leads=mateV4Rows_(mateV4Tab_(b,MATE_V4.leads));
  const seen=new Set([
    ...existing.map(x=>x['サービス']+'|'+mateV4Host_(x['候補URL'])),
    ...leads.map(x=>x['サービス']+'|'+mateV4Host_(x['公式URL']))
  ].filter(x=>!x.endsWith('|')));
  const blockedHost=/^(?:google\.|yahoo\.|bing\.|brave\.|facebook\.|instagram\.|tiktok\.|twitter\.|x\.com$|youtube\.|tabelog\.|map\.|maps\.|prtimes\.|note\.|ameblo\.|rakuten\.|amazon\.|wantedly\.|townwork\.|indeed\.|coeteco\.|kodomo\.|ekiten\.|en-hyouban\.|fc-research\.|acsa\.|city\.|pref\.|gov\.|wikipedia\.|data\.bodik\.)/i;
  const dayNumber=Number(today.replace(/-/g,''));
  const sets=[
    {service:'CARE',terms:['ベビーシッター 会社 公式サイト お問い合わせ','訪問保育 法人 公式サイト','病児保育 訪問 サービス 会社','産前産後ケア 家事育児サポート 法人']},
    {service:'SPARK',terms:['子供 プログラミング教室 運営会社 公式','子ども ピアノ教室 法人 公式','幼児 英語教室 株式会社 公式','子供 ロボット教室 フランチャイズ 会社 公式','子供 体操教室 運営 法人 公式']},
    {service:'PLAY',terms:['親子 ワークショップ 運営 株式会社 公式','子ども 工作体験 企業 イベント 公式','親子 農業体験 運営 会社','子供 体験プログラム 事業者 公式']}
  ];
  let queries=0,added=0,skipped=0,errors=0;
  for(const set of sets){
    for(let n=0;n<2;n++){
      const term=set.terms[(dayNumber+n)%set.terms.length];
      try{
        const u='https://api.search.brave.com/res/v1/web/search?q='+
          encodeURIComponent(term)+'&country=JP&search_lang=ja&count=20&offset=0&safesearch=strict';
        const response=UrlFetchApp.fetch(u,{muteHttpExceptions:true,followRedirects:false,timeout:14000,
          headers:{'X-Subscription-Token':token,Accept:'application/json'}});
        queries++;
        if(response.getResponseCode()!==200){errors++;continue}
        const payload=JSON.parse(response.getContentText('UTF-8'));
        const results=payload.web&&Array.isArray(payload.web.results)?payload.web.results:[];
        for(const item of results){
          const rawUrl=String(item.url||'');
          const url=mateV4CandidateHttps_(rawUrl);
          const host=mateV4Host_(url);
          const title=String(item.title||'').replace(/<[^>]*>/g,'').trim();
          const dedupe=set.service+'|'+host;
          if(!host||blockedHost.test(host)||seen.has(dedupe)||!title||
             title.length<5||title.length>180||
             /求人|採用|比較|ランキング|口コミ|評判|ブログ|ニュース|最新記事|一覧|検索結果|個人情報/.test(title)||
             mateV4OwnerBlocked_({'事業者名':title,'公式URL':url})){
            skipped++;continue;
          }
          const keyText='WEB-'+mateV4Key_(set.service,url,title);
          mateV4Append_(tab,[keyText,mateV4Jst_(),set.service,title.slice(0,150),url,term,
            '公式サイト・運営者未確認','検索結果から候補を発見。営業送信禁止。公式サイトの事業者確認・用途/拒否表示の監査前。']);
          seen.add(dedupe);added++;
        }
      }catch(err){
        errors++;
        console.log('GENERAL_WEB_DISCOVERY_QUERY_FAILED '+set.service);
      }
    }
  }
  return {queries,added,skipped,errors,sendable:0,
    mode:'SEARCH_RESULT_STAGING_ONLY'};
}

function mateV4CollectLeads(){
  const b=mateV4Book_(),src=mateV4Tab_(b,MATE_V4.sources),dest=mateV4Tab_(b,MATE_V4.leads);
  const stage=mateV4Tab_(b,'営業候補_公式URL未確認');
  const staged=new Set(mateV4Rows_(stage).map(x=>x['候補キー']).filter(Boolean));
  const sources=mateV4BalancedSourceQueue_(mateV4Rows_(src),mateV4Jst_().slice(0,10));
  const existing=mateV4Rows_(dest);
  const seen=new Set(existing.map(x=>x['重複キー']).filter(Boolean));
  const known=new Set(mateV4Rows_(mateV4Tab_(b,'3サービス営業リスト'))
    .filter(x=>mateV4Https_(x['公式・窓口URL']))
    .map(x=>{try{return mateV4Key_(x['サービス'],x['公式・窓口URL'],x['企業・教室名'])}catch(e){return ''}}));
  let count=0,stagedCount=0,processedSources=0;
  // CARE/SPARK/PLAY can share the same Overture feed. Parse it only once.
  const sourceCache=new Map();
  for(const source of sources){
    if(processedSources>=8)break;
    if(source['有効']!=='TRUE'||source['再利用許諾確認']!=='確認済み'||!mateV4Https_(source['取得元CSV HTTPS URL']))continue;
    const service=source['サービス'];if(!['CARE','SPARK','PLAY'].includes(service))continue;
    // Public municipal datasets rarely update hourly; check each once per JST day.
    // Keep this after validation so a newly added source is processed immediately.
    if(!mateV4SourceDue_(source,mateV4Jst_().slice(0,10)))continue;
    processedSources++;
    let rows;
    try{
      const url=source['取得元CSV HTTPS URL'];
      if(!sourceCache.has(url))sourceCache.set(url,mateV4SourceCsv_(url));
      rows=sourceCache.get(url).map(x=>({...x}));
    }
    catch(e){
      // Treat this as today's attempted fetch; never hammer a broken source
      // once per hour or starve other sources in the eight-source batch.
      src.getRange(source._row,6,1,2).setValues([[
        mateV4Jst_(),'取得失敗・再試行は翌日: '+String(e).slice(0,170)]]);
      continue;
    }
    let imported=0,missingWebsite=0,skippedDuplicate=0,invalidRows=0;
    const writeRows=[];
    for(const x of rows){
      if(count>=MATE_V4.maxNewLeadsPerRun)break;
      // A mixed-service Overture feed is only relevant to its named service.
      if(x.service&&x.service!==service){invalidRows++;continue;}
      // A dataset row can be from an unrelated or non-commercial venue.
      // Keep it as discovery-only; later first-party checks decide readiness.
      x.website=mateV4CandidateHttps_(x.website);
      x.contact_url=mateV4CandidateHttps_(x.contact_url);
      if(!x.name||!mateV4Https_(x.website)){
        missingWebsite++;
        if(stagedCount<250&&mateV4StageNameOnly_(stage,staged,x,service,source['取得元CSV HTTPS URL']))
          stagedCount++;
        continue;
      }
      if(!mateV4Https_(x.source_url)){invalidRows++;continue}
      const id=mateV4Key_(service,x.website,x.name);
      if(seen.has(id)||known.has(id)){skippedDuplicate++;continue}
      const deny=/^(true|yes|1|禁止)$/i.test(x.solicitation_prohibited);
      // Imported directories may contain staff names; retain only public
      // organizational role inboxes, never personal mailboxes.
      const mail=mateV4RoleEmail_(x.email);
      const checked=mateV4Fresh_(x.checked_at,14);
      const basis=['OPT_IN','SOLICITATIONS_WELCOME'].includes(x.mail_basis)?x.mail_basis:'UNVERIFIED';
      // Even a properly licensed CSV can contain stale or self-asserted opt-in.
      // Require an operator to check the current official contact page, evidence,
      // objection notices, and date before manually marking any lead send-ready.
      const state=deny?'配信禁止':'窓口確認待ち';
      writeRows.push([
        'AUTO-'+id,mateV4Jst_(),service,x.name,x.website,x.region||'',
        mail,x.contact_url||'',x.source_url,basis,x.checked_at||'',id,
        deny?'TRUE':'FALSE',state,'CSVの根拠表示だけでは送信不可。公式窓口・拒否表示・根拠確認日を人が確認。掲載・取次の許諾も未取得。',''
      ]);
      seen.add(id);count++;imported++;
    }
    // Commit the candidate batch BEFORE claiming successful source ingestion.
    // A write failure leaves this source due for safe replay with dedupe.
    if(writeRows.length)mateV4BatchAppend_(dest,writeRows);
    const summary=String(imported)+' 件取込 / CSV '+rows.length+' 行 / URL・名称不足 '+missingWebsite+
      ' / 重複 '+skippedDuplicate+' / その他不備 '+invalidRows;
    src.getRange(source._row,6,1,2).setValues([[mateV4Jst_(),summary.slice(0,250)]]);
  }
  return {urlVerifiedImported:count,nameOnlyStaged:stagedCount,processedSources};
}
function mateV4OptoutInbox(){
  const b=mateV4Book_(),sheet=mateV4Tab_(b,MATE_V4.optouts);
  const old=new Set(mateV4Rows_(sheet).map(x=>x['メール'].toLowerCase()));
  const logged=new Set(mateV4Rows_(mateV4Tab_(b,MATE_V4.sent)).map(x=>x['宛先メール'].toLowerCase()));
  let count=0;
  // Only business addresses we have actually contacted; never copy message text.
  for(const thread of GmailApp.search('in:inbox newer_than:45d',0,80)){
    for(const msg of thread.getMessages()){
      const raw=String(msg.getFrom()||'').toLowerCase();
      const m=raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
      const addr=m&&m[0];if(!addr||old.has(addr)||!logged.has(addr))continue;
      const txt=(String(msg.getSubject()||'')+'\n'+String(msg.getPlainBody()||'').slice(0,500)).trim();
      if(!/^(配信停止|メール不要|今後連絡不要|unsubscribe|stop)(\s|$)/i.test(txt)&&
        !/配信停止(をお願いします|希望します)|please unsubscribe/i.test(txt))continue;
      mateV4Append_(sheet,[addr,mateV4Jst_(),'受信者からの配信停止希望',msg.getId()]);
      old.add(addr);count++;
    }
  }
  return count;
}

/*
 * Public business-address verification for Japanese unsolicited-email rules.
 * Audit only the merchant's own HTTPS pages, never an unrelated directory,
 * and never mistake a published address for permission to publish a listing.
 * The sender must explicitly opt into the legal exception as a SCRIPT PROPERTY.
 */
/**
 * Quarantine only clear permanent delivery failures from the operator inbox.
 * Do not interpret temporary throttling or out-of-office as a hard bounce.
 * Require exactly one historically contacted recipient in the failure body.
 */
function mateV4HardBounceQuarantine(){
  const book=mateV4Book_(),opt=mateV4Tab_(book,MATE_V4.optouts);
  const known=new Set(mateV4Rows_(mateV4Tab_(book,MATE_V4.sent))
    .map(x=>mateV4Email_(x['宛先メール'])).filter(Boolean));
  const held=new Set(mateV4Rows_(opt).map(x=>mateV4Email_(x['メール'])).filter(Boolean));
  let inspected=0,quarantined=0;
  for(const thread of GmailApp.search('in:inbox newer_than:30d (from:mailer-daemon@googlemail.com OR from:postmaster@google.com OR subject:"Delivery Status Notification")',0,80)){
    for(const msg of thread.getMessages()){
      if(inspected++>=120)break;
      const subject=String(msg.getSubject()||'');
      const body=String(msg.getPlainBody()||'').slice(0,12000);
      if(!/(?:Delivery Status Notification|Undeliverable|Mail Delivery|配信不能|配信エラー|配信できません)/i.test(subject))continue;
      if(!/(?:5\.1\.1|5\.1\.0|550.{0,70}(?:user unknown|no such user|mailbox unavailable|recipient not found)|address not found|recipient address rejected)/i.test(body))continue;
      const candidates=[...new Set((body.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[])
        .map(mateV4Email_).filter(x=>x&&known.has(x)&&!held.has(x)))];
      if(candidates.length!==1)continue;
      mateV4Append_(opt,[candidates[0],mateV4Jst_(),'恒久的配送不能（Gmail不達通知）',String(msg.getId()).slice(0,180)]);
      held.add(candidates[0]);quarantined++;
    }
    if(inspected>=120)break;
  }
  return {inspected,quarantined};
}
function mateV4PublicHtml_(url){
  // Follow short HTTPS redirects only to the exact same business host
  // (optional www prefix). A 301 http->https downgrade and third-party
  // redirects are never followed, nor are IP/private/intranet hosts fetched.
  if(!mateV4Https_(url))return '';
  const originalHost=mateV4Host_(url);
  if(/^\\d+(?:\\.\\d+){3}$/.test(originalHost)||/\\.(?:local|internal|test|example)$/.test(originalHost))return '';
  let current=url;
  for(let hop=0;hop<3;hop++){
    const r=UrlFetchApp.fetch(current,{
      muteHttpExceptions:true,followRedirects:false,timeout:10000
    });
    const status=r.getResponseCode();
    if([301,302,303,307,308].includes(status)&&hop<2){
      const headers=r.getAllHeaders();
      const location=String(headers.Location||headers.location||'').trim();
      if(!location||location.length>500)return '';
      let target='';
      if(/^https:\/\//i.test(location))target=location;
      else if(location.startsWith('/')&&!location.startsWith('//')){
        const m=current.match(/^https:\/\/[^\/]+/i);
        if(m)target=m[0]+location;
      }else if(!/^[a-z][a-z0-9+.-]*:/i.test(location)&&!location.startsWith('//')){
        const clean=current.replace(/[?#].*$/,'');
        target=clean.slice(0,clean.lastIndexOf('/')+1)+location;
      }
      if(!mateV4Https_(target)||!mateV4SameBusinessHost_(target,url)||target===current)return '';
      current=target;
      continue;
    }
    if(status!==200)return '';
    const contentType=String(r.getHeaders()['Content-Type']||r.getHeaders()['content-type']||'');
    if(contentType&&!/text\/html|application\/xhtml\+xml/i.test(contentType))return '';
    const bytes=r.getBlob().getBytes();
    if(bytes.length>250000)return '';
    const html=r.getContentText('UTF-8');
    return /<(?:html|body|main|a|div|p)\b/i.test(html)?html.slice(0,250000):'';
  }
  return '';
}
function mateV4ContactLink_(html,baseUrl){
  const host=mateV4Host_(baseUrl),root='https://'+host;
  if(!host)return '';
  const pattern=/\bhref\s*=\s*["']([^"']{1,500})["']/gi;
  let m;
  while((m=pattern.exec(String(html||'')))){
    const href=m[1].replace(/&amp;/gi,'&');
    // Some businesses label a link "お問い合わせ" but use an opaque
    // path like /form/. This audit only reads first-party pages.
    const following=String(html||'').slice(pattern.lastIndex,pattern.lastIndex+700);
    const anchorText=following.split(/<\/a\s*>/i)[0]
      .replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ');
    if(!/(?:contact|inquir|toiawase|otoiawase|form|お問い?合わ?せ|%e3%81%8a%e5%95%8f%e3%81%84)/i.test(href)&&
       !/(?:お問い合わせ|お問合せ|お問い合せ|連絡先|法人窓口|Contact|Inquiry)/i.test(anchorText))continue;
    if(/^(?:mailto:|javascript:|data:|\/\/)/i.test(href))continue;
    let url='';
    if(/^https:\/\//i.test(href))url=href;
    else if(href.startsWith('/'))url=root+href;
    else if(!/^[a-z]+:/i.test(href)){
      const stripped=baseUrl.replace(/[?#].*$/,'');
      const prefix=stripped.slice(0,stripped.lastIndexOf('/')+1);
      url=prefix+href;
    }
    if(mateV4Https_(url)&&mateV4SameBusinessHost_(url,baseUrl)&&url!==baseUrl)return url;
  }
  return '';
}
/** Find an official company/about page as a third audit source.
 * Some operators publish role addresses only on company-information pages.
 * Never follow external links and never submit any forms.
 */
function mateV4CompanyLink_(html,baseUrl){
  const host=mateV4Host_(baseUrl),root='https://'+host;
  if(!host)return '';
  const pattern=/\bhref\s*=\s*["']([^"']{1,500})["']/gi;
  let match;
  while((match=pattern.exec(String(html||'')))){
    const href=match[1].replace(/&amp;/gi,'&');
    if(!/(?:company|corporate|about(?:-us)?|profile|会社概要|企業情報|運営会社)/i.test(href)||
       /^(?:mailto:|javascript:|data:|\/\/)/i.test(href))continue;
    let url='';
    if(/^https:\/\//i.test(href))url=href;
    else if(href.startsWith('/'))url=root+href;
    else if(!/^[a-z]+:/i.test(href)){
      const stripped=baseUrl.replace(/[?#].*$/,'');
      url=stripped.slice(0,stripped.lastIndexOf('/')+1)+href;
    }
    if(mateV4Https_(url)&&mateV4SameBusinessHost_(url,baseUrl)&&url!==baseUrl)
      return url;
  }
  return '';
}
function mateV4SalesRefusal_(html){
  const t=String(html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,250000);
  return /(営業|勧誘|セールス|広告|宣伝).{0,32}(お断り|ご遠慮|禁止|受け付けておりません|お控え|拒否)/i.test(t)||
    /(お断り|ご遠慮|禁止|拒否).{0,24}(営業|勧誘|セールス|広告|宣伝)/i.test(t)||
    /no\s+(?:sales|solicitation|marketing)\s+(?:emails?|messages?)/i.test(t);
}
function mateV4RoleEmail_(raw){
  const email=mateV4Email_(raw);
  if(!email)return '';
  const local=email.split('@')[0];
  return /^(?:info|contact|office|inquiry|toiawase|otoiawase|uketsuke|madoguchi|jimukyoku|reception|desk|admin|business|partner|partners|partnerships|hello|support|general|sales|customer|mail)(?:[._+-][a-z0-9]+)?$/i.test(local)?email:'';
}
function mateV4PublishedEmails_(html){
  // Decode only ordinary HTML entities used to display first-party mailbox
  // addresses. Never guess masked addresses or scrape personal mailboxes.
  const visible=String(html||'').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(match,n)=>{
    const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):parseInt(n,10);
    return code===64?'@':code===46?'.':code===45?'-':code===95?'_':match;
  }).replace(/&(?:commat|period|dot);/gi,m=>/commat/i.test(m)?'@':'.');
  const found=new Set(),pattern=/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  for(const match of visible.match(pattern)||[]){
    const email=mateV4RoleEmail_(match);
    if(email)found.add(email);
  }
  return [...found];
}
/*
 * Visits up to 12 prospects/hour, at most two pages each, with an HTTP 200,
 * exact public business email and no visible rejection signal required.
 * Ambiguous cases remain human-review; no form submissions or new email
 * to the destination occur here.
 *
 * An operator choosing to rely on the published-address exception must
 * independently set MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED=YES in addition
 * to existing MATE_AUTO_SEND=ON and MATE_AUTO_SEND_LEGAL_REVIEWED=YES.
 */
function mateV4AuditOfficialContacts(){
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty('MATE_PUBLIC_SITE_AUDIT')==='OFF')return 'OFF';
  const autoException=p.getProperty('MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED')==='YES'&&
    p.getProperty('MATE_AUTO_SEND_LEGAL_REVIEWED')==='YES';
  const b=mateV4Book_(),tab=mateV4Tab_(b,MATE_V4.leads);
  // Audit prospects most likely to produce a legitimate first contact first:
  //   1. verified and held businesses, 2. pending businesses with an existing
  //   role mailbox to recheck, 3. no-mailbox prospects needing discovery.
  // No state, rejection or quota gate is changed by this ordering.
  const sentLogs=mateV4Rows_(mateV4Tab_(b,MATE_V4.sent));
  const sentEmails=new Set(sentLogs.map(x=>mateV4Email_(x['宛先メール'])).filter(Boolean));
  const sentKeys=new Set(sentLogs.map(x=>x['候補キー']).filter(Boolean));
  const eligibleServices=['CARE','SPARK','PLAY'];
  // Prioritize businesses that have never been attempted. Distribute audit
  // effort across services so a large SPARK backlog cannot starve CARE/PLAY.
  // Treat any send reservation (including ambiguous failures) as attempted.
  const auditPriority=x=>{
    const email=mateV4Email_(x['業務用メール']);
    const alreadyAttempted=sentKeys.has(x['重複キー'])||(email&&sentEmails.has(email));
    if(alreadyAttempted)return 99;
    if(x['営業拒否']==='TRUE'||x['状態']==='配信禁止')return 99;
    if(x['状態']==='営業可能候補'&&
       !mateV4Fresh_(x['根拠確認日時'],14))return 0;
    if(x['状態']==='営業可能候補'&&x['営業拒否']==='未確認')return 1;
    if(x['状態']==='公式公開メール確認済・送信待機')return 2;
    // Fresh independent business leads with a first-party published contact
    // are the quickest route to a defensible new outreach review.
    if(x['状態']==='窓口確認待ち'&&mateV4RoleEmail_(email)&&
       String(x['最終確認結果']||'').startsWith('WEB_DISCOVERY ')&&
       mateV4Fresh_(String(x['取得日時']||'').slice(0,10),7))return 2;
    if(x['状態']==='窓口確認待ち'&&mateV4RoleEmail_(email))return 3;
    // Fresh independent businesses found through ordinary web search should
    // receive the same first-party site audit promptly, never automatic
    // outreach based on the search result alone.
    if(x['状態']==='窓口確認待ち'&&
       String(x['最終確認結果']||'').startsWith('WEB_DISCOVERY ')&&
       mateV4Fresh_(String(x['取得日時']||'').slice(0,10),7))return 3;
    if(x['状態']==='窓口確認待ち')return 4;
    return 98;
  };
  const buckets={CARE:[],SPARK:[],PLAY:[]};
  for(const lead of mateV4Rows_(tab)){
    if(!eligibleServices.includes(lead['サービス']))continue;
    if(auditPriority(lead)>=98)continue;
    buckets[lead['サービス']].push(lead);
  }
  eligibleServices.forEach(service=>buckets[service].sort((a,b)=>
    auditPriority(a)-auditPriority(b)||
    mateV4FitScore_(b)-mateV4FitScore_(a)||
    String(a['最終確認結果']||'').localeCompare(String(b['最終確認結果']||''))));
  const leads=[];
  while(eligibleServices.some(s=>buckets[s].length)){
    for(const service of eligibleServices)
      if(buckets[service].length)leads.push(buckets[service].shift());
  }
  const stopped=new Set(mateV4Rows_(mateV4Tab_(b,MATE_V4.optouts))
    .map(x=>x['メール'].toLowerCase()).filter(Boolean));
  let checked=0,eligible=0,discovered=0;
  // Prioritize new company contact audits without exhausting GAS execution time.
  // The batch can be tuned in private Script Properties (3..16); audit steps
  // remain bounded and cannot bypass opt-out, official-evidence or legal gates.
  const requested=Number(p.getProperty('MATE_PUBLIC_AUDIT_BATCH')||12);
  const batchSize=Number.isFinite(requested)?
    Math.min(16,Math.max(3,Math.floor(requested))):12;
  const today=mateV4Jst_().slice(0,10);
  for(const x of leads){
    if(checked>=batchSize)break;
    if(mateV4OwnerBlocked_(x)||!['窓口確認待ち','公式公開メール確認済・送信待機','営業可能候補'].includes(x['状態']))continue;
    // A previously verified address is not sendable when refusal remains
    // '未確認'. Recheck the first-party page, then resolve that status only
    // when no solicitation refusal is observed in this fresh audit.
    if(x['状態']==='営業可能候補'&&x['営業拒否']==='FALSE'&&mateV4PublicMailOperatorReview_(x))continue;
    // Explicitly designated sales email on the company's official page is
    // distinct from a customer-only web form. Preserve recently reviewed
    // SOLICITATIONS_WELCOME rows; do not infer permission from form text.
    if(x['状態']==='営業可能候補'&&x['メール用途・営業可の根拠']==='SOLICITATIONS_WELCOME'&&
       mateV4Fresh_(x['根拠確認日時'],14)&&mateV4Https_(x['確認元URL']))continue;
    if(x['営業拒否']==='TRUE'||!x['重複キー']||!mateV4Https_(x['公式URL']))continue;
    const note=x['最終確認結果']||'';
    // Reuse an already recent, first-party audit when the operator later
    // enables the public-address legal exception. No re-fetch required.
    if(autoException&&x['状態']==='公式公開メール確認済・送信待機'&&
       mateV4PublicMailOperatorReview_(x)){
      tab.getRange(x._row,14).setValue('営業可能候補');
      checked++;eligible++;continue;
    }
    // Never repeat a failed/ambiguous audit every hour: advance through the
    // queue of candidates rather than starving all but the first 12.
    // Even unresolved candidates get at most one first-party fetch per day.
    // This prevents a failed address lookup starving the rest of the queue.
    if(note.startsWith('AUTO_AUDIT '+today))continue;
    const recheckHeld=autoException&&x['状態']==='公式公開メール確認済・送信待機';
    if(x['営業拒否']!=='未確認'&&!recheckHeld&&/^AUTO_AUDIT \d{4}-\d{2}-\d{2}/.test(note)){
      const last=note.slice(11,21);
      // Transient failures are retried sooner, while the sending evidence
      // requirements remain unchanged.
      const retryDays=/取得不可|取得失敗|確認できず/.test(note)?2:
        /企業の公開窓口メールを一意に確認できず|既存メールは公式ページで確認できず/.test(note)?3:14;
      if(mateV4Fresh_(last,retryDays))continue;
    }
    const host=mateV4Host_(x['公式URL']),pages=[];
    // The stored official URL can be a deep service page with no contact links.
    // Also inspect the exact same-domain homepage, without following external
    // URLs or attempting to submit a contact form.
    const homepage=host?'https://'+host+'/':'';
    for(const url of [x['窓口URL'],x['公式URL'],homepage]){
      if(!mateV4Https_(url)||!mateV4SameBusinessHost_(url,x['公式URL'])||pages.includes(url))continue;
      if(pages.length>=3)break;
      pages.push(url);
    }
    if(!pages.length)continue;
    checked++;
    try{
      // A temporary fetch failure on one page must not conceal a valid
      // company/contact page. Keep all lookups same-business HTTPS only.
      const fetchPage=url=>{
        try{return {url,html:mateV4PublicHtml_(url)}}
        catch(e){return {url,html:''}}
      };
      const loaded=pages.map(fetchPage);
      // The saved contact URL can be stale. Discover both an official contact
      // page and a company-information page from a working homepage.
      const homes=loaded.filter(z=>z.html&&
        (z.url===homepage||z.url===x['公式URL']));
      for(const home of homes){
        for(const next of [mateV4ContactLink_(home.html,home.url),
                           mateV4CompanyLink_(home.html,home.url)]){
          if(next&&!loaded.some(z=>z.url===next)&&loaded.length<4)
            loaded.push(fetchPage(next));
        }
        if(loaded.length>=4)break;
      }
      const valid=loaded.filter(z=>z.html);
      const refused=valid.some(z=>mateV4SalesRefusal_(z.html));
      const possible=[...new Set(valid.flatMap(z=>mateV4PublishedEmails_(z.html)))];
      const old=mateV4RoleEmail_(x['業務用メール']);
      // If no email was previously listed, avoid selecting an arbitrary
      // third-party address among several generic addresses.
      // An old CRM address is not evidence if it no longer appears on the
      // company's verified current pages. Prefer the exact existing match;
      // otherwise use a single unambiguous published business role address.
      // If several public role mailboxes exist, prefer a uniquely identified
      // business/partnership/sales channel over customer-support addresses.
      // Do not guess between two sales channels or harvest personal emails.
      const businessRoles=possible.filter(v=>/^(?:business|partner|partners|partnerships|sales)(?:[._+-][a-z0-9]+)?@/i.test(v));
      const email=old&&possible.includes(old)?old:
        businessRoles.length===1?businessRoles[0]:
        possible.length===1?possible[0]:'';
      const publicPage=email&&!refused?valid.find(z=>mateV4PublishedEmails_(z.html).includes(email)):null;
      const detail=!valid.length?'公式HTTPSページ取得不可':
        refused?'営業・勧誘の拒否表示を検出':
        !email?'企業の公開窓口メールを一意に確認できず':
        !publicPage?'既存メールは公式ページで確認できず':
        '公式事業者サイトで業務用メール掲載確認';
      const evidence='AUTO_AUDIT '+today+' '+detail+
        (publicPage?' '+publicPage.url:'');
      tab.getRange(x._row,15).setValue(evidence.slice(0,520));
      if(refused){
        tab.getRange(x._row,13).setValue('TRUE');
        tab.getRange(x._row,14).setValue('配信禁止');
        continue;
      }
      if(!publicPage){
        if(x['状態']==='営業可能候補')tab.getRange(x._row,14).setValue('窓口確認待ち');
        continue;
      }
      if(stopped.has(email)){
        tab.getRange(x._row,13).setValue('TRUE');
        tab.getRange(x._row,14).setValue('配信禁止');
        continue;
      }
      if(email!==old){
        tab.getRange(x._row,7).setValue(email);
        discovered++;
      }
      // "未確認" is a review status, NOT an express refusal. It can be
      // resolved only after official first-party verification, no refusal
      // signals and opt-out checking. Never override TRUE/explicit refusals.
      if(x['営業拒否']==='未確認')tab.getRange(x._row,13).setValue('FALSE');
      tab.getRange(x._row,9).setValue(publicPage.url);
      tab.getRange(x._row,10).setValue('PUBLIC_BUSINESS_EMAIL');
      tab.getRange(x._row,11).setValue(today);
      // Read the updated, first-party evidence before evaluating readiness.
      const audited={...x,
        '業務用メール':email,'確認元URL':publicPage.url,
        'メール用途・営業可の根拠':'PUBLIC_BUSINESS_EMAIL',
        '根拠確認日時':today,
        '最終確認結果':evidence.slice(0,520)};
      const accepted=autoException&&mateV4PublicMailOperatorReview_(audited);
      tab.getRange(x._row,14).setValue(accepted?'営業可能候補':'公式公開メール確認済・送信待機');
      if(accepted)eligible++;
    }catch(err){
      tab.getRange(x._row,15).setValue('AUTO_AUDIT '+today+' 取得失敗・送信保留');
    }
  }
  return {checked,eligible,discovered,batchSize,
    strategy:'UNCONTACTED_FIRST_ROUND_ROBIN_CARE_SPARK_PLAY'};
}

/**
 * Read-only, no-send launch preflight. Reports aggregate counts only; no
 * names, addresses, prospect emails, or applicant details leave Apps Script.
 * This is a technical inspection, not proof of legal solicitation permission.
 */
function previewMateOutreachReadinessV4(){
  const b=mateV4Book_(),p=PropertiesService.getScriptProperties();
  const leads=mateV4Rows_(mateV4Tab_(b,MATE_V4.leads));
  const logs=mateV4Rows_(mateV4Tab_(b,MATE_V4.sent));
  const stopped=new Set(mateV4Rows_(mateV4Tab_(b,MATE_V4.optouts))
    .map(x=>String(x['メール']||'').toLowerCase()).filter(Boolean));
  const attempted=new Set(logs.map(x=>x['候補キー']).filter(Boolean));
  const priorRecipients=new Set(logs.map(x=>String(x['宛先メール']||'').toLowerCase()).filter(Boolean));
  const output={
    mode:'READ_ONLY_NO_SEND',
    automationSwitch:p.getProperty('MATE_AUTO_SEND')==='ON'?'ON':'OFF',
    phase:p.getProperty('MATE_OUTREACH_PHASE')||'OFF',
    senderNameSet:String(p.getProperty('MATE_SENDER_NAME')||'').trim().length>=2,
    senderAddressSet:mateV4SenderAddressLooksComplete_(p.getProperty('MATE_SENDER_ADDRESS')),
    legalAddressPageVerified:p.getProperty('MATE_LEGAL_ADDRESS_PAGE_VERIFIED')==='YES',
    formalSenderNameSet:!!String(p.getProperty('MATE_FORMAL_SENDER_NAME')||'').trim(),
    formalSenderVerified:p.getProperty('MATE_FORMAL_SENDER_VERIFIED')==='YES',
    legalIdentityMode:p.getProperty('MATE_LEGAL_IDENTITY_MODE')||'UNSET',
    registeredSenderIdentityReady:mateV4FormalSenderIdentity_(p).ready,
    legalReviewFlag:p.getProperty('MATE_AUTO_SEND_LEGAL_REVIEWED')==='YES',
    publicBusinessEmailExceptionReviewed:p.getProperty('MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED')==='YES',
    dailyCap:Math.min(p.getProperty('MATE_OUTREACH_PHASE')==='BALANCED_15'?15:p.getProperty('MATE_OUTREACH_PHASE')==='PER_SERVICE_30'?90:p.getProperty('MATE_OUTREACH_PHASE')==='DAILY_30'?30:p.getProperty('MATE_OUTREACH_PHASE')==='PILOT'?1:5,Math.max(0,parseInt(p.getProperty('MATE_DAILY_CAP')||'5',10)||0)),
    dailyPerServiceCap:p.getProperty('MATE_OUTREACH_PHASE')==='BALANCED_15'?5:p.getProperty('MATE_OUTREACH_PHASE')==='DAILY_30'?30:p.getProperty('MATE_OUTREACH_PHASE')==='PER_SERVICE_30'?30:null,
    outreachStartDate:p.getProperty('MATE_OUTREACH_START_DATE')||'',
    remainingRecipientQuota:MailApp.getRemainingDailyQuota(),
    maximumExternalMessagesByQuota:MailApp.getRemainingDailyQuota(),
    actualDailySendLimitMayBeLowerThanRequested:true,
    totalCandidateRows:leads.length,
    // Status and failure reasons are internal aggregates, never recipient data.
    pendingByService:{CARE:0,SPARK:0,PLAY:0},
    missingEmailByService:{CARE:0,SPARK:0,PLAY:0},
    auditIssues:{noUniqueOfficialEmail:0,httpsUnavailable:0,fetchFailed:0,officialAddressNoLongerVerified:0,other:0},
    activeSuppressions:stopped.size,
    outreachLogRows:logs.length,
    eligibleByScriptChecks:{CARE:0,SPARK:0,PLAY:0},
    notEvidenceOfLegalPermission:true
  };
  const seenEmails=new Set();
  for(const x of leads){
    const service=x['サービス'];
    if(!Object.prototype.hasOwnProperty.call(output.pendingByService,service)||
       x['状態']!=='窓口確認待ち')continue;
    output.pendingByService[service]++;
    if(!mateV4Email_(x['業務用メール']))output.missingEmailByService[service]++;
    const note=String(x['最終確認結果']||'');
    const reason=/企業の公開窓口メールを一意に確認できず/.test(note)?'noUniqueOfficialEmail':
      /公式HTTPSページ取得不可/.test(note)?'httpsUnavailable':
      /取得失敗/.test(note)?'fetchFailed':
      /既存メールは公式ページで確認できず/.test(note)?'officialAddressNoLongerVerified':'other';
    output.auditIssues[reason]++;
  }
  leads.forEach(function(x){
    const service=x['サービス'],email=mateV4Email_(x['業務用メール']),key=x['重複キー'];
    if(mateV4OwnerBlocked_(x)||!['CARE','SPARK','PLAY'].includes(service)||!email||!key)return;
    if(x['状態']!=='営業可能候補'||x['営業拒否']!=='FALSE'||
       !mateV4Fresh_(x['根拠確認日時'],14)||!mateV4Https_(x['確認元URL']))return;
    if(!['OPT_IN','SOLICITATIONS_WELCOME','PUBLIC_BUSINESS_EMAIL'].includes(x['メール用途・営業可の根拠']))return;
    if(x['メール用途・営業可の根拠']==='PUBLIC_BUSINESS_EMAIL'&&
      (!output.publicBusinessEmailExceptionReviewed||!mateV4PublicMailOperatorReview_(x)))return;
    if(stopped.has(email)||attempted.has(key)||priorRecipients.has(email)||seenEmails.has(email))return;
    seenEmails.add(email);
    output.eligibleByScriptChecks[service]+=1;
  });
  return JSON.stringify(output);
}

/** Reject vague labels such as 'MATE運営事務局（東京）'.
 * The operator still must verify the *actual* service address.
 */
/** Publicly visible business mail alone is not approval to market.
 * Owner must manually mark each address after checking intended purpose and
 * no-solicitation/opt-out notices. The dated marker expires after 14 days.
 * This is in the EXISTING prospect '備考' field and never written by an audit.
 */
function mateV4PublicMailOperatorReview_(x){
  const memo=String(x['備考']||'');
  const m=memo.match(/(?:^|\s)PUBLIC_EMAIL_REVIEW_OK:(\d{4}-\d{2}-\d{2})(?=\s|$)/);
  if(m&&mateV4Fresh_(m[1],14))return true;
  // For business self-published, public role addresses only: no per-lead
  // human clicks are needed after the operator approves the legal exception.
  // Reuse ONLY the verified output of the first-party HTTPS site auditor.
  const result=String(x['最終確認結果']||'');
  const audit=result.match(/^AUTO_AUDIT (\d{4}-\d{2}-\d{2}) 公式事業者サイトで業務用メール掲載確認 (https:\/\/\S+)/);
  if(!audit||!mateV4Fresh_(audit[1],14)||audit[1]!==x['根拠確認日時'])return false;
  if(x['メール用途・営業可の根拠']!=='PUBLIC_BUSINESS_EMAIL')return false;
  if(!mateV4RoleEmail_(x['業務用メール']))return false;
  if(!mateV4Https_(x['確認元URL'])||audit[2]!==x['確認元URL'])return false;
  return mateV4SameBusinessHost_(x['公式URL'],x['確認元URL']);
}
function mateV4SenderAddressLooksComplete_(raw){
  const s=String(raw||'').trim();
  return s.length>=13 && /(?:東京都|北海道|大阪府|京都府|.{2,3}県)/.test(s)
    && /[市区町村]/.test(s)
    && /(?:[0-9０-９]+(?:[-－‐ー][0-9０-９]+)*|[一二三四五六七八九十]+丁目)/.test(s)
    && !/仮|未設定|ダミー|サンプル|正式な営業所在地/.test(s);
}
/** Set up one-per-day PILOT only; keep all external emails OFF.
 * Never assert an unverified postal address, legal review or public-email exception.
 * This is safe to run again: it only changes the four named settings.
 */
function prepareMatePilotV4(){
  mateV4Book_();
  const p=PropertiesService.getScriptProperties();
  p.setProperty('MATE_AUTO_SEND','OFF');
  p.setProperty('MATE_OUTREACH_PHASE','PILOT');
  p.setProperty('MATE_DAILY_CAP','1');
  p.setProperty('MATE_SENDER_NAME','MATE運営事務局');
  const result={
    mode:'PILOT_PREPARED_NO_SEND',
    autoSend:'OFF',phase:'PILOT',dailyCap:1,
    senderNameSet:!!String(p.getProperty('MATE_SENDER_NAME')||'').trim(),
    verifiedPostalAddress:mateV4SenderAddressLooksComplete_(p.getProperty('MATE_SENDER_ADDRESS')),
    legalAddressPageVerified:p.getProperty('MATE_LEGAL_ADDRESS_PAGE_VERIFIED')==='YES',
    legalReviewFlag:p.getProperty('MATE_AUTO_SEND_LEGAL_REVIEWED')==='YES',
    publicBusinessEmailExceptionReviewed:p.getProperty('MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED')==='YES'
  };
  console.log(JSON.stringify(result));return result;
}

/**
 * Setup ONLY: 15/day (5 CARE, 5 SPARK, 5 PLAY) no earlier than 2026-11-12 JST.
 * The external-mail switch is intentionally kept OFF. All other existing
 * legal, address, and per-recipient evidence gates remain unchanged.
 */
function prepareMateBalanced15V4(){
  mateV4Book_();
  const p=PropertiesService.getScriptProperties();
  p.setProperty('MATE_AUTO_SEND','OFF');
  p.setProperty('MATE_OUTREACH_PHASE','BALANCED_15');
  p.setProperty('MATE_DAILY_CAP','15');
  p.setProperty('MATE_OUTREACH_START_DATE','2026-11-12');
  p.setProperty('MATE_SENDER_NAME','MATE運営事務局');
  const state={
    mode:'BALANCED_15_PREPARED_NO_SEND',
    autoSend:'OFF',phase:'BALANCED_15',startDate:'2026-11-12',
    dailyCap:15,perServiceCap:5
  };
  console.log(JSON.stringify(state));
  return state;
}

/**
 * Sender identity mode is an evidence gate, not proof of legal compliance.
 * For an owner who does not want to display a personal name, only a formally
 * registered trade name or an actual company name may be selected.
 * The operator must independently confirm applicability to the planned
 * marketing emails, and may not assert registration without proof.
 */
/** Prepare a sole-proprietor legal-name sender while keeping MATE brand display.
 * Never send, never hard-code personal legal names in public source control.
 * Operator sets MATE_FORMAL_SENDER_NAME privately in Apps Script properties.
 */
function prepareMatePersonalNameV4(){
  mateV4Book_();
  const p=PropertiesService.getScriptProperties();
  p.setProperty('MATE_AUTO_SEND','OFF');
  p.setProperty('MATE_LEGAL_IDENTITY_MODE','PERSONAL_NAME');
  p.setProperty('MATE_SENDER_NAME','MATE運営事務局');
  const snapshot={
    mode:'PERSONAL_NAME_PREPARED_NO_SEND',
    autoSend:'OFF',
    identityMode:'PERSONAL_NAME',
    brandSender:'MATE運営事務局',
    formalSenderNameSet:!!String(p.getProperty('MATE_FORMAL_SENDER_NAME')||'').trim(),
    verified:mateV4FormalSenderIdentity_(p).ready,
    phase:p.getProperty('MATE_OUTREACH_PHASE')||'OFF',
    dailyCap:p.getProperty('MATE_DAILY_CAP')||''
  };
  console.log(JSON.stringify(snapshot));return snapshot;
}

/** Setup 30 total sends per JST day: 10 CARE, 10 SPARK, 10 PLAY.
 * This preparation never turns on outbound delivery. Existing opt-out,
 * verified business contact, duplicate, and legal identity gates remain.
 * Re-running is idempotent and intentionally does not alter legal attestations.
 */
function prepareMateDaily30V4(){
  mateV4Book_();
  const p=PropertiesService.getScriptProperties();
  p.setProperty('MATE_AUTO_SEND','OFF');
  p.setProperty('MATE_OUTREACH_PHASE','DAILY_30');
  p.setProperty('MATE_DAILY_CAP','30');
  p.setProperty('MATE_SENDER_NAME','MATE運営事務局');
  return {mode:'DAILY_30_PREPARED_NO_SEND',dailyCap:30,perServiceCap:30,
    sendEnabled:false,sourceVersion:MATE_V4.version};
}
/**
 * Switch an already-authorized live campaign to the owner's target of
 * 30 per service / 90 total per JST day. Configuration only: no mail is sent
 * by this function. All recipient evidence, opt-out, duplicate, sender and
 * Gmail recipient-quota checks remain enforced in mateV4SendOutreach().
 * Must be invoked in the MATE-dedicated Apps Script project after deployment.
 */
function enableMatePerService30V4(){
  mateV4Book_();
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty('MATE_AUTO_SEND')!=='ON'||
     p.getProperty('MATE_AUTO_SEND_LEGAL_REVIEWED')!=='YES'||
     p.getProperty('MATE_LEGAL_ADDRESS_PAGE_VERIFIED')!=='YES'||
     p.getProperty('MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED')!=='YES'||
     !mateV4FormalSenderIdentity_(p).ready||
     !mateV4SenderAddressLooksComplete_(p.getProperty('MATE_SENDER_ADDRESS')))
    throw Error('既存の送信・法務・主体確認が整っていないため、90件モードへの切替を拒否');
  p.setProperty('MATE_DAILY_CAP','90');
  p.setProperty('MATE_OUTREACH_PHASE','PER_SERVICE_30');
  const state={mode:'PER_SERVICE_30',totalDailyTarget:90,perServiceCap:30,
    sendAlreadyEnabled:true,quota:MailApp.getRemainingDailyQuota(),
    actualSendsDependOnVerifiedNewRecipients:true};
  console.log(JSON.stringify(state));
  return state;
}
function mateV4FormalSenderIdentity_(p){
  const name=String(p.getProperty('MATE_FORMAL_SENDER_NAME')||'').trim();
  const mode=String(p.getProperty('MATE_LEGAL_IDENTITY_MODE')||'').trim();
  const globallyVerified=p.getProperty('MATE_FORMAL_SENDER_VERIFIED')==='YES';
  if(name.length<2||!globallyVerified)return {ready:false,mode};
  if(mode==='REGISTERED_TRADE_NAME')
    return {ready:p.getProperty('MATE_TRADE_NAME_REGISTRATION_VERIFIED')==='YES'&&
      !/^(?:MATE運営事務局|NextEdu運営事務局)$/.test(name),mode};
  if(mode==='REGISTERED_COMPANY')
    return {ready:p.getProperty('MATE_COMPANY_REGISTRATION_VERIFIED')==='YES',mode};
  if(mode==='PERSONAL_NAME'){
    // The branded display-name is not a person's legal name.
    const looksLikeBusinessOnly=/^(?:NextEdu|MATE運営事務局|NextEdu運営事務局|MATE|MATE CARE|MATE SPARK|MATE PLAY)$/i.test(name);
    const hasLegalNameShape=/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\s・ー]+$/u.test(name)&&
      name.replace(/\s/g,'').length>=3;
    return {ready:!looksLikeBusinessOnly&&hasLegalNameShape,mode};
  }
  return {ready:false,mode};
}

/**
 * Resolve ambiguous send reservations only when the exact recipient,
 * MATE campaign subject and sender are found in the Gmail Sent mailbox.
 * Never turn an unresolved reservation back into an eligible candidate.
 * Keeps each hourly pass bounded and does not touch prospects or send mail.
 */
function mateV4ReconcileSentReservations(){
  const book=mateV4Book_();
  const tab=mateV4Tab_(book,MATE_V4.sent);
  const pending=mateV4Rows_(tab).filter(x=>x['状態']==='送信結果要確認').slice(-20);
  let confirmed=0,unresolved=0;
  for(const x of pending){
    const address=mateV4Email_(x['宛先メール']);
    const subject=String(x['件名']||'').trim();
    const service=String(x['サービス']||'');
    if(!address||!['CARE','SPARK','PLAY'].includes(service)||
       !subject.startsWith('【MATE '+service+'】無料掲載のご案内')){unresolved++;continue}
    const original=Date.parse(String(x['送信処理日時']||'').replace(' ','T')+'+09:00');
    if(!Number.isFinite(original)){unresolved++;continue}
    const gmailQuery='in:sent to:'+address+' after:'+
      Utilities.formatDate(new Date(original-86400000),'Asia/Tokyo','yyyy/MM/dd');
    let match=null;
    try{
      for(const thread of GmailApp.search(gmailQuery,0,15)){
        for(const msg of thread.getMessages()){
          const from=String(msg.getFrom()||'').toLowerCase();
          const recipient=String(msg.getTo()||'').toLowerCase();
          const at=msg.getDate().getTime();
          if(!from.includes(MATE_V4.account)||!recipient.includes(address)||
             String(msg.getSubject()||'')!==subject||
             at<original-300000||at>original+7200000)continue;
          if(!match||at<match.getDate().getTime())match=msg;
        }
      }
    }catch(e){console.log('SENT_RECONCILIATION_QUERY_FAILED '+String(e).slice(0,120));unresolved++;continue}
    if(!match){unresolved++;continue}
    tab.getRange(x._row,6).setValue('送信済');
    tab.getRange(x._row,9).setValue('Gmail実送信照合済 ID='+String(match.getId()).slice(0,140)+' / 自動再送禁止');
    confirmed++;
  }
  return {checked:pending.length,confirmed,unresolved};
}
function mateV4SendOutreach(){
  const b=mateV4Book_(),p=PropertiesService.getScriptProperties();
  if(p.getProperty('MATE_AUTO_SEND')!=='ON'||p.getProperty('MATE_AUTO_SEND_LEGAL_REVIEWED')!=='YES')return 'OFF';
  const phase=p.getProperty('MATE_OUTREACH_PHASE')||'OFF';
  if(!['PILOT','LIVE','BALANCED_15','DAILY_30','PER_SERVICE_30'].includes(phase))return 'OFF';
  const startDate=p.getProperty('MATE_OUTREACH_START_DATE')||'';
  const today=mateV4Jst_().slice(0,10);
  // Respect the configured start date in every mode, including PILOT and LIVE.
  if(startDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||today<startDate))return 'WAIT_FOR_START_DATE';
  const sender='MATE運営事務局'; // Branding in Gmail's display-name only.
  const formalSender=String(p.getProperty('MATE_FORMAL_SENDER_NAME')||'').trim();
  const address=String(p.getProperty('MATE_SENDER_ADDRESS')||'').trim();
  if(!mateV4SenderAddressLooksComplete_(address)||
     p.getProperty('MATE_LEGAL_ADDRESS_PAGE_VERIFIED')!=='YES')
    throw Error('確認済みの事業所在地と適法な運営者情報URLが必要です');
  // Never silently treat a tax-only trade name as a registered legal name.
  const identity=mateV4FormalSenderIdentity_(p);
  if(!identity.ready)
    throw Error('正式な送信主体の登記・確認が必要です。屋号のみで送信を開始できません。');
  // DAILY_30 limits the account to 30/day; unused slots can be filled by other services. No owner BCC.
  // Each message consumes one recipient-quota unit. Live Gmail quota controls
  // the actual maximum, shared with other sends by this account.
  const maxCap=phase==='PILOT'?1:phase==='BALANCED_15'?15:phase==='DAILY_30'?30:phase==='PER_SERVICE_30'?90:5;
  const cap=Math.min(maxCap,Math.max(0,parseInt(p.getProperty('MATE_DAILY_CAP')||'5',10)||0));
  const perServiceCap=phase==='BALANCED_15'?5:phase==='DAILY_30'?30:phase==='PER_SERVICE_30'?30:cap;
  const maxPerExecution=phase==='DAILY_30'?10:phase==='PER_SERVICE_30'?10:cap;
  const leads=mateV4Rows_(mateV4Tab_(b,MATE_V4.leads));
  const sheet=mateV4Tab_(b,MATE_V4.sent);
  const logs=mateV4Rows_(sheet);
  const blocked=new Set(mateV4Rows_(mateV4Tab_(b,MATE_V4.optouts)).map(x=>x['メール'].toLowerCase()));
  const attempted=new Set(logs.map(x=>x['候補キー']).filter(Boolean));
  const allRecipients=new Set(logs.map(x=>x['宛先メール'].toLowerCase()).filter(Boolean));
  // Includes past manual MATE sales messages not recorded in V4.
  const manualHistory=mateV4HistoricCampaignRecipients_();
  if(phase==='BALANCED_15'){
    const perServiceReady={CARE:0,SPARK:0,PLAY:0};
    for(const x of mateV4BalancedQueue_(leads.filter(x=>x['状態']==='営業可能候補'),today)){
      const service=x['サービス'],email=mateV4Email_(x['業務用メール']),key=x['重複キー'];
      if(mateV4OwnerBlocked_(x)||!(service in perServiceReady)||!email||!key||x['営業拒否']!=='FALSE')continue;
      if(!mateV4Fresh_(x['根拠確認日時'],14)||!mateV4Https_(x['確認元URL']))continue;
      if(!['OPT_IN','SOLICITATIONS_WELCOME','PUBLIC_BUSINESS_EMAIL'].includes(x['メール用途・営業可の根拠']))continue;
      if(x['メール用途・営業可の根拠']==='PUBLIC_BUSINESS_EMAIL'&&
        (p.getProperty('MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED')!=='YES'||!mateV4PublicMailOperatorReview_(x)))continue;
      if(blocked.has(email)||attempted.has(key)||allRecipients.has(email)||manualHistory.has(email))continue;
      perServiceReady[service]++;
    }
    if(Object.keys(perServiceReady).some(service=>perServiceReady[service]<5)){
      console.log(JSON.stringify({mode:'BALANCED_15_NOT_READY_NO_SEND',ready:perServiceReady,requiredPerService:5}));
      return 'BALANCED_15_NOT_READY_NO_SEND';
    }
  }
  const todays=logs.filter(x=>x['送信処理日時'].startsWith(today));
  const already=todays.length;
  const serviceToday={CARE:0,SPARK:0,PLAY:0};
  for(const log of todays)if(Object.prototype.hasOwnProperty.call(serviceToday,log['サービス']))serviceToday[log['サービス']]++;
  let sent=0;
  // No monitoring BCC; keep delivery evidence in the sent folder and send log.
  if(MailApp.getRemainingDailyQuota()<1)return 0;
  for(const x of mateV4BalancedQueue_(leads.filter(x=>x['状態']==='営業可能候補'),today)){
    if(sent+already>=cap||sent>=maxPerExecution||MailApp.getRemainingDailyQuota()<1)break;
    if(mateV4OwnerBlocked_(x)||x['状態']!=='営業可能候補'||x['営業拒否']!=='FALSE')continue;
    if(!mateV4Fresh_(x['根拠確認日時'],14)||!mateV4Https_(x['確認元URL']))continue;
    if(!['OPT_IN','SOLICITATIONS_WELCOME','PUBLIC_BUSINESS_EMAIL'].includes(x['メール用途・営業可の根拠']))continue;
    if(x['メール用途・営業可の根拠']==='PUBLIC_BUSINESS_EMAIL'&&
       (p.getProperty('MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED')!=='YES'||
        !mateV4PublicMailOperatorReview_(x)))continue;
    const email=mateV4Email_(x['業務用メール']);
    const key=x['重複キー'];if(!email||!key||attempted.has(key)||blocked.has(email)||allRecipients.has(email)||manualHistory.has(email))continue;
    const service=x['サービス'];
    if(!['CARE','SPARK','PLAY'].includes(service)||serviceToday[service]>=perServiceCap)continue;
    const landing=service==='PLAY'?'https://care.kosodatemate.jp/play-listing.html':
      service==='SPARK'?'https://spark.kosodatemate.jp/partners.html':'https://care.kosodatemate.jp/contact.html';
    // Aggregate analytics attribution, with no prospect identity in the URL.
    const link=landing+'?utm_source=mate_outreach&utm_medium=email&utm_campaign=free_listing_'+service.toLowerCase();
    const subject='【MATE '+service+'】無料掲載のご案内｜'+x['事業者名'].slice(0,70);
    // Production copy follows the approved service-specific template. Never append
    // the owner-only test disclaimer to an external campaign message.
    // The sender's legal name must remain in the commercial email itself.
    const body=[
      'ご担当者様',
      '',
      '突然のご連絡失礼いたします。子育て家庭向け情報サイト「MATE '+service+'」を運営しております、MATE運営事務局です。',
      '',
      ({CARE:'ベビーシッター・訪問保育など、ご家庭に必要なサポートを探せるCAREの無料掲載をご案内します。',
        SPARK:'幼児から高校生まで、幅広い年齢のお子さまの習い事を探すご家庭に、教室の特色や学びの魅力を届けるMATE SPARKの無料掲載をご案内します。',
        PLAY:'親子向け体験・ワークショップを探す家庭に、体験内容を届けるPLAYの無料掲載をご案内します。'})[service],
      '対象サービスに当てはまらない場合は、そのままご放念ください。',
      '',
      '基本情報の掲載は無料で、掲載料・紹介料はかかりません。',
      '掲載にご興味がありましたら、まずはこのメールに「掲載希望」とご返信いただくだけでも構いません。',
      '正式なお申し込みは、以下のフォームからも受け付けています。',
      link,
      '',
      'ご返信だけで掲載が確定するものではありません。申請内容とご担当者様の権限を確認したうえで、掲載の可否・開始について改めてご案内いたします。',
      'なお、有料プランへ自動的に移行することはございません。',
      '',
      'ご不明な点がございましたら、お気軽に本メールへご返信ください。',
      'また、今後このようなご案内が不要な場合は「配信停止」とご返信ください。以後の送信を停止いたします。',
      '',
      sender,
      '送信責任主体（正式名称）：'+formalSender,
      '所在地：東京都（詳細は下記の運営者情報に掲載）',
      'お問い合わせ・配信停止：'+MATE_V4.account,
      '送信者の正式名称・所在地・お問い合わせ先：https://care.kosodatemate.jp/operator.html'
    ].join('\n');
    // Reserve before external send: ambiguous failures are held, never retried automatically.
    const targetRow=sheet.getLastRow()+1;
    mateV4Append_(sheet,[key,mateV4Jst_(),service,email,subject,'送信結果要確認',x['確認元URL'],x['メール用途・営業可の根拠'],'二重送信防止:実行前に予約']);
    attempted.add(key);allRecipients.add(email);serviceToday[service]++;
    try{
      // Monitoring BCC is intentionally disabled at the owner's request.
      GmailApp.sendEmail(email,subject,body,{name:sender,replyTo:MATE_V4.account});
      sheet.getRange(targetRow,6).setValue('送信済');sent++;
    }catch(err){
      sheet.getRange(targetRow,9).setValue('送信状態はGmail送信済みフォルダで確認: '+String(err).slice(0,150));
    }
  }
  return sent;
}

/**
 * Create INTERNAL review drafts addressed ONLY to the MATE operator.
 * This is NOT an outreach draft to the prospect. Deliberately preserves
 * unverified leads in review, rather than inferring consent from public URLs.
 * Maximum three per JST day, one from each service.
 */
function mateV4PrepareReviewDrafts(){
  const b=mateV4Book_(),props=PropertiesService.getScriptProperties();
  if(props.getProperty('MATE_REVIEW_DRAFTS')==='OFF')return 'OFF';
  const dest=mateV4Tab_(b,'営業審査下書きV4');
  const drafted=mateV4Rows_(dest),today=mateV4Jst_().slice(0,10);
  const done=new Set(drafted.map(x=>x['候補キー']).filter(Boolean));
  const todayCount=drafted.filter(x=>x['作成日時'].startsWith(today)).length;
  if(todayCount>=3)return 0;
  const leads=mateV4Rows_(mateV4Tab_(b,MATE_V4.leads));
  const blocked=new Set(mateV4Rows_(mateV4Tab_(b,MATE_V4.optouts))
    .map(x=>x['メール'].toLowerCase()).filter(Boolean));
  let created=0;
  for(const service of ['CARE','SPARK','PLAY']){
    if(created+todayCount>=3)break;
    const x=leads.find(v=>v['サービス']===service&&
      v['状態']==='窓口確認待ち'&&v['営業拒否']!=='TRUE'&&
      !mateV4OwnerBlocked_(v)&&
      v['重複キー']&&!done.has(v['重複キー'])&&
      mateV4Https_(v['公式URL'])&&
      !blocked.has(mateV4Email_(v['業務用メール'])));
    if(!x)continue;
    const key=x['重複キー'],source=x['確認元URL']||x['公式URL'];
    const subject='【社内確認専用・送信禁止】MATE '+service+' 掲載候補：'+x['事業者名'].slice(0,55);
    const body='MATE運営者向けの営業前チェック（自動生成）\n\n'+
      '事業者：'+x['事業者名']+'\nサービス：'+service+
      '\n公式URL：'+x['公式URL']+'\n確認元URL：'+source+
      '\n旧公開業務メール（再確認前）：'+(mateV4Email_(x['業務用メール'])||'未確認')+
      '\n確認日（旧情報）：'+(x['根拠確認日時']||'未確認')+
      '\n送信可否の根拠：未確認。公開メールの存在だけでは営業送信を許可しない。\n\n'+
      '確認事項：公式窓口の用途／広告メールの拒否表示／現在の連絡先／送信根拠／掲載申請URL。\n'+
      '確認が取れたら営業候補_自動収集の根拠・確認日・状態を人が更新する。\n'+
      'この下書きはMATE運営者自身に宛てており、事業者への営業メールではありません。\n';
    // Reserve before external Gmail draft creation to prevent duplicate drafts
    // if creation succeeds but the following Sheet write fails.
    const row=dest.getLastRow()+1;
    mateV4Append_(dest,[key,mateV4Jst_(),service,x['事業者名'],
      '作成処理中','',source,'内部確認用。営業メール未送信']);
    done.add(key);
    try{
      const draft=GmailApp.createDraft(MATE_V4.account,subject,body);
      dest.getRange(row,5).setValue('社内確認用ドラフト');
      dest.getRange(row,6).setValue(String(draft.getId()).slice(0,180));
      created++;
    }catch(err){
      dest.getRange(row,5).setValue('作成失敗・手動確認');
      dest.getRange(row,8).setValue('自動再試行なし：'+String(err).slice(0,140));
    }
  }
  return created;
}
/** Mark matching MATE campaign replies for human response; never auto-reply. */
function mateV4TrackReplies(){
  const b=mateV4Book_(),sent=mateV4Tab_(b,MATE_V4.sent);
  const candidates=mateV4Tab_(b,MATE_V4.leads);
  const leads=mateV4Rows_(candidates);
  const blocked=new Set(mateV4Rows_(mateV4Tab_(b,MATE_V4.optouts))
    .map(x=>x['メール'].toLowerCase()).filter(Boolean));
  const logs=mateV4Rows_(sent).filter(x=>x['状態']==='送信済').slice(-90);
  let replies=0;
  for(const entry of logs){
    const email=mateV4Email_(entry['宛先メール']),svc=entry['サービス'];
    if(!email||!['CARE','SPARK','PLAY'].includes(svc))continue;
    const sentTime=Date.parse(entry['送信処理日時'].replace(' ','T')+'+09:00');
    if(!Number.isFinite(sentTime))continue;
    try{
      const threads=GmailApp.search('in:inbox newer_than:45d from:'+email,0,8);
      let reply=null;
      for(const thread of threads)for(const msg of thread.getMessages()){
        const raw=String(msg.getFrom()||'').toLowerCase();
        const sender=(raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)||[])[0]||'';
        const subj=String(msg.getSubject()||'');
        if(sender!==email||!subj.includes('MATE '+svc)||msg.getDate().getTime()<sentTime)continue;
        if(!reply||msg.getDate()>reply.getDate())reply=msg;
      }
      if(!reply)continue;
      const stopped=blocked.has(email);
      sent.getRange(entry._row,6).setValue(stopped?'配信停止':'返信あり');
      sent.getRange(entry._row,9).setValue('返信確認 Gmail ID='+String(reply.getId()).slice(0,150));
      const lead=leads.find(x=>x['重複キー']===entry['候補キー']);
      if(lead&&lead['状態']==='営業可能候補'){
        candidates.getRange(lead._row,14).setValue(stopped?'配信禁止':'返信あり・要対応');
        candidates.getRange(lead._row,15).setValue(stopped?'配信停止':'返信あり・人による対応待ち');
      }
      replies++;
    }catch(err){
      // A temporary Gmail read error must never cause a resend.
      console.log('返信確認を保留: '+String(err).slice(0,150));
    }
  }
  return replies;
}

function mateV4SyncReferralLedger(){
  const b=mateV4Book_(),inquiries=mateV4Rows_(mateV4Tab_(b,MATE_V4.inquiries));
  const dest=mateV4Tab_(b,MATE_V4.referrals);
  const seen=new Set(mateV4Rows_(dest).map(x=>x['イベントID']).filter(Boolean));
  let count=0;
  for(const x of inquiries){
    const id=x['受付ID'];const service=x['サービス'],provider=x['事業者・教室ID'];
    if(!/^[A-Za-z0-9_-]{12,110}$/.test(id||'')||!['CARE','SPARK','PLAY'].includes(service)||!provider)continue;
    const permission=x['掲載許諾確認']==='確認済み'&&x['体験取次許諾確認']==='確認済み'&&x['保護者の情報提供同意']==='確認済み';
    if(!permission||!x['GmailメッセージID/証跡']||!x['教室への取次日時'])continue;
    const key='REF-'+id;
    if(!seen.has(key)&&['教室へ取次','結果確認','完了'].includes(x['進捗'])){
      mateV4Append_(dest,[key,mateV4Jst_(),service,provider,x['対象教室・事業者名'],'取次実施',id,
        '有効',x['GmailメッセージID/証跡'],x['教室への取次日時'],'未確認','','0','0',
        x['GmailメッセージID/証跡'],'保護者情報を保存しない。送信実行の証跡はGmail側で照合。']);
      seen.add(key);count++;
    }
    const resultId='RESULT-'+id;
    if(!seen.has(resultId)&&x['結果確認日']&&['結果確認','完了'].includes(x['進捗'])){
      mateV4Append_(dest,[resultId,mateV4Jst_(),service,provider,x['対象教室・事業者名'],'結果確認',id,
        '有効',x['GmailメッセージID/証跡'],x['教室への取次日時'],x['結果']||'未確認',
        x['結果確認日'],'0','0',x['GmailメッセージID/証跡'],'有料成果確定とは別。']);
      seen.add(resultId);count++;
    }
  }
  return count;
}
/**
 * Operator-only, read-only health report: no emails and no sheet mutations.
 * Counts all rows, remaining sendable candidates and CSV source outcomes.
 * Run in Apps Script before increasing outreach volume.
 */
/**
 * Read-only, conservative outbound-to-listing attribution.
 * Counts ONLY non-test, non-rejected applications whose exact normalized
 * company name matches a prior sent campaign for the same service.
 * A match means correlation, not proof that email caused the application.
 * No prospect or applicant PII appears in the returned diagnostics.
 */
function diagnoseMateOutreachApplicationsV4(){
  const b=mateV4Book_();
  const logs=mateV4Rows_(mateV4Tab_(b,MATE_V4.sent))
    .filter(x=>['送信済','返信あり','配信停止'].includes(x['状態']));
  const applications=mateV4Rows_(mateV4Tab_(b,'掲載セルフ申請'));
  const normalized=s=>String(s||'').normalize('NFKC').toLowerCase()
    .replace(/(?:株式会社|合同会社|有限会社|一般社団法人|特定非営利活動法人|npo法人)/gi,'')
    .replace(/[\s　・（）()\[\]【】]/g,'').trim();
  const sentByName=new Map();
  for(const row of logs){
    const svc=row['サービス'];
    const title=String(row['件名']||'');
    const marker='【MATE '+svc+'】無料掲載のご案内｜';
    if(!title.startsWith(marker))continue;
    const name=normalized(title.slice(marker.length));
    const sentAt=Date.parse(String(row['送信処理日時']||'').replace(' ','T')+'+09:00');
    if(!name||!Number.isFinite(sentAt))continue;
    const key=svc+'|'+name;
    sentByName.set(key,Math.min(sentByName.get(key)||sentAt,sentAt));
  }
  const byService={CARE:{realApplications:0,nameMatchesAfterSend:0},
    SPARK:{realApplications:0,nameMatchesAfterSend:0},
    PLAY:{realApplications:0,nameMatchesAfterSend:0}};
  const seenIds=new Set();
  for(const row of applications){
    const svc=row['サービス'],name=String(row['教室・事業者名']||'');
    if(!byService[svc])continue;
    const id=String(row['申請ID']||'').trim();
    if(!id||seenIds.has(id))continue;
    seenIds.add(id);
    const joined=[id,name,row['紹介文'],row['掲載申請の意思'],row['保留・差戻し理由']]
      .map(x=>String(x||'')).join(' ');
    if(/テスト|ダミー|架空|内部接続|非公開|運営確認|接続確認/i.test(joined)||
       row['審査状態']==='差戻し')continue;
    const received=Date.parse(String(row['受信日時']||'').replace(' ','T')+'+09:00');
    if(!Number.isFinite(received))continue;
    byService[svc].realApplications++;
    const firstSent=sentByName.get(svc+'|'+normalized(name));
    if(firstSent&&received>=firstSent)byService[svc].nameMatchesAfterSend++;
  }
  return {method:'EXACT_NORMALIZED_NAME_AND_SERVICE_AFTER_SEND',
    caveat:'Name match is not causal attribution. Internal tests and rejected requests excluded.',
    byService};
}
/**
 * Diagnostic funnel with mutually exclusive reasons for every lead.
 * This is a snapshot; eligibility depends on future Gmail and quota checks.
 * No external email, website request, or sheet write occurs.
 */
function diagnoseMateV4Backlog(){
  const b=mateV4Book_();
  const p=PropertiesService.getScriptProperties();
  const leads=mateV4Rows_(mateV4Tab_(b,MATE_V4.leads));
  const attempts=mateV4Rows_(mateV4Tab_(b,MATE_V4.sent));
  const blocked=new Set(mateV4Rows_(mateV4Tab_(b,MATE_V4.optouts))
    .map(x=>mateV4Email_(x['メール'])).filter(Boolean));
  const attemptedKeys=new Set(attempts.map(x=>x['候補キー']).filter(Boolean));
  const attemptedEmails=new Set(attempts.map(x=>mateV4Email_(x['宛先メール'])).filter(Boolean));
  const categories=['alreadyAttempted','expressRefusalOrOptout','invalidOrMissingEmail',
    'notReadyStatus','expiredEvidence','badSourceEvidence','publicEmailReview',
    'validWithoutGmailHistoryCheck'];
  const make=()=>Object.fromEntries(categories.map(k=>[k,0]));
  const counts={CARE:make(),SPARK:make(),PLAY:make()};
  for(const x of leads){
    const svc=x['サービス'];
    if(!counts[svc])continue;
    const email=mateV4Email_(x['業務用メール']);
    const key=x['重複キー'];
    const reason=!key||attemptedKeys.has(key)||(email&&attemptedEmails.has(email))?
      'alreadyAttempted':
      mateV4OwnerBlocked_(x)||x['営業拒否']==='TRUE'||blocked.has(email)?
      'expressRefusalOrOptout':
      !email?'invalidOrMissingEmail':
      x['状態']!=='営業可能候補'||x['営業拒否']!=='FALSE'?
      'notReadyStatus':
      !mateV4Fresh_(x['根拠確認日時'],14)?
      'expiredEvidence':
      !mateV4Https_(x['確認元URL'])||
        !['OPT_IN','SOLICITATIONS_WELCOME','PUBLIC_BUSINESS_EMAIL'].includes(x['メール用途・営業可の根拠'])?
      'badSourceEvidence':
      x['メール用途・営業可の根拠']==='PUBLIC_BUSINESS_EMAIL'&&
        (p.getProperty('MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED')!=='YES'||
         !mateV4PublicMailOperatorReview_(x))?
      'publicEmailReview':'validWithoutGmailHistoryCheck';
    counts[svc][reason]++;
  }
  return {total:leads.length,counts,notes:{
    alreadyAttempted:'includes ambiguous reservations; never auto-retry',
    validWithoutGmailHistoryCheck:'preliminary only, Gmail manual-send history and quota still apply',
    notReadyStatus:'includes pending official-contact audits and explicit review holds'}};
}
function diagnoseMateV4Health(){
  const b=mateV4Book_(),p=PropertiesService.getScriptProperties();
  const pre=JSON.parse(previewMateOutreachReadinessV4());
  const leads=mateV4Rows_(mateV4Tab_(b,MATE_V4.leads));
  const sent=mateV4Rows_(mateV4Tab_(b,MATE_V4.sent));
  const sources=mateV4Rows_(mateV4Tab_(b,MATE_V4.sources));
  const today=mateV4Jst_().slice(0,10);
  const counts={CARE:{all:0,ready:0},SPARK:{all:0,ready:0},PLAY:{all:0,ready:0}};
  for(const x of leads){
    if(!Object.prototype.hasOwnProperty.call(counts,x['サービス']))continue;
    counts[x['サービス']].all++;
    if(x['状態']==='営業可能候補')counts[x['サービス']].ready++;
  }
  const sentToday=sent.filter(x=>x['送信処理日時'].startsWith(today));
  const failures=sent.filter(x=>x['状態']==='送信結果要確認'||x['状態']==='送信失敗').length;
  const eligible=pre.eligibleByScriptChecks;
  const applicationAttribution=diagnoseMateOutreachApplicationsV4();
  const outreachBacklog=diagnoseMateV4Backlog();
  const checks={
    active:pre.automationSwitch==='ON',
    phase:pre.phase,
    legalReviewed:pre.legalReviewFlag,
    registeredIdentityReady:pre.registeredSenderIdentityReady,
    senderAddressReady:pre.senderAddressSet&&pre.legalAddressPageVerified,
    bccEnabled:false,
    bccCodePolicy:'DISABLED_IN_THIS_SOURCE_ONLY',
    otherProjectsNotInspected:true,
    pilotDailyCap:pre.phase==='PILOT'?1:pre.dailyCap,
    configuredStartDate:pre.outreachStartDate,
    currentDate:today,
    startDateReached:!pre.outreachStartDate||today>=pre.outreachStartDate,
    activeSourceCount:sources.filter(x=>x['有効']==='TRUE'&&x['再利用許諾確認']==='確認済み').length,
    activeSourcesByService:Object.fromEntries(['CARE','SPARK','PLAY'].map(s=>[
      s,sources.filter(x=>x['サービス']===s&&x['有効']==='TRUE'&&x['再利用許諾確認']==='確認済み').length
    ])),
    catalogDiscoveryLastChecked:p.getProperty('MATE_SOURCE_CATALOG_DISCOVERY_LAST')||'',
    catalogDiscoveryEnabled:p.getProperty('MATE_SOURCE_CATALOG_DISCOVERY')!=='OFF',
    sourceResults:sources.filter(x=>x['有効']==='TRUE').map(x=>({
      service:x['サービス'],name:x['ソース名'],
      lastResult:x['前回結果']||'未実行',lastImportedAt:x['最終取込日時']||''
    })),
    candidateCounts:counts,scriptEligible:eligible,
    outreachBacklog,
    applicationAttribution,
    sentToday:sentToday.length,
    dailyRemainingCapacity:Math.max(0,pre.dailyCap-sentToday.length),
    confirmedSentToday:sentToday.filter(x=>x['状態']==='送信済').length,
    respondedOrStoppedTotal:sent.filter(x=>['返信あり','配信停止'].includes(x['状態'])).length,
    sentTodayByService:Object.fromEntries(['CARE','SPARK','PLAY'].map(s=>[
      s,sentToday.filter(x=>x['サービス']===s&&x['状態']==='送信済').length
    ])),
    ambiguousOrFailedSendLogRows:failures,
    replyCount:sent.filter(x=>x['状態']==='返信あり').length,
    optOutCount:sent.filter(x=>x['状態']==='配信停止').length,
    responseRatePercent:sent.filter(x=>['送信済','返信あり','配信停止'].includes(x['状態'])).length?
      Math.round(10000*sent.filter(x=>x['状態']==='返信あり').length/
        sent.filter(x=>['送信済','返信あり','配信停止'].includes(x['状態'])).length)/100:0,
    totalConfirmedSends:sent.filter(x=>x['状態']==='送信済').length,
    notProofOfLegalPermission:true
  };
  console.log(JSON.stringify(checks));return checks;
}

/**
 * Minimal production heartbeat. A source commit is NOT proof of GAS execution.
 * Row 2 changes only when the Apps Script runtime actually executes V4 cycle.
 * No recipient addresses, API keys, child data, or Gmail contents are logged.
 */
/**
 * Bounded conversion of free-search candidates into the official-site audit.
 * A map/search listing is NEVER evidence of an inbox or permission to email.
 * Stage records first, verify the business name on the first-party HTTPS
 * homepage (no redirects), then create an UNVERIFIED lead for separate audit.
 */
function mateV4PromoteFreeWebCandidates(){
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty('MATE_WEB_PROMOTION')==='OFF')return 'OFF';
  const b=mateV4Book_(),queue=mateV4Tab_(b,'営業候補_Web検索_未確認');
  const leads=mateV4Tab_(b,MATE_V4.leads);
  const existing=mateV4Rows_(leads);
  const known=new Set(existing.map(x=>x['サービス']+'|'+mateV4Host_(x['公式URL'])));
  const candidates=mateV4Rows_(queue).filter(x=>
    x['状態']==='公式URL・運営者未確認'||x['状態']==='公式サイト・運営者未確認');
  let checked=0,promoted=0,duplicates=0,notMatched=0;
  const eligible=['CARE','SPARK','PLAY'];
  const compact=text=>String(text||'').normalize('NFKC').toLowerCase()
    .replace(/(?:株式会社|有限会社|合同会社|一般社団法人|特定非営利活動法人|npo法人)/g,'')
    .replace(/[\s　\-_・。、．,.:：;；｜|()[\]（）【】]/g,'');
  for(const x of candidates){
    if(checked>=4)break;
    const service=x['サービス'];
    const site=mateV4CandidateHttps_(x['候補URL']);
    const host=mateV4Host_(site),name=String(x['検索タイトル']||'').trim();
    const key=service+'|'+host;
    if(!eligible.includes(service)||!host||name.length<4||
       mateV4OwnerBlocked_({'事業者名':name,'公式URL':site})){
      queue.getRange(x._row,7).setValue('対象外・サイト不備');continue;
    }
    if(known.has(key)){
      duplicates++;queue.getRange(x._row,7).setValue('営業候補DBに登録済み');continue;
    }
    checked++;
    try{
      // Only one first-party GET per candidate; no form interaction.
      const response=UrlFetchApp.fetch('https://'+host+'/',{
        muteHttpExceptions:true,followRedirects:false,timeout:12000,
        headers:{Accept:'text/html'}});
      const mime=String(response.getHeaders()['Content-Type']||
        response.getHeaders()['content-type']||'');
      if(response.getResponseCode()!==200||!/text\/html/i.test(mime)){
        queue.getRange(x._row,7).setValue('公式HTTPS照合不可');notMatched++;continue;
      }
      const html=response.getContentText('UTF-8').slice(0,150000);
      const visible=compact(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
        .replace(/<[^>]+>/g,' '));
      const search=compact(name);
      // Only unambiguous name matches are promoted; shorter names and
      // generic search-result headlines are left for independent review.
      if(search.length<6||!visible.includes(search)){
        queue.getRange(x._row,7).setValue('事業者名称の照合待ち');notMatched++;continue;
      }
      const unique=mateV4Key_(service,site,name);
      mateV4Append_(leads,[
        'WEB-VERIFIED-'+unique,mateV4Jst_(),service,name,'https://'+host+'/',
        '', '', '',site,'UNVERIFIED','',unique,'未確認','窓口確認待ち',
        'FREE_WEB_FIRST_PARTY_NAME_MATCH '+mateV4Jst_()+
        ' / 公式サイト名の一致のみ。営業先メール・法的送信根拠は未確認。',
        '発見元:'+String(x['検索語']||'').slice(0,100)+
        ' / © OpenStreetMap contributors (OSM由来の場合)'
      ]);
      known.add(key);promoted++;
      queue.getRange(x._row,7).setValue('公式名称照合済・営業DB移行（送信未承認）');
    }catch(err){
      notMatched++;queue.getRange(x._row,7).setValue('公式サイト取得失敗・再確認待ち');
    }
  }
  return {checked,promoted,duplicates,notMatched,sendApproved:0};
}

/**
 * KPI counts are evidence-gated and read only existing ledgers.
 * "Third-party confirmed" needs explicit external ownership evidence in the
 * publication review ledger, not a plausible business name or sent email.
 * No approvals, publishing, invoices, outreach, or applicant edits.
 */
function mateV4ExternalListingFunnel_(){
  const book=mateV4Book_();
  const leads=mateV4Rows_(mateV4Tab_(book,MATE_V4.leads));
  const sent=mateV4Rows_(mateV4Tab_(book,MATE_V4.sent));
  const apps=mateV4Rows_(mateV4Tab_(book,'掲載セルフ申請'));
  const approvals=mateV4Rows_(mateV4Tab_(book,'掲載公開承認V1_運営専用'));
  const today=mateV4Jst_().slice(0,10);
  const services=['CARE','SPARK','PLAY'];
  const summary=Object.fromEntries(services.map(s=>[s,{
    candidates:0,sent:0,sentToday:0,allApplications:0,heldOrTest:0,
    verifiedExternalApplications:0,verifiedExternalPublications:0
  }]));
  const seenApps=new Set(),seenPublic=new Set();
  for(const x of leads)if(summary[x['サービス']]&&x['重複キー'])
    summary[x['サービス']].candidates++;
  for(const x of sent){
    const entry=summary[x['サービス']];
    if(!entry||!['送信済','返信あり','配信停止'].includes(x['状態']))continue;
    entry.sent++;
    if(String(x['送信処理日時']||'').slice(0,10)===today)entry.sentToday++;
  }
  const reviews=new Map();
  for(const x of approvals){
    const id=String(x['申請ID']||'').trim();
    if(id&&!reviews.has(id))reviews.set(id,x);
  }
  for(const x of apps){
    const service=x['サービス'],entry=summary[service];
    const id=String(x['申請ID']||'').trim();
    if(!entry||!id||seenApps.has(id))continue;
    seenApps.add(id);entry.allApplications++;
    const review=reviews.get(id);
    const name=String(x['教室・事業者名']||'');
    const site=String(x['公式URL']||'');
    const note=[name,x['紹介文'],x['保留・差戻し理由'],x['掲載申請の意思'],
      review&&review['備考']].join(' ');
    const own=/\b(?:nextedu|codecamp|kosodatemate|github\.io|script\.google\.com)\b/i.test(site)||
      /テスト|ダミー|架空|内部接続|接続確認|非公開|斎藤|サイトウ|codecamp|コードキャンプ/i.test(note);
    const status=x['審査状態'],authority=x['担当者権限の確認'];
    const verifiedByThirdParty=review&&String(review['権限確認証跡']||'')
      .includes('THIRD_PARTY_VERIFIED:');
    // An owner attestation, even if previously approved, is not third-party
    // acquisition evidence. An explicit separate third-party proof is needed.
    const verified=!own&&mateV4Https_(site)&&status!=='差戻し'&&
      authority==='確認済み'&&verifiedByThirdParty&&
      review['サービス']===service&&review['申請ID']===id;
    if(!verified){entry.heldOrTest++;continue;}
    entry.verifiedExternalApplications++;
    const published=review['進捗']==='公開確認済み'&&
      String(review['公開URL']||'').startsWith('https://')&&
      /(?:care|spark|play)\.kosodatemate\.jp/.test(String(review['公開URL']))&&
      review['公開用ID']&&review['公開用ID']===x['公開ID']&&
      review['操作']==='掲載承認';
    const publicKey=service+'|'+String(review['公開用ID']||'');
    if(published&&!seenPublic.has(publicKey)){
      seenPublic.add(publicKey);entry.verifiedExternalPublications++;
    }
  }
  return {today,summary,method:'EXPLICIT_THIRD_PARTY_PROOF_AND_PUBLIC_URL',
    caveat:'Owner, tests, unverified, rejected and unpublished applications are not external published results'};
}
function mateV4RefreshExternalListingKpi_(){
  const metric=mateV4ExternalListingFunnel_();
  const sheet=mateV4Tab_(mateV4Book_(),'MATE_外部掲載成果KPI_V1');
  const rows=['CARE','SPARK','PLAY'].map(s=>{
    const a=metric.summary[s],rate=(num,den)=>den>0?num/den:0;
    const issue=a.candidates===0?'新規候補の収集':
      a.verifiedExternalApplications===0?'外部事業者の権限確認済み申請を獲得':
      a.verifiedExternalPublications===0?'外部申請の承認・実公開を確認':
      '公開掲載数と申請から公開までの転換率を向上';
    return [s,a.candidates,a.sent,a.sentToday,a.allApplications,
      a.heldOrTest,a.verifiedExternalApplications,a.verifiedExternalPublications,
      rate(a.verifiedExternalApplications,a.sent),rate(a.verifiedExternalPublications,a.verifiedExternalApplications),
      issue,mateV4Jst_()];
  });
  sheet.getRange(2,1,3,12).setValues(rows);
  sheet.getRange(2,9,3,2).setNumberFormat('0.0%');
  // Daily trend is an idempotent snapshot, not a new application or approval.
  // Re-running the cycle updates today's existing row instead of doubling it.
  const trend=mateV4Tab_(mateV4Book_(),'MATE_外部掲載日次推移_V1');
  const today=mateV4Jst_().slice(0,10);
  const previous=mateV4Rows_(trend);
  for(const row of rows){
    const service=row[0],snapshot=[today,service,row[1],row[2],row[3],
      row[4],row[6],row[7],row[6]>0?row[7]/row[6]:0,
      '第三者証跡・公開URL確認ベース',mateV4Jst_()];
    const existing=previous.find(x=>x['集計日']===today&&x['サービス']===service);
    if(existing)trend.getRange(existing._row,1,1,11).setValues([snapshot]);
    else mateV4Append_(trend,snapshot);
  }
  return {actualExternalApplications:rows.reduce((s,r)=>s+r[6],0),
    actualExternalPublications:rows.reduce((s,r)=>s+r[7],0)};
}

/**
 * Capture genuinely interested REPLIES to previously sent MATE campaigns.
 * No mail sending, publication, contract, invoice or copied message bodies.
 * Suppression / STOP requests take precedence over positive intent.
 */
/**
 * Return only the new text in a reply. Email clients append earlier messages,
 * where our own template already contains the opt-in and unsubscribe phrases.
 * Conservative when quote boundaries are unclear: do not auto-classify.
 */
function mateV4ReplyWithoutQuotedCampaign_(raw){
  const plain=String(raw||'').slice(0,12000).replace(/\r\n?/g,'\n');
  const parts=plain.split('\n');
  const newLines=[];
  for(const line of parts){
    const x=line.trim();
    if(/^>/.test(x)||/^[-_]{4,}\s*(?:original message|転送|引用)/i.test(x)||
       /^(?:On .{0,130}wrote:|差出人\s*[:：]|From\s*[:：]|送信元\s*[:：]|-----Original Message-----)/i.test(x)||
       /^\d{4}年\d{1,2}月\d{1,2}日.{0,120}(?:書きました|wrote)/i.test(x)||
       /^-{5,}\s*$/.test(x))break;
    newLines.push(line);
  }
  return newLines.join('\n').trim();
}

function mateV4CaptureListingIntent_(){
  const book=mateV4Book_();
  const sheet=mateV4Tab_(book,'MATE_掲載希望返信キュー_V1');
  const prior=new Set(mateV4Rows_(sheet).map(x=>x['GmailメッセージID']).filter(Boolean));
  const logs=mateV4Rows_(mateV4Tab_(book,MATE_V4.sent));
  const recipients=new Map(),services=['CARE','SPARK','PLAY'];
  for(const x of logs){
    if(!services.includes(x['サービス'])||
       !['送信済','返信あり','配信停止'].includes(x['状態']))continue;
    const email=mateV4Email_(x['宛先メール']);
    const sent=Date.parse(String(x['送信処理日時']||'').replace(' ','T')+'+09:00');
    if(!email||!Number.isFinite(sent))continue;
    if(!recipients.has(email)||recipients.get(email).sent>sent)
      recipients.set(email,{service:x['サービス'],sent,
        campaign:x['件名']});
  }
  if(!recipients.size)return {newInterests:0,scanned:0};
  const stopped=new Set(mateV4Rows_(mateV4Tab_(book,MATE_V4.optouts))
    .map(x=>String(x['メール']||'').trim().toLowerCase()));
  let scanned=0,added=0;
  for(const thread of GmailApp.search('in:inbox newer_than:30d',0,65)){
    if(scanned>=120)break;
    for(const msg of thread.getMessages()){
      if(scanned++>=120)break;
      const id=String(msg.getId()||'');
      if(!id||prior.has(id))continue;
      const from=String(msg.getFrom()||'').toLowerCase();
      const match=from.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
      const email=match&&match[0],campaign=recipients.get(email);
      if(!campaign||stopped.has(email)||msg.getDate().getTime()<campaign.sent)continue;
      const subject=String(msg.getSubject()||'');
      // Exclude unrelated customer emails even if sent from the same mailbox.
      if(!subject.includes('MATE '+campaign.service))continue;
      // Inspect only the sender's newly written reply, not our quoted
      // original campaign (which already contains "掲載希望" and "配信停止").
      const body=mateV4ReplyWithoutQuotedCampaign_(msg.getPlainBody()).slice(0,750).trim();
      if(!body)continue;
      if(/配信停止|メール不要|今後連絡不要|unsubscribe|stop/i.test(body))continue;
      if(!/掲載希望|掲載したい|掲載を希望|掲載について(?:相談|質問)|掲載に興味|登録したい|掲載をご相談/i.test(body))continue;
      const company=String(campaign.campaign||'').split('｜').slice(1).join('｜');
      mateV4Append_(sheet,[id,mateV4Jst_(),campaign.service,email,
        company,subject.slice(0,100),'要返信・申請案内',
        '既存のMATE営業に対する本人返信。本文は保存していない。公開許諾ではない。',
        '','審査と掲載意思の確認後のみ公開可。配信停止照合済み。']);
      prior.add(id);added++;
      if(added>=15)break;
    }
    if(added>=15)break;
  }
  return {newInterests:added,scanned};
}

/**
 * Reply once to explicit, genuine listing-interest replies from contacted
 * businesses. This is an application invitation, NOT authorization to publish.
 * Reserve before Gmail send so ambiguous failures never trigger a resend.
 */
function mateV4AcknowledgeListingInterests_(){
  const book=mateV4Book_(),queue=mateV4Tab_(book,'MATE_掲載希望返信キュー_V1');
  const optouts=new Set(mateV4Rows_(mateV4Tab_(book,MATE_V4.optouts))
    .map(x=>mateV4Email_(x['メール'])).filter(Boolean));
  const landing={
    CARE:'https://care.kosodatemate.jp/contact.html',
    SPARK:'https://spark.kosodatemate.jp/partners.html',
    PLAY:'https://care.kosodatemate.jp/play-listing.html'
  };
  let done=0,held=0;
  for(const x of mateV4Rows_(queue)){
    if(x['状態']!=='要返信・申請案内'||done>=5)continue;
    const svc=String(x['サービス']||''),email=mateV4Email_(x['送信先メール']);
    if(!landing[svc]||!email||optouts.has(email)){held++;continue}
    let msg;
    try{
      msg=GmailApp.getMessageById(String(x['GmailメッセージID']||''));
      const from=mateV4Email_(String(msg.getFrom()||'').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]||'');
      if(from!==email||!String(msg.getSubject()||'').includes('MATE '+svc)){
        held++;continue;
      }
      const own=mateV4ReplyWithoutQuotedCampaign_(msg.getPlainBody()).slice(0,750);
      if(/配信停止|メール不要|今後連絡不要|unsubscribe|stop/i.test(own)||
         !/掲載希望|掲載したい|掲載を希望|登録したい|掲載に興味/.test(own)){
        held++;continue;
      }
      if(MailApp.getRemainingDailyQuota()<1)break;
      // Reserve first: never retry an ambiguous Gmail reply result.
      queue.getRange(x._row,7).setValue('申請案内送信結果要確認');
      queue.getRange(x._row,9).setValue(mateV4Jst_());
      const body=[
        '掲載についてご関心をお寄せいただき、ありがとうございます。MATE運営事務局です。',
        '',
        '基本情報の掲載は無料で、掲載料・紹介料はかかりません。',
        '以下のフォームから事業者情報をご登録いただけますと、掲載内容・申請者様の権限を確認したうえでご案内できます。',
        landing[svc],
        '',
        'ご不明な点はこのメールへの返信でお気軽にご相談ください。',
        'フォーム登録やこの返信だけで、自動的に掲載公開・契約・課金されることはありません。',
        '',
        'MATE運営事務局（NextEdu）',
        '運営者情報：https://care.kosodatemate.jp/operator.html',
        'ご案内不要の場合は「配信停止」とお知らせください。'
      ].join('\n');
      msg.reply(body,{name:'MATE運営事務局',replyTo:MATE_V4.account});
      queue.getRange(x._row,7).setValue('申請案内送信済・正式申請待ち');
      queue.getRange(x._row,10).setValue('本人成りすましなしの返信を照合。自動公開なし。再送禁止。');
      done++;
    }catch(err){
      // State remains held/ambiguous and is never auto retried.
      console.log('LISTING_REPLY_SEND_STATUS_UNVERIFIED '+String(err).slice(0,140));
      held++;
    }
  }
  return {acknowledged:done,held};
}

function mateV4ProductionHeartbeat_(report){
  const book=mateV4Book_();
  const sheet=mateV4Tab_(book,'GAS本番稼働監視V4');
  const leads=mateV4Rows_(mateV4Tab_(book,MATE_V4.leads));
  const count=Object.fromEntries(['CARE','SPARK','PLAY'].map(s=>[
    s,leads.filter(x=>x['サービス']===s).length]));
  const small=r=>{
    if(r==null)return 'NO_RESULT';
    return JSON.stringify(r).slice(0,250);
  };
  const stepFailures=Object.entries(report||{}).filter(([key,value])=>
    key!=='productionHeartbeat'&&value&&typeof value==='object'&&
    value.status==='FAILED_NO_SIDE_EFFECT_ASSUMED_FALSE').map(([key])=>key);
  const status=stepFailures.length?'CYCLE_PARTIAL: '+stepFailures.join(',').slice(0,140):
    report&&Object.keys(report).length?'CYCLE_COMPLETED':'EMPTY_CYCLE';
  const numericSend=Number(report&&report.outreach);
  const safeSend=Number.isFinite(numericSend)?numericSend:0;
  // Compact operational telemetry: why an hourly cycle produced no mail.
  const audit=report&&report.publicAudit;
  const kpi=report&&report.externalListingKpi;
  const interest=report&&report.listingIntent;
  const diagnostics={audit:typeof audit==='object'&&audit?
    {checked:audit.checked||0,eligible:audit.eligible||0,newMail:audit.discovered||0}:audit||'NO_AUDIT',
    interest:interest&&interest.newInterests||0,
    externalApps:kpi&&kpi.actualExternalApplications||0,
    public:kpi&&kpi.actualExternalPublications||0};
  sheet.getRange(2,1,1,11).setValues([[
    mateV4Jst_(),MATE_V4.version,leads.length,
    count.CARE,count.SPARK,count.PLAY,
    small(report.freeOsmDiscovery),
    small(report.generalWebDiscovery),
    safeSend,
    small(diagnostics),
    status
  ]]);
  return {version:MATE_V4.version,codeRunning:true,total:leads.length};
}

function mateAutoOpsV4Cycle(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return 'SKIP_LOCK';
  // Persist runtime identity BEFORE any data source can fail. This is proof
  // of live execution, not proof of successful synchronization or outreach.
  try{
    const sheet=mateV4Tab_(mateV4Book_(),'GAS本番稼働監視V4');
    sheet.getRange(2,1).setValue(mateV4Jst_());
    sheet.getRange(2,2).setValue(MATE_V4.version);
    sheet.getRange(2,11).setValue('CYCLE_STARTED');
  }catch(err){console.log('PRODUCTION_START_HEARTBEAT_FAILED '+String(err).slice(0,120));}
  try{
    // Heavy free discovery, CSV imports and contact audit cannot all run
    // together reliably under the GAS execution-time limit. Rotate one
    // discovery phase per hour while keeping opt-outs and sending checks live.
    const props=PropertiesService.getScriptProperties();
    const phaseIndex=Number(props.getProperty('MATE_V4_WORK_PHASE')||0)%3;
    props.setProperty('MATE_V4_WORK_PHASE',String((phaseIndex+1)%3));
    const safe=(name,fn)=>{
      try{return fn()}catch(e){
        console.log('V4_STEP_FAILED '+name+' '+String(e).slice(0,150));
        return {step:name,status:'FAILED_NO_SIDE_EFFECT_ASSUMED_FALSE'};
      }
    };
    const report={phaseIndex};
    // Install an independent, inexpensive sender check every 15 minutes.
    // The full discovery cycle still runs hourly. Existing quotas and
    // suppression guards remain in mateV4SendOutreach().
    report.fastSendTrigger=safe('fastSendTrigger',()=>mateV4EnsureFastOutreachTrigger_());
    // Real application/publication outcomes are the primary KPI. Refresh on
    // EVERY hourly cycle instead of waiting up to three discovery phases.
    report.externalListingKpi=safe('externalListingKpi',mateV4RefreshExternalListingKpi_);
    if(phaseIndex===0){
      report.crmSeeded=safe('crmSeeded',mateV4SeedExistingCRM);
      report.sectorSeeded=safe('sectorSeeded',mateV4SeedSectorDirectories);
      report.catalogDiscovery=safe('catalogDiscovery',mateV4DiscoverLicensedPublicCsvSources);
    }else if(phaseIndex===1){
      report.generalWebDiscovery=safe('generalWebDiscovery',mateV4DiscoverGeneralWebProspects);
      report.collected=safe('collected',mateV4CollectLeads);
    }else{
      report.freeOsmDiscovery=safe('freeOsmDiscovery',mateV4DiscoverFreeOsmCandidates);
      report.freeWebPromoted=safe('freeWebPromoted',mateV4PromoteFreeWebCandidates);
    }
    // Suppression and ambiguous-send reconciliation must be successful BEFORE
    // any external sends. Never send on an opt-out processing failure.
    report.optouts=mateV4OptoutInbox();
    report.hardBounces=mateV4HardBounceQuarantine();
    report.reconciledSent=mateV4ReconcileSentReservations();
    // Owner-approved 30 per service target. Never bypass existing sender,
    // legal, quota, opt-out or duplicate gates. A missing prerequisite leaves
    // live settings untouched and is recorded without hiding cycle success.
    if(props.getProperty('MATE_OUTREACH_PHASE')==='DAILY_30'&&
       props.getProperty('MATE_AUTO_SEND')==='ON'){
      try{report.capacityTarget=enableMatePerService30V4()}
      catch(e){report.capacityTarget={mode:'AWAITING_VERIFIED_PRECONDITIONS',
        reason:'90_PER_DAY_ENABLE_GUARD'};}
    }
    // Capture warm applicant intent before slow site audits or reply sweeps.
    // This is read-only Gmail inspection and internal queue creation only.
    report.listingIntent=safe('listingIntent',mateV4CaptureListingIntent_);
    report.listingAcknowledgements=safe('listingAcknowledgements',mateV4AcknowledgeListingInterests_);
    report.publicAudit=safe('publicAudit',mateV4AuditOfficialContacts);
    report.reviewDrafts=safe('reviewDrafts',mateV4PrepareReviewDrafts);
    report.referrals=safe('referrals',mateV4SyncReferralLedger);
    report.outreach=mateV4SendOutreach();
    report.replies=safe('replies',mateV4TrackReplies);
    // Heartbeat is best-effort; it cannot block legitimate email cycle work.
    try{report.productionHeartbeat=mateV4ProductionHeartbeat_(report)}
    catch(err){console.log('PRODUCTION_HEARTBEAT_FAILED '+String(err).slice(0,120));}
    console.log(JSON.stringify(report));return report;
  }catch(err){
    // Keep original failure visible in Apps Script execution history.
    try{
      const sheet=mateV4Tab_(mateV4Book_(),'GAS本番稼働監視V4');
      sheet.getRange(2,11).setValue('CYCLE_FAILED: '+String(err).slice(0,140));
    }catch(heartbeatErr){
      console.log('PRODUCTION_ERROR_HEARTBEAT_FAILED '+String(heartbeatErr).slice(0,120));
    }
    throw err;
  }finally{lock.releaseLock()}
}
/**
 * Separate short send-only runner. Its guardrails are identical to the hourly
 * runner; it never runs prospect discovery or changes publishing settings.
 * Running after opt-outs and permanent-bounce quarantine is mandatory.
 * ScriptLock avoids collisions with the hourly multi-phase cycle.
 */
/** Explain a zero-send cycle without lowering any outreach safety gate. */
function mateV4FastZeroSendReason_(){
  const p=PropertiesService.getScriptProperties();
  const phase=p.getProperty('MATE_OUTREACH_PHASE')||'OFF';
  if(p.getProperty('MATE_AUTO_SEND')!=='ON')return 'AUTO_SEND_OFF';
  const maxCap=phase==='PER_SERVICE_30'?90:
    phase==='DAILY_30'?30:phase==='BALANCED_15'?15:
    phase==='PILOT'?1:5;
  const cap=Math.min(maxCap,Math.max(0,parseInt(
    p.getProperty('MATE_DAILY_CAP')||'5',10)||0));
  const today=mateV4Jst_().slice(0,10);
  const book=mateV4Book_();
  const logs=mateV4Rows_(mateV4Tab_(book,MATE_V4.sent));
  const todayLogs=logs.filter(x=>String(x['送信処理日時']||'').startsWith(today));
  const quota=MailApp.getRemainingDailyQuota();
  const bySvc={CARE:0,SPARK:0,PLAY:0};
  for(const x of todayLogs)if(x['サービス'] in bySvc)bySvc[x['サービス']]++;
  const base='phase='+phase+' cap='+cap+' loggedToday='+todayLogs.length+
    ' bySvc='+JSON.stringify(bySvc)+' GmailRemaining='+quota;
  if(todayLogs.length>=cap)return 'DAILY_CAP_REACHED '+base;
  if(quota<1)return 'GMAIL_QUOTA_EXHAUSTED '+base;
  // Preliminary counts include recipients already present in Gmail Sent, so
  // never call them safe-to-send or bypass history checking.
  const backlog=diagnoseMateV4Backlog();
  const preliminary=['CARE','SPARK','PLAY'].reduce((n,x)=>
    n+(backlog.counts[x]?.validWithoutGmailHistoryCheck||0),0);
  return (preliminary?'REVIEWED_PROSPECTS_NEED_HISTORY_CHECK ':
    'NO_PRELIMINARY_SENDABLE_PROSPECTS ')+base+' prelim='+preliminary;
}
function mateV4FastOutreachCycle(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return 'SKIP_LOCK';
  let monitor=null,monitorRow=0,status='STARTED',sent=0,detail='';
  try{
    // Store one timestamped record per actual trigger execution, separate
    // from the hourly heartbeat. This verifies the 15-minute cadence.
    try{
      const book=mateV4Book_();
      monitor=book.getSheetByName('MATE_15分送信稼働監視V1')||
        book.insertSheet('MATE_15分送信稼働監視V1');
      if(monitor.getLastRow()===0)monitor.appendRow([
        '実行開始(JST)','実行コード版','実行状態','送信件数','詳細']);
      monitorRow=monitor.getLastRow()+1;
      monitor.getRange(monitorRow,1,1,5).setValues([
        [mateV4Jst_(),MATE_V4.version,'STARTED',0,'']]);
    }catch(e){console.log('FAST_TELEMETRY_START_FAILED '+String(e).slice(0,140))}
    const p=PropertiesService.getScriptProperties();
    if(p.getProperty('MATE_AUTO_SEND')!=='ON'||
       p.getProperty('MATE_AUTO_SEND_LEGAL_REVIEWED')!=='YES'){
      status='OFF';return 'OFF';
    }
    // GmailApp has a separate daily service-call quota from MailApp's recipient quota.
    // On exhaustion, skip ALL Gmail reads and sends until the next JST day.
    // Never bypass suppression/reconciliation gates to force a send.
    const gmailCooldownKey='MATE_FAST_GMAIL_QUOTA_BLOCKED_JST';
    const todayJst=mateV4Jst_().slice(0,10);
    if(p.getProperty(gmailCooldownKey)===todayJst){
      status='CYCLE_COMPLETED';
      detail='GMAIL_SERVICE_DAILY_QUOTA_COOLDOWN_NO_SEND';
      return {mode:'FAST_15_MIN',sent:0,reason:detail};
    }
    const optouts=mateV4OptoutInbox();
    const bounces=mateV4HardBounceQuarantine();
    const reconciled=mateV4ReconcileSentReservations();
    const interested=mateV4CaptureListingIntent_();
    const acknowledged=mateV4AcknowledgeListingInterests_();
    // Do not send if a suppression/reconciliation call throws.
    const resultSends=mateV4SendOutreach();
    sent=Number(resultSends)||0;
    if(!sent)try{detail=mateV4FastZeroSendReason_()}
      catch(err){detail='ZERO_SEND_REASON_UNAVAILABLE '+String(err).slice(0,90)}
    status='CYCLE_COMPLETED';
    const result={mode:'FAST_15_MIN',optouts,bounces,reconciled,interested,acknowledged,sent};
    console.log(JSON.stringify(result));
    return result;
  }catch(e){
    const message=String(e);
    if(/Service invoked too many times for one day:\s*gmail/i.test(message)){
      // Quota failures must not cause 15-minute retry storms. Resume next JST day.
      PropertiesService.getScriptProperties().setProperty(
        'MATE_FAST_GMAIL_QUOTA_BLOCKED_JST',mateV4Jst_().slice(0,10));
      status='CYCLE_COMPLETED';
      detail='GMAIL_SERVICE_DAILY_QUOTA_COOLDOWN_NO_SEND';
      return {mode:'FAST_15_MIN',sent:0,reason:detail};
    }
    status='CYCLE_FAILED '+message.slice(0,120);
    throw e;
  }finally{
    if(monitor&&monitorRow)try{
      monitor.getRange(monitorRow,3,1,3).setValues([
        [status,sent,status==='CYCLE_COMPLETED'?(detail||'送信抑止・重複確認済み'):'再送禁止・ログを照合']]);
    }catch(e){console.log('FAST_TELEMETRY_FINISH_FAILED '+String(e).slice(0,140))}
    lock.releaseLock();
  }
}
/** Install once from the existing hourly runner, never duplicate a trigger. */
function mateV4FastTriggerEvidence_(state){
  // Separate trigger installation status from actual 15-minute executions.
  // Only mateV4FastOutreachCycle may append a completed send-run record.
  try{
    const book=mateV4Book_(),tab=book.getSheetByName('MATE_15分送信稼働監視V1');
    if(tab)tab.getRange(2,7,1,2).setValues([[mateV4Jst_(),state]]);
  }catch(e){console.log('FAST_TRIGGER_STATUS_WRITE_FAILED '+String(e).slice(0,120))}
  return state;
}
function mateV4EnsureFastOutreachTrigger_(){
  mateV4Book_();
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty('MATE_AUTO_SEND')!=='ON'||
     p.getProperty('MATE_AUTO_SEND_LEGAL_REVIEWED')!=='YES'||
     p.getProperty('MATE_LEGAL_ADDRESS_PAGE_VERIFIED')!=='YES'||
     p.getProperty('MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED')!=='YES'||
     !mateV4FormalSenderIdentity_(p).ready||
     !mateV4SenderAddressLooksComplete_(p.getProperty('MATE_SENDER_ADDRESS')))
    return mateV4FastTriggerEvidence_('FAST_TRIGGER_GUARDS_NOT_READY');
  const existing=ScriptApp.getProjectTriggers().filter(
    t=>t.getHandlerFunction()==='mateV4FastOutreachCycle');
  if(existing.length)return mateV4FastTriggerEvidence_('FAST_TRIGGER_ALREADY_INSTALLED');
  ScriptApp.newTrigger('mateV4FastOutreachCycle').timeBased()
    .everyMinutes(15).create();
  return mateV4FastTriggerEvidence_('FAST_TRIGGER_INSTALLED_15_MIN');
}
function installMateAutoOpsV4(){
  mateV4Book_();
  for(const tr of ScriptApp.getProjectTriggers())
    if(tr.getHandlerFunction()==='mateAutoOpsV4Cycle')ScriptApp.deleteTrigger(tr);
  ScriptApp.newTrigger('mateAutoOpsV4Cycle').timeBased().everyHours(1).create();
  return 'MATE AutoOps V4: 1時間おきに収集・拒否記録・紹介台帳を確認。メールはScript PropertiesがそろうまでOFF。';
}

/** Owner-only aggregate morning report: no prospect identities or PII. */
function mateV4DailyGrowthDigest(){
  const book=mateV4Book_(),props=PropertiesService.getScriptProperties();
  if(props.getProperty('MATE_GROWTH_DIGEST')==='OFF')return 'OFF';
  const today=mateV4Jst_().slice(0,10),key='MATE_GROWTH_DIGEST_LAST';
  const yesterday=Utilities.formatDate(new Date(Date.now()-86400000),
    'Asia/Tokyo','yyyy-MM-dd');
  if(props.getProperty(key)===today)return 'ALREADY_DONE';
  const leads=mateV4Rows_(mateV4Tab_(book,MATE_V4.leads));
  const nameOnly=mateV4Rows_(mateV4Tab_(book,'営業候補_公式URL未確認'));
  const sent=mateV4Rows_(mateV4Tab_(book,MATE_V4.sent));
  const application=mateV4Rows_(mateV4Tab_(book,'掲載セルフ申請'));
  const count={CARE:0,SPARK:0,PLAY:0},approved={CARE:0,SPARK:0,PLAY:0},pending={CARE:0,SPARK:0,PLAY:0},mailMissing={CARE:0,SPARK:0,PLAY:0};
  let auditedToday=0;
  const newYesterday={CARE:0,SPARK:0,PLAY:0};
  const verifiedYesterday={CARE:0,SPARK:0,PLAY:0};
  for(const r of leads){
    const service=r['サービス'];
    if(!(service in count))continue;
    count[service]++;
    if(String(r['取得日時']||'').startsWith(yesterday))newYesterday[service]++;
    if(String(r['最終確認結果']||'').startsWith('AUTO_AUDIT '+yesterday+' 公式事業者サイトで業務用メール掲載確認'))verifiedYesterday[service]++;
    if(r['状態']==='窓口確認待ち')pending[service]++;
    if(!mateV4RoleEmail_(r['業務用メール']))mailMissing[service]++;
    if(String(r['最終確認結果']||'').startsWith('AUTO_AUDIT '+today))auditedToday++;
  }
  for(const r of application)if(r['サービス'] in approved &&
    r['審査状態']==='承認')approved[r['サービス']]++;
  const backlog=diagnoseMateV4Backlog();
  const attribution=diagnoseMateOutreachApplicationsV4();
  const sources=mateV4Rows_(mateV4Tab_(book,MATE_V4.sources));
  const activeSources=Object.fromEntries(['CARE','SPARK','PLAY'].map(s=>[s,
    sources.filter(x=>x['サービス']===s&&x['有効']==='TRUE'&&x['再利用許諾確認']==='確認済み').length]));
  const rawCounts=Object.fromEntries(['CARE','SPARK','PLAY'].map(s=>[s,
    nameOnly.filter(x=>x['サービス']===s).length]));
  const rawYesterday=Object.fromEntries(['CARE','SPARK','PLAY'].map(s=>[s,
    nameOnly.filter(x=>x['サービス']===s&&String(x['取得日時']||'').startsWith(yesterday)).length]));
  const funnel=s=>backlog.counts[s];
  const observed=svc=>attribution.byService[svc];
  const messages=[
    'MATE営業・掲載の日次サマリー '+today,'',
    '候補件数（公式URLあり）：CARE '+count.CARE+' / SPARK '+count.SPARK+' / PLAY '+count.PLAY,
    'URL未確認の名称候補（営業送信不可）：CARE '+rawCounts.CARE+' / SPARK '+rawCounts.SPARK+' / PLAY '+rawCounts.PLAY,
    '前日追加のURL未確認候補：CARE '+rawYesterday.CARE+' / SPARK '+rawYesterday.SPARK+' / PLAY '+rawYesterday.PLAY,
    '前日（'+yesterday+'）新規候補：CARE '+newYesterday.CARE+' / SPARK '+newYesterday.SPARK+' / PLAY '+newYesterday.PLAY,
    '前日（'+yesterday+'）公式メール確認：CARE '+verifiedYesterday.CARE+' / SPARK '+verifiedYesterday.SPARK+' / PLAY '+verifiedYesterday.PLAY,
    '自動CSV収集元：CARE '+activeSources.CARE+' / SPARK '+activeSources.SPARK+' / PLAY '+activeSources.PLAY,
    '収集元の自動発見：'+(props.getProperty('MATE_SOURCE_CATALOG_DISCOVERY')==='OFF'?'OFF':'ON')+
      ' / 最終カタログ確認：'+(props.getProperty('MATE_SOURCE_CATALOG_DISCOVERY_LAST')||'未実施'),
    '窓口確認待ち：CARE '+pending.CARE+' / SPARK '+pending.SPARK+' / PLAY '+pending.PLAY,
    '公式業務メール未取得・不適合：CARE '+mailMissing.CARE+' / SPARK '+mailMissing.SPARK+' / PLAY '+mailMissing.PLAY,
    '本日公式窓口監査済み：'+auditedToday,
    '未送信候補・審査待ち：CARE '+funnel('CARE').notReadyStatus+' / SPARK '+funnel('SPARK').notReadyStatus+' / PLAY '+funnel('PLAY').notReadyStatus,
    '根拠期限切れ：CARE '+funnel('CARE').expiredEvidence+' / SPARK '+funnel('SPARK').expiredEvidence+' / PLAY '+funnel('PLAY').expiredEvidence,
    '暫定送信適格（Gmail履歴照合前）：CARE '+funnel('CARE').validWithoutGmailHistoryCheck+' / SPARK '+funnel('SPARK').validWithoutGmailHistoryCheck+' / PLAY '+funnel('PLAY').validWithoutGmailHistoryCheck,
    '実在申請（内部テスト・差戻し除外）：CARE '+observed('CARE').realApplications+' / SPARK '+observed('SPARK').realApplications+' / PLAY '+observed('PLAY').realApplications,
    '承認済み申請：CARE '+approved.CARE+' / SPARK '+approved.SPARK+' / PLAY '+approved.PLAY,
    '本日送信試行ログ：'+sent.filter(r=>r['送信処理日時'].startsWith(today)).length,
    '累計送信済み：'+sent.filter(r=>r['状態']==='送信済').length+
      ' / 返信確認：'+sent.filter(r=>r['状態']==='返信あり').length+
      ' / 配信停止：'+sent.filter(r=>r['状態']==='配信停止').length,
    '営業送信後の名称一致申請（因果関係ではない）：CARE '+
      observed('CARE').nameMatchesAfterSend+' / SPARK '+
      observed('SPARK').nameMatchesAfterSend+' / PLAY '+
      observed('PLAY').nameMatchesAfterSend,
    '本日未審査申請：'+application.filter(r=>r['受信日時']&&r['受信日時'].startsWith(today)&&r['審査状態']!=='承認').length,
    '',
    '掲載承認・権限・契約は人が確認。未確認の営業宛先には送信しません。',
    '台帳：https://docs.google.com/spreadsheets/d/'+MATE_V4.bookId+'/edit'
  ];
  // Reserve before sending; ambiguous errors never trigger duplicate reports.
  props.setProperty(key,today);
  MailApp.sendEmail({to:MATE_V4.account,subject:'【MATE運営】日次営業・承認サマリー '+today,
    body:messages.join('\n'),name:'MATE運営事務局'});
  return {day:today,counts:count,approvals:approved};
}
/** One daily digest trigger, separate from hourly reconciliation/outreach. */
function installMateV4DailyDigest(){
  mateV4Book_();
  for(const trigger of ScriptApp.getProjectTriggers())
    if(trigger.getHandlerFunction()==='mateV4DailyGrowthDigest')ScriptApp.deleteTrigger(trigger);
  ScriptApp.newTrigger('mateV4DailyGrowthDigest').timeBased()
    .atHour(9).everyDays(1).inTimezone('Asia/Tokyo').create();
  return 'MATE日次サマリーを午前9時台に運営者本人へ1日1通。外部営業送信スイッチは変更しません。';
}


/**
 * Single read-only operator checkpoint. Prints all relevant safe counters to
 * Apps Script execution log without requiring a temporary wrapper function.
 * It never sends mail, writes Sheets or changes trigger/settings state.
 */
function checkMateAutoOpsV4(){
  const report=JSON.parse(previewMateOutreachReadinessV4());
  const names=ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction());
  const state={
    mode:'READ_ONLY_NO_SEND',
    dailyLeadCycleInstalled:names.includes('mateAutoOpsV4Cycle'),
    ownerGrowthDigestInstalled:names.includes('mateV4DailyGrowthDigest'),
    dailyLeadCycleTriggers:names.filter(n=>n==='mateAutoOpsV4Cycle').length,
    ownerGrowthDigestTriggers:names.filter(n=>n==='mateV4DailyGrowthDigest').length,
    ...report
  };
  console.log(JSON.stringify(state));
  return state;
}
