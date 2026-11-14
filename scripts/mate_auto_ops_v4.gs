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
 *   (optional) MATE_DAILY_CAP = 30 in DAILY_30 (10 per service/day)
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
  maxCSVBytes:600000,maxNewLeadsPerRun:200,version:'2026-11-15-bodik-catalogue-discovery'
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
  if(host.length>253||!host.includes('.')||!host.split('.').every(
    part=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)))return '';
  return host;
}
function mateV4Https_(s){return !!mateV4Host_(s)}
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
    name:['事業者名','法人名','企業名','教室名','施設名','施設名称','名称','事業所名','観光施設名','施設・スポット名'],
    website:['公式url','ホームページ','ホームページurl','ウェブサイト','ウェブサイトurl','webサイト','webサイトurl','url','公式サイト','公式サイトurl','関連url','リンク先url','施設url','施設ホームページ','サイトurl'],
    region:['都道府県','住所','所在地','地域','エリア','所在地_連結表記','所在地(住所)'],
    email:['メール','メールアドレス','公開メール','e-mail','email'],
    contact_url:['問い合わせurl','問合せurl','お問い合わせurl'],
  };
  const at=k=>{for(const alias of columns[k]){const i=keys.indexOf(alias);if(i>=0)return i}return -1};
  const indexes={};for(const key of Object.keys(columns))indexes[key]=at(key);
  if(indexes.name<0||indexes.website<0){
    const missing=[indexes.name<0?'名称':'公式URL'].filter(Boolean).join('・');
    throw Error('CSV列不足 ('+missing+') / 見出し: '+keys.slice(0,12).join(',').slice(0,125));
  }
  return rows.map(row=>{
    const get=k=>indexes[k]<0?'':String(row[indexes[k]]||'').trim();
    return {name:get('name'),website:get('website'),region:get('region'),
      email:get('email'),contact_url:get('contact_url'),service:'',
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
      mateV4Email_(x['メール（未再確認）']),url,url,'UNVERIFIED',x['確認日']||'',
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
  if(seen.size>=80)return {mode:'SOURCE_LIMIT',sourceCount:seen.size};
  const searches=[
    {service:'CARE',query:'居宅訪問型保育',fit:/居宅訪問|ベビーシッター|訪問保育|認可外保育|保育事業所/},
    {service:'SPARK',query:'スポーツ教室',fit:/スポーツ教室|文化教室|音楽教室|学習塾|習い事|スポーツクラブ/},
    {service:'PLAY',query:'観光施設一覧',fit:/観光施設|体験施設|体験活動|博物館|ミュージアム/}
  ];
  let found=0,queried=0,failures=0,checked=0;
  for(const item of searches){
    if(found>=6||seen.size>=80)break;
    try{
      const url='https://data.bodik.jp/api/3/action/package_search?q='+
        encodeURIComponent(item.query)+'&rows=30&sort=metadata_modified+desc';
      const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false,timeout:14000,
        headers:{Accept:'application/json'}});
      if(response.getResponseCode()!==200)throw Error('catalog HTTP status');
      const json=JSON.parse(response.getContentText('UTF-8'));
      if(json.success!==true||!Array.isArray(json.result&&json.result.results))
        throw Error('unexpected catalog schema');
      queried++;
      for(const dataset of json.result.results){
        checked++;
        if(found>=6||seen.size>=80)break;
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
  // Do not create a rapid-retry storm if the catalogue temporarily fails.
  if(queried>0)p.setProperty(dateKey,today);
  return {queried,metadataChecked:checked,registered:found,failures,
    autoEmailApproval:false,onlyPublicLicensedCSV:true};
}

function mateV4CollectLeads(){
  const b=mateV4Book_(),src=mateV4Tab_(b,MATE_V4.sources),dest=mateV4Tab_(b,MATE_V4.leads);
  const sources=mateV4Rows_(src),existing=mateV4Rows_(dest);
  const seen=new Set(existing.map(x=>x['重複キー']).filter(Boolean));
  const known=new Set(mateV4Rows_(mateV4Tab_(b,'3サービス営業リスト'))
    .filter(x=>mateV4Https_(x['公式・窓口URL']))
    .map(x=>{try{return mateV4Key_(x['サービス'],x['公式・窓口URL'],x['企業・教室名'])}catch(e){return ''}}));
  let count=0,processedSources=0;
  for(const source of sources){
    if(processedSources>=8)break;
    if(source['有効']!=='TRUE'||source['再利用許諾確認']!=='確認済み'||!mateV4Https_(source['取得元CSV HTTPS URL']))continue;
    const service=source['サービス'];if(!['CARE','SPARK','PLAY'].includes(service))continue;
    // Public municipal datasets rarely update hourly; check each once per JST day.
    // Keep this after validation so a newly added source is processed immediately.
    if(String(source['最終取込日時']||'').slice(0,10)===mateV4Jst_().slice(0,10))continue;
    processedSources++;
    let rows;
    try{rows=mateV4SourceCsv_(source['取得元CSV HTTPS URL'])}
    catch(e){src.getRange(source._row,7).setValue('取得失敗: '+String(e).slice(0,180));continue}
    let imported=0,missingWebsite=0,skippedDuplicate=0,invalidRows=0;
    for(const x of rows){
      if(count>=MATE_V4.maxNewLeadsPerRun)break;
      if(!x.name||!mateV4Https_(x.website)){missingWebsite++;continue}
      if((x.service&&x.service!==service)||!mateV4Https_(x.source_url)){invalidRows++;continue}
      const id=mateV4Key_(service,x.website,x.name);
      if(seen.has(id)||known.has(id)){skippedDuplicate++;continue}
      const deny=/^(true|yes|1|禁止)$/i.test(x.solicitation_prohibited);
      const mail=mateV4Email_(x.email);
      const checked=mateV4Fresh_(x.checked_at,14);
      const basis=['OPT_IN','SOLICITATIONS_WELCOME'].includes(x.mail_basis)?x.mail_basis:'UNVERIFIED';
      // Even a properly licensed CSV can contain stale or self-asserted opt-in.
      // Require an operator to check the current official contact page, evidence,
      // objection notices, and date before manually marking any lead send-ready.
      const state=deny?'配信禁止':'窓口確認待ち';
      mateV4Append_(dest,[
        'AUTO-'+id,mateV4Jst_(),service,x.name,x.website,x.region||'',
        mail,x.contact_url||'',x.source_url,basis,x.checked_at||'',id,
        deny?'TRUE':'FALSE',state,'CSVの根拠表示だけでは送信不可。公式窓口・拒否表示・根拠確認日を人が確認。掲載・取次の許諾も未取得。',''
      ]);
      seen.add(id);count++;imported++;
    }
    const summary=String(imported)+' 件取込 / CSV '+rows.length+' 行 / URL・名称不足 '+missingWebsite+
      ' / 重複 '+skippedDuplicate+' / その他不備 '+invalidRows;
    src.getRange(source._row,6,1,2).setValues([[mateV4Jst_(),summary.slice(0,250)]]);
  }
  return count;
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
    if(!/(?:contact|inquir|toiawase|otoiawase|お問い?合わ?せ|%e3%81%8a%e5%95%8f%e3%81%84)/i.test(href))continue;
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
  return /^(?:info|contact|office|inquiry|toiawase|business|partner|partners|partnerships|hello|support|general|sales|customer|mail)(?:[._+-][a-z0-9]+)?$/i.test(local)?email:'';
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
    if(x['状態']==='窓口確認待ち'&&mateV4RoleEmail_(email))return 3;
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
    String(a['最終確認結果']||'').localeCompare(String(b['最終確認結果']||''))));
  const leads=[];
  while(eligibleServices.some(s=>buckets[s].length)){
    for(const service of eligibleServices)
      if(buckets[service].length)leads.push(buckets[service].shift());
  }
  const stopped=new Set(mateV4Rows_(mateV4Tab_(b,MATE_V4.optouts))
    .map(x=>x['メール'].toLowerCase()).filter(Boolean));
  let checked=0,eligible=0,discovered=0;
  // Audit more companies without overwhelming Apps Script's execution limit.
  // Can tune between 8 and 24 without another code deployment.
  const requested=Number(p.getProperty('MATE_PUBLIC_AUDIT_BATCH')||24);
  const batchSize=Number.isFinite(requested)?
    Math.min(24,Math.max(8,Math.floor(requested))):24;
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
    dailyPerServiceCap:p.getProperty('MATE_OUTREACH_PHASE')==='BALANCED_15'?5:p.getProperty('MATE_OUTREACH_PHASE')==='DAILY_30'?10:p.getProperty('MATE_OUTREACH_PHASE')==='PER_SERVICE_30'?30:null,
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
  return {mode:'DAILY_30_PREPARED_NO_SEND',dailyCap:30,perServiceCap:10,
    sendEnabled:false,sourceVersion:MATE_V4.version};
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
  // DAILY_30 limits the entire account to 30/day, max 10 per service. No owner BCC.
  // Each message consumes one recipient-quota unit. Live Gmail quota controls
  // the actual maximum, shared with other sends by this account.
  const maxCap=phase==='PILOT'?1:phase==='BALANCED_15'?15:phase==='DAILY_30'?30:phase==='PER_SERVICE_30'?90:5;
  const cap=Math.min(maxCap,Math.max(0,parseInt(p.getProperty('MATE_DAILY_CAP')||'5',10)||0));
  const perServiceCap=phase==='BALANCED_15'?5:phase==='DAILY_30'?10:phase==='PER_SERVICE_30'?30:cap;
  const maxPerExecution=phase==='DAILY_30'?5:phase==='PER_SERVICE_30'?6:cap;
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
      '掲載をご希望いただける場合は、以下のフォームより事業者情報をご登録いただけますと幸いです。',
      link,
      '',
      'お申し込み後、掲載内容およびご担当者様の権限を確認したうえで、掲載の可否・開始について改めてご案内いたします。',
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

function mateAutoOpsV4Cycle(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return 'SKIP_LOCK';
  try{
    const report={crmSeeded:mateV4SeedExistingCRM(),sectorSeeded:mateV4SeedSectorDirectories(),
      catalogDiscovery:mateV4DiscoverLicensedPublicCsvSources(),
      collected:mateV4CollectLeads(),optouts:mateV4OptoutInbox(),hardBounces:mateV4HardBounceQuarantine(),
      reconciledSent:mateV4ReconcileSentReservations(),
      publicAudit:mateV4AuditOfficialContacts(),reviewDrafts:mateV4PrepareReviewDrafts(),
      referrals:mateV4SyncReferralLedger(),outreach:mateV4SendOutreach(),
      replies:mateV4TrackReplies()};
    console.log(JSON.stringify(report));return report;
  }finally{lock.releaseLock()}
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
  if(props.getProperty(key)===today)return 'ALREADY_DONE';
  const leads=mateV4Rows_(mateV4Tab_(book,MATE_V4.leads));
  const sent=mateV4Rows_(mateV4Tab_(book,MATE_V4.sent));
  const application=mateV4Rows_(mateV4Tab_(book,'掲載セルフ申請'));
  const count={CARE:0,SPARK:0,PLAY:0},approved={CARE:0,SPARK:0,PLAY:0},pending={CARE:0,SPARK:0,PLAY:0},mailMissing={CARE:0,SPARK:0,PLAY:0};
  let auditedToday=0;
  for(const r of leads){
    const service=r['サービス'];
    if(!(service in count))continue;
    count[service]++;
    if(r['状態']==='窓口確認待ち')pending[service]++;
    if(!mateV4RoleEmail_(r['業務用メール']))mailMissing[service]++;
    if(String(r['最終確認結果']||'').startsWith('AUTO_AUDIT '+today))auditedToday++;
  }
  for(const r of application)if(r['サービス'] in approved &&
    r['審査状態']==='承認')approved[r['サービス']]++;
  const backlog=diagnoseMateV4Backlog();
  const attribution=diagnoseMateOutreachApplicationsV4();
  const funnel=s=>backlog.counts[s];
  const observed=svc=>attribution.byService[svc];
  const messages=[
    'MATE営業・掲載の日次サマリー '+today,'',
    '候補件数：CARE '+count.CARE+' / SPARK '+count.SPARK+' / PLAY '+count.PLAY,
    '窓口確認待ち：CARE '+pending.CARE+' / SPARK '+pending.SPARK+' / PLAY '+pending.PLAY,
    '公式業務メール未取得・不適合：CARE '+mailMissing.CARE+' / SPARK '+mailMissing.SPARK+' / PLAY '+mailMissing.PLAY,
    '本日公式窓口監査済み：'+auditedToday,
    '未送信候補・審査待ち：CARE '+funnel('CARE').notReadyStatus+' / SPARK '+funnel('SPARK').notReadyStatus+' / PLAY '+funnel('PLAY').notReadyStatus,
    '根拠期限切れ：CARE '+funnel('CARE').expiredEvidence+' / SPARK '+funnel('SPARK').expiredEvidence+' / PLAY '+funnel('PLAY').expiredEvidence,
    '暫定送信適格（Gmail履歴照合前）：CARE '+funnel('CARE').validWithoutGmailHistoryCheck+' / SPARK '+funnel('SPARK').validWithoutGmailHistoryCheck+' / PLAY '+funnel('PLAY').validWithoutGmailHistoryCheck,
    '実在申請（内部テスト・差戻し除外）：CARE '+observed('CARE').realApplications+' / SPARK '+observed('SPARK').realApplications+' / PLAY '+observed('PLAY').realApplications,
    '承認済み申請：CARE '+approved.CARE+' / SPARK '+approved.SPARK+' / PLAY '+approved.PLAY,
    '本日送信試行ログ：'+sent.filter(r=>r['送信処理日時'].startsWith(today)).length,
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
