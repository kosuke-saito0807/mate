/* Business-only registration payload. Never includes applicant name, email, phone or child information. */
window.MATESelfService = {
  populate(form) {
    const target=form.querySelector('input[name="listing_payload_b64"]');
    if(!target)return false;
    // School-grade choices are the source of truth for SPARK. Retain the
    // existing age/category fields for backward-compatible Sheets and search.
    if(form.elements.namedItem("service")?.value==="SPARK"){
      const from=form.elements.namedItem("gradeFrom")?.value||"";
      const to=form.elements.namedItem("gradeTo")?.value||"";
      const grades=["pre","k3","k4","k5",
        "e1","e2","e3","e4","e5","e6",
        "j1","j2","j3","h1","h2","h3"];
      const lower=[0,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
      const upper=[2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18];
      const first=grades.indexOf(from),last=grades.indexOf(to);
      if(first<0||last<0||first>last){
        window.alert("開始学年と終了学年を正しく選択してください。");
        return false;
      }
      const category=[];
      if(first<=3)category.push("幼児");
      if(first<=9&&last>=4)category.push("小学生");
      if(first<=12&&last>=10)category.push("中学生");
      if(last>=13)category.push("高校生");
      form.elements.namedItem("ages").value=category.join(",");
      form.elements.namedItem("ageMin").value=String(lower[first]);
      form.elements.namedItem("ageMax").value=String(upper[last]);
    }
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
    const bytes=new TextEncoder().encode(JSON.stringify(data));
    if(bytes.length>7000)return false;
    let binary="";
    for(const b of bytes)binary+=String.fromCharCode(b);
    target.value="MATE_LISTING_V1__"+btoa(binary);
    return true;
  }
};