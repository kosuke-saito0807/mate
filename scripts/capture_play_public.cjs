/* Public, non-authenticated MATE PLAY snapshot. No form submission and no site mutation. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const START='https://mate-play.kosuke-saito0807.chatgpt.site/';
const HOST=new URL(START).hostname;
const ROOT=path.resolve('artifacts/play-public-export');
const SITE=path.join(ROOT,'site');
const ASSET=path.join(ROOT,'external-assets');
const MAX_PAGES=65,MAX_ASSETS=420,MAX_BYTES=115*1024*1024;
fs.mkdirSync(SITE,{recursive:true});
fs.mkdirSync(ASSET,{recursive:true});
const pages=[],files=[],issues=[],netUrls=new Set(),toVisit=[START],seenPages=new Set(),visitedAssets=new Set();
let bytes=0;
const IGNORE=/google-analytics\.com|googletagmanager\.com|doubleclick\.net|formsubmit\.co|facebook\.com\/tr|google\.com\/recaptcha|fonts\.(googleapis|gstatic)\.com/i;
const fontExt=/\.(woff2?|ttf|otf|eot)(\?|$)/i;
function cleanURL(raw){
 try{const u=new URL(raw,START);if(!/^https?:$/.test(u.protocol))return null;
  if(u.username||u.password)return null;
  if(/(access_token|id_token|authorization|session|secret|private_key|password|api_key|key|token)=/i.test(u.search))return null;
  u.hash='';return u.href;
 }catch{return null}
}
function writeSafe(folder,key,data){
 if(bytes+data.length>MAX_BYTES){issues.push({kind:'size-cap',url:key,size:data.length});return null}
 const u=new URL(key);
 let p=decodeURIComponent(u.pathname.replace(/^\/+/,''))||'index.html';
 p=p.replace(/\\/g,'/').split('/').filter(x=>x&&x!=='.'&&x!=='..').map(x=>x.replace(/[<>:"|?*]/g,'_')).join('/');
 if(!path.extname(p))p+='/index.html';
 if(folder===ASSET)p=u.hostname+'/'+p;
 if(u.search)p=p.replace(/(\.[^.\/]+)$/,'--'+crypto.createHash('sha1').update(u.search).digest('hex').slice(0,10)+'$1');
 const target=path.join(folder,p);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,data);bytes+=data.length;
 return path.relative(ROOT,target).replace(/\\/g,'/');
}
function shouldKeep(url,type){
 if(IGNORE.test(url)||fontExt.test(url))return false;
 if(type&&/^(font|media|websocket|eventsource)$/.test(type))return false;
 try{const u=new URL(url);if(!/^https?:$/.test(u.protocol))return false;
  if(u.searchParams.has('token')||u.searchParams.has('secret'))return false;
  const ext=path.extname(u.pathname).toLowerCase();
  if(ext==='.map')return true;
  return ['.css','.js','.mjs','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.avif','.txt','.xml','.webmanifest','.woff-no'].includes(ext)
    || (u.hostname===HOST && /\/(api|assets|static|images|_next|data)\//.test(u.pathname));
 }catch{return false}
}
async function assetFetch(context,url,fromBrowser=false){
 const clean=cleanURL(url);
 if(!clean||visitedAssets.has(clean)||visitedAssets.size>=MAX_ASSETS||!shouldKeep(clean))return;
 visitedAssets.add(clean);
 try{
  const r=await context.request.get(clean,{timeout:16000,failOnStatusCode:false});
  const contentType=(r.headers()['content-type']||'').split(';')[0];
  if(r.status()!==200){issues.push({kind:'resource-status',status:r.status(),url:clean});return}
  if(/text\/html/.test(contentType) && !/\.(html|htm)$/i.test(new URL(clean).pathname))return;
  const body=await r.body();
  if(body.length>18*1024*1024){issues.push({kind:'large-resource',url:clean,size:body.length});return}
  let data=body;
  // No secrets, fonts or private info are intentionally downloaded.
  if(/(json|javascript|text|xml|css)/.test(contentType) || /\.(json|js|css|mjs|txt|xml|map)$/i.test(new URL(clean).pathname)){
    const text=body.toString('utf8');
    if(/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(text)){issues.push({kind:'excluded-sensitive',url:clean});return}
  }
  const out=writeSafe(clean.startsWith(START)?SITE:ASSET,clean,data);
  if(out)files.push({url:clean,local:out,bytes:data.length,contentType,source:fromBrowser?'browser':'discovery',sha256:crypto.createHash('sha256').update(data).digest('hex')});
 }catch(e){issues.push({kind:'resource-error',url:clean,error:String(e.message).slice(0,150)})}
}
function localPagePath(url){
 const u=new URL(url);let p=decodeURIComponent(u.pathname.replace(/^\/+/,''));if(!p)p='index.html';
 if(!path.extname(p))p=p.replace(/\/?$/,'/index.html');
 return p.split('/').map(x=>x.replace(/[<>:"|?*]/g,'_')).join('/');
}
async function getPage(context,browser,url){
 const page=await browser.newPage({viewport:{width:1366,height:920},locale:'ja-JP'});
 const assetSeen=new Set();
 page.on('request',req=>{if(req.method()==='GET'){const u=cleanURL(req.url());if(u){netUrls.add(u);if(shouldKeep(u,req.resourceType()))assetSeen.add(u)}}});
 page.on('pageerror',e=>issues.push({kind:'runtime-error',page:url,message:e.message.slice(0,160)}));
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForTimeout(1500);
  // Trigger lazy images without clicking or inputting anything.
  await page.evaluate(async()=>{for(let y=0;y<Math.min(document.body.scrollHeight,18000);y+=880){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80));}window.scrollTo(0,0)});
  await page.waitForTimeout(500);
  const rendered=await page.content();
  const data=await page.evaluate(()=>{
    const H=location.origin;
    const anchors=[...document.querySelectorAll('a[href]')].map(x=>x.href);
    const source=[...document.querySelectorAll('[src],[href],[poster]')].flatMap(x=>[x.src,x.href,x.poster]).filter(Boolean);
    const backgrounds=[...document.querySelectorAll('*')].slice(0,1400).map(x=>getComputedStyle(x).backgroundImage).filter(x=>x&&x!=='none');
    return {title:document.title,anchors,resources:source,backgrounds,forms:[...document.forms].map(x=>({action:x.action,method:x.method,fields:[...x.elements].map(y=>({name:y.name,type:y.type,required:y.required}))})),textSample:(document.body?.innerText||'').slice(0,2400),inlineScriptCount:document.querySelectorAll('script:not([src])').length};
  });
  const raw=await context.request.get(url,{timeout:18000,failOnStatusCode:false});
  const rawBytes=raw.ok()?await raw.body():Buffer.from(rendered,'utf8');
  const p=localPagePath(url);
  const target=path.join(SITE,p);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,rawBytes);
  const renderedFile=path.join(ROOT,'rendered',p);fs.mkdirSync(path.dirname(renderedFile),{recursive:true});fs.writeFileSync(renderedFile,rendered);
  pages.push({url,title:data.title,status:response?.status()||0,rawPath:path.relative(ROOT,target),renderedPath:path.relative(ROOT,renderedFile),bytes:rawBytes.length,forms:data.forms,textSample:data.textSample,inlineScriptCount:data.inlineScriptCount});
  bytes+=rawBytes.length+Buffer.byteLength(rendered);
  for(const a of data.anchors){
   const target=cleanURL(a);if(!target)continue;
   if(new URL(target).hostname!==HOST)continue;
   if(/\.(html?|php)$/.test(new URL(target).pathname)||!path.extname(new URL(target).pathname)){
    if(!seenPages.has(target)&&!toVisit.includes(target)&&toVisit.length<MAX_PAGES*3)toVisit.push(target);
   }
  }
  for(const r of data.resources){const target=cleanURL(r);if(target&&shouldKeep(target))assetSeen.add(target)}
  for(const css of data.backgrounds){for(const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)){const t=cleanURL(m[1]);if(t&&shouldKeep(t))assetSeen.add(t)}}
  for(const item of assetSeen)netUrls.add(item);
 }catch(e){issues.push({kind:'page-error',url,error:String(e.message).slice(0,180)})}
 finally{await page.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({ignoreHTTPSErrors:false,locale:'ja-JP'});
 try{
  while(toVisit.length&&seenPages.size<MAX_PAGES){
   const u=toVisit.shift();if(seenPages.has(u))continue;
   seenPages.add(u);
   await getPage(context,browser,u);
  }
  const u=[...netUrls].filter(shouldKeep);
  for(let i=0;i<u.length;i+=8){await Promise.all(u.slice(i,i+8).map(x=>assetFetch(context,x,true)))}
 }finally{await context.close();await browser.close()}
 const match=(s,regex)=>regex.test(s);
 const integrations={
  discoveredEndpoints:[...netUrls].filter(x=>/api|firebase|firestore|googleapis|formsubmit|sheet|analytics|cloudfunctions|storage/i.test(x)).map(x=>{const u=new URL(x);return u.origin+u.pathname}).filter((x,i,a)=>a.indexOf(x)===i).slice(0,120),
  foundInSavedFiles:[],
  notes:['Captured only anonymous GET resources and publicly rendered pages.','No admin source, unpublished records, secure server code, private API keys or database contents are accessible from a public mirror.','No forms were submitted. No POST/PUT/PATCH/DELETE was performed.','Font binaries excluded. External runtime services may remain necessary for search/booking/lead flow.']
 };
 const textual=files.filter(x=>/(json|js|css|html)/.test(x.contentType)||/\.(js|json|css)$/.test(x.url));
 for(const f of textual){try{const s=fs.readFileSync(path.join(ROOT,f.local),'utf8');for(const [name,re]of [['FormSubmit',/formsubmit\.co/i],['Firebase',/firebase(?:app|io|storage|config|auth|firestore)?/i],['Google Sheets',/spreadsheets\.google\.com|docs\.google\.com\/spreadsheets/i],['GA4',/googletagmanager\.com|gtag\(|G-[A-Z0-9]{6,}/i],['Google Maps',/maps\.googleapis\.com/i],['external API',/fetch\(\s*['"]https?:\/\//i]])if(re.test(s))integrations.foundInSavedFiles.push({file:f.local,kind:name})}catch{}}
 const manifest={capturedAt:new Date().toISOString(),startUrl:START,scope:'public unauthenticated browser/render and static GET mirror',pageCount:pages.length,assetCount:files.length,bytes,limits:{MAX_PAGES,MAX_ASSETS,MAX_BYTES},pages,assets:files,issues,integrations};
 fs.writeFileSync(path.join(ROOT,'capture-manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(ROOT,'integrations-discovered.json'),JSON.stringify(integrations,null,2));
 fs.writeFileSync(path.join(ROOT,'README.md'),
  '# MATE PLAY public-site source snapshot\n\nCaptured from '+START+' (read-only, no login or form submissions) on '+manifest.capturedAt+'.\n\n'+
  '## Files\n- site/: original public HTML and same-origin static resource GET captures.\n- external-assets/: permitted external CSS, JavaScript, images and public JSON retrieved anonymously.\n- rendered/: DOM after browser JavaScript execution (reference only; not necessarily deployable).\n- capture-manifest.json: source URL to archived-path mappings, sizes, hashes and errors.\n- integrations-discovered.json: surface-level integrations found, excluding secrets.\n\n'+
  '## Critical limitations\nPublic HTML/JS is NOT full editable source. Unpublished data, original authoring project, server logic, protected credentials, database records and private integrations are NOT retrievable from a public URL. Rendering is not proof that replicated backend functionality will work under Firebase Hosting. Only public static responses are mirrored and no secrets are included. Fonts excluded.\n'+
  '\n## Migration\nVerify app framework and route fallbacks, proxy all necessary public APIs legally, provide Firebase Hosting rewrites if SPA, configure dynamic database and secret values yourself, validate forms and search, preserve legal disclosures and original site until manual cutover.\n'
 );
 console.log('MATE_PLAY_CAPTURE_SUMMARY '+JSON.stringify({pageCount:pages.length,assetCount:files.length,bytes,issueCount:issues.length,integrations:integrations.foundInSavedFiles.slice(0,12),pages:pages.map(x=>({url:x.url,status:x.status,title:x.title}))}));
})().catch(e=>{console.error(e);process.exitCode=1});
