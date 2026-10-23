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
    const bytes=new TextEncoder().encode(JSON.stringify(data));
    if(bytes.length>7000)return false;
    let binary="";
    for(const b of bytes)binary+=String.fromCharCode(b);
    target.value="MATE_LISTING_V1__"+btoa(binary);
    return true;
  }
};