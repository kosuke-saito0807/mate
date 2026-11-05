/* Business-only registration payload. Never includes applicant name, email, phone or child information. */
window.MATESelfService = {
  populate(form) {
    const target=form.querySelector('input[name="listing_payload_b64"]');
    if(!target)return false;
    const keys=["service","company","website","region","city","area","category","ages","description","pricingNotes","openingHours","tags","monthlyPrice","trialPrice","ageMin","ageMax","weekdays","station","nextTrialDate","listing_content_checked_at","listing_permission","trial_referral_consent"];
    const data={};
    for(const key of keys) {
      const el=form.elements.namedItem(key);
      if(!el)continue;
      data[key]=(el.type==="checkbox" ? (el.checked ? String(el.value||"yes"):"") : String(el.value||"").trim()).slice(0,550);
    }
    if(!data.listing_permission||!data.company||!data.website||!data.description||!data.region||!data.city||!data.category)return false;
    // Stop contradictory ages and dates before sending to the manual approval queue.
    if(data.ageMin && data.ageMax && Number(data.ageMin)>Number(data.ageMax)){
      window.alert("対象年齢の上限は下限以上で指定してください。");return false;
    }
    if(data.nextTrialDate && data.listing_content_checked_at && data.nextTrialDate<data.listing_content_checked_at){
      window.alert("体験予定日は掲載内容の確認日より前に設定できません。");return false;
    }
    // Use JST date for Japan-based MATE operations, including early morning hours.
    const todayJst=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
    if(data.listing_content_checked_at && data.listing_content_checked_at>todayJst){
      window.alert("掲載内容の確認日に未来の日付は指定できません。");return false;
    }
    // Images remain in the separate private image ledger, not the public
    // listing payload. Validate before native form submission for clarity.
    const rawImages=String(form.elements.namedItem("listing_image_urls")?.value||"").trim();
    const submittedImages=rawImages?rawImages.split(/\r?\n/).map(s=>s.trim()).filter(Boolean):[];
    if(submittedImages.length>5||new Set(submittedImages).size!==submittedImages.length){
      window.alert("掲載画像は重複のないURLを最大5件まで入力してください。");return false;
    }
    for(const u of submittedImages){
      try{
        const link=new URL(u);
        if(link.protocol!=="https:"||link.username||link.password||!/\.(jpe?g|png|webp|avif)$/i.test(link.pathname)||u.length>450){
          window.alert("画像URLはHTTPSのJPG・PNG・WebP・AVIF形式にしてください。");return false;
        }
      }catch(e){window.alert("画像URLを確認してください。");return false}
    }
    const consent=form.elements.namedItem("listing_image_rights");
    if(submittedImages.length&&(!consent||!consent.checked)){
      window.alert("写真の掲載権限への同意を確認してください。");return false;
    }
    const bytes=new TextEncoder().encode(JSON.stringify(data));
    if(bytes.length>7000)return false;
    let binary="";
    for(const b of bytes)binary+=String.fromCharCode(b);
    target.value="MATE_LISTING_V1__"+btoa(binary);
    return true;
  }
};