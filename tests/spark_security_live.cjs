/* Read-only real-Chrome security audit for the SPARK custom domain.
 * No form submissions, test payloads, authentication, or content mutation. */
const fs=require('node:fs');
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
     const response=await page.goto(url,{waitUntil:'networkidle',timeout:45000});
     status=response?.status()||null;
     await page.waitForTimeout(700);
     secureContext=await page.evaluate(()=>window.isSecureContext);
     finalUrl=page.url();
   }catch(e){error=String(e).slice(0,700)}
   results.push({url,status,finalUrl,secureContext,cert,insecure,mixed,certErrors,security,error});
   await page.close();
  }
 }finally{await browser.close()}
 fs.mkdirSync('artifacts/security',{recursive:true});
 fs.writeFileSync('artifacts/security/spark-audit.json',JSON.stringify(results,null,2));
 for(const r of results){console.log(JSON.stringify(r))}
 if(results.some(r=>r.error||r.status!==200||!r.secureContext||r.insecure.length||r.mixed.length||r.certErrors.length||!r.cert?.protocol))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
