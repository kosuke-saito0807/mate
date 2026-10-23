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
    if(data.listing_content_checked_at && data.listing_content_checked_at>new Date().toISOString().slice(0,10)){
      window.alert("掲載内容の確認日に未来の日付は指定できません。");return false;
    }
    const bytes=new TextEncoder().encode(JSON.stringify(data));
    if(bytes.length>7000)return false;
    let binary="";
    for(const b of bytes)binary+=String.fromCharCode(b);
    target.value="MATE_LISTING_V1__"+btoa(binary);
    return true;
  }
};