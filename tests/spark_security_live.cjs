/* Read-only real-Chrome security audit for the SPARK custom domain.
 * No form submissions, test payloads, authentication, or content mutation. */
const fs=require('node:fs');
const tls=require('node:tls');
const http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[];
 try {
  for(const url of ['https://spark.kosodatemate.jp/','https://spark.kosodatemate.jp/partners.html']){
   const page=await browser.newPage({ignoreHTTPSErrors:false,viewport:{width:1280,height:800}});
   const insecure=[],mixed=[],certErrors=[],security=[];
   page.on('request',req=>{if(req.url().startsWith('http://'))insecure.push(req.url())});
   page.on('console',msg=>{if(/mixed content|certificate|ERR_CERT_|not secure/i.test(msg.text()))mixed.push(msg.text().slice(0,600))});
   page.on('requestfailed',req=>{const failure=req.failure()?.errorText||'';if(/SSL|CERT_|insecure/i.test(failure))certErrors.push({url:req.url(),failure})});
   const session=await page.context().newCDPSession(page);
   await session.send('Security.enable');
   await session.send('Network.enable');
   session.on('Security.securityStateChanged',event=>{security.push({state:event.securityState,explanations:(event.explanations||[]).map(e=>e.summary||e.description).filter(Boolean).slice(0,8)})});
   let cert=null;
   session.on('Network.responseReceived',event=>{
     if(event.type==='Document'&&event.response?.url===url){
       const det=event.response.securityDetails||{};
       cert={protocol:det.protocol||null,issuer:det.issuer||null,subjectName:det.subjectName||null,validFrom:det.validFrom,validTo:det.validTo};
     }
   });
   let status=null,secureContext=false,finalUrl=null,error=null;
   try{
     const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:22000});
     status=response?.status()||null;
     await page.waitForTimeout(700);
     secureContext=await page.evaluate(()=>window.isSecureContext);
     finalUrl=page.url();
   }catch(e){error=String(e).slice(0,700)}
   results.push({url,status,finalUrl,secureContext,cert,insecure,mixed,certErrors,security,error});
   await page.close();
  }
 }finally{await browser.close()}
 /* Verify SNI certificate SAN and plain-HTTP redirect separately. */
const transport={};
transport.cert=await new Promise(resolve=>{
 const socket=tls.connect({host:'spark.kosodatemate.jp',port:443,servername:'spark.kosodatemate.jp',rejectUnauthorized:true,timeout:12000},()=>{
  const c=socket.getPeerCertificate();
  const v={authorized:socket.authorized,protocol:socket.getProtocol(),subject:c.subject,subjectaltname:c.subjectaltname,valid_to:c.valid_to};
  socket.end();resolve(v);
 });
 socket.once('error',e=>resolve({error:String(e)}));
 socket.once('timeout',()=>{socket.destroy();resolve({error:'TLS socket timeout'})});
});
transport.http=await new Promise(resolve=>{
 const q=http.get('http://spark.kosodatemate.jp/',{timeout:12000},res=>{
  const result={status:res.statusCode,location:res.headers.location||null};
  res.resume();resolve(result);
 });
 q.on('error',e=>resolve({error:String(e)}));
 q.on('timeout',()=>{q.destroy();resolve({error:'HTTP socket timeout'})});
});
console.log('TRANSPORT',JSON.stringify(transport));
fs.mkdirSync('artifacts/security',{recursive:true});
 fs.writeFileSync('artifacts/security/spark-audit.json',JSON.stringify({results,transport},null,2));
 for(const r of results){console.log(JSON.stringify(r))}
 if(results.some(r=>r.error||r.status!==200||!r.secureContext||r.insecure.length||r.mixed.length||r.certErrors.length||!r.cert?.protocol))process.exitCode=1;
 if(!transport.cert.authorized||!String(transport.cert.subjectaltname||'').includes('spark.kosodatemate.jp'))process.exitCode=1;
 if(transport.http.status&&(![301,302,307,308].includes(transport.http.status)||!String(transport.http.location||'').startsWith('https://spark.kosodatemate.jp/')))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
