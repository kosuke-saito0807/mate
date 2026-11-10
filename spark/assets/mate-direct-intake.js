/* MATE listing intake: POST by normal browser navigation to Google Apps Script.
 * We do NOT use fetch/CORS; a confirmation is displayed ONLY by the GAS server
 * after the private spreadsheet write succeeds. Do not claim receipt on submit.
 */
(function () {
  "use strict";
  function whenReady(fn){
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fn,{once:true});
    else fn();
  }
  whenReady(function(){
    var forms=document.querySelectorAll("form[data-mate-direct-listing]");
    if(!forms.length)return;
    var cfg=window.MATE_DIRECT_INTAKE||{};
    var validEndpoint=typeof cfg.endpoint==="string" && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(cfg.endpoint);
    var validSiteKey=typeof cfg.siteKey==="string" && /^[A-Za-z0-9_-]{12,160}$/.test(cfg.siteKey);
    var ready=cfg.enabled===true&&validEndpoint&&validSiteKey;
    forms.forEach(function(form){
      var media=form.querySelector('.mate-image-fields');
      if(media){
        media.hidden=cfg.photosEnabled!==true;
        media.querySelectorAll('input,textarea').forEach(function(field){field.disabled=cfg.photosEnabled!==true});
      }
      var button=form.querySelector('button[type="submit"]');
      var status=form.querySelector('[role="status"]')||document.createElement("p");
      if(!status.parentNode){status.setAttribute("role","status");form.appendChild(status)}
      status.setAttribute("aria-live","polite");
      status.hidden=false;
      var sendLabel=button?button.textContent:"";
      var service=(form.querySelector('[name="service"]')||{}).value;

      // One shared operator-safe explanation across CARE / SPARK / PLAY.
      // The applicant's original field values and consent checkbox semantics
      // remain untouched; styling/copy only.
      var notes=document.createElement("section");
      notes.className="mate-common-application-notes";
      notes.setAttribute("aria-label","無料掲載申請の注意事項");
      var heading=document.createElement("h3");
      heading.textContent="お申し込み前にご確認ください";
      notes.appendChild(heading);
      var list=document.createElement("ul");
      [
        "基本情報の掲載は0円。月額料金・紹介料はかかりません。有料サービスへの自動切替もありません。",
        "送信後、入力したメールアドレスへ受付番号をお送りします。事務局が申込権限と掲載情報を確認し、承認・見送りをメールでお知らせします。",
        "承認された場合も、本番サイトの掲載を確認してから公開URLをお送りします。申請時点では契約・掲載・請求は発生しません。",
        "写真は任意で最大5枚。必要な肖像権・著作権を確認し、保護者やお子さまの個人情報は記載しないでください。"
      ].forEach(function(copy){
        var item=document.createElement("li");item.textContent=copy;list.appendChild(item);
      });
      notes.appendChild(list);
      var beforeSubmit=form.querySelector('button[type="submit"]');
      if(beforeSubmit&&beforeSubmit.parentNode)beforeSubmit.parentNode.insertBefore(notes,beforeSubmit);
      form.querySelectorAll('input[name="listing_terms_agree"],input[name="listing_permission"],input[name="trial_referral_consent"]').forEach(function(input){
        var parent=input.closest("label");if(!parent)return;
        var content=parent.querySelector("span");
        if(!content)return;
        var name=input.name;
        var terms=content.querySelector("a[href]");
        if(name==="listing_terms_agree"&&terms){
          // Retain the service-specific approved terms URL.
          var link=terms.cloneNode(true);
          content.replaceChildren(link,document.createTextNode("を確認し同意します。申込みだけでは契約・公開は始まりません。（必須）"));
        }else if(name==="listing_permission"){
          content.textContent="申請する事業者・教室・施設を代表または代理する権限があり、掲載内容が正しいことと、審査後の掲載に同意します。（必須）";
        }else if(name==="trial_referral_consent"){
          content.textContent="家族からの相談の取次ぎについても相談したい（任意）。このチェックだけで予約・個人情報提供・有料契約は開始しません。";
        }
      });

      if(!ready){
        status.textContent="現在、掲載受付システムを準備しています。お問い合わせは kosodatemate@gmail.com へお願いします。";
        if(button){button.disabled=true;button.setAttribute("aria-disabled","true")}
        form.removeAttribute("action");
        return;
      }
      var submission=document.createElement("input");
      submission.type="hidden";submission.name="submission_id";
      if(!globalThis.crypto||typeof crypto.randomUUID!=="function"){
        status.textContent="このブラウザでは安全な申請番号を作成できません。別のブラウザをお試しください。";
        if(button)button.disabled=true;
        return;
      }
      submission.value=crypto.randomUUID();
      form.appendChild(submission);
      if(!form.querySelector('[name="privacy_agree"]')){
      var consentLabel=document.createElement("label");
      consentLabel.style.cssText="display:flex;align-items:flex-start;gap:9px;margin:17px 0;font-size:13px";
      var consent=document.createElement("input");
      consent.type="checkbox";consent.name="privacy_agree";consent.value="同意する";
      consent.required=true;consent.style.cssText="width:19px;height:19px;flex:none;margin-top:4px";
      var consentText=document.createElement("span");
      consentText.textContent="申請内容と担当者の連絡先を、Google Apps Scriptを経由して運営の非公開Google Sheetsに保存することに同意します。（必須）";
      consentLabel.appendChild(consent);consentLabel.appendChild(consentText);
      var insertBefore=form.querySelector('button[type="submit"]');
      if(insertBefore&&insertBefore.parentNode)insertBefore.parentNode.insertBefore(consentLabel,insertBefore);
      else form.appendChild(consentLabel);
      }
      var wrap=document.createElement("div");
      wrap.className="mate-direct-captcha";
      wrap.style.cssText="margin:18px 0;min-height:65px";
      var widget=document.createElement("div");
      widget.className="cf-turnstile";
      widget.setAttribute("data-sitekey",cfg.siteKey);
      widget.setAttribute("data-action","mate_listing");
      widget.setAttribute("data-refresh-expired","auto");
      widget.setAttribute("data-refresh-timeout","auto");
      wrap.appendChild(widget);
      if(button&&button.parentNode)button.parentNode.insertBefore(wrap,button);
      else form.appendChild(wrap);
      form.action=cfg.endpoint;
      form.method="POST";
      form.removeAttribute("target");
      status.textContent=service==="SPARK"?"":"送信するとGoogle Apps Script経由で運営の審査台帳に保存されます。登録だけでは公開されません。";
      // Record only the first human interaction, never input names or contents.
      // A submit attempt is NOT a completed application: GAS confirms receipt.
      var formStarted=false;
      form.addEventListener("focusin",function(e){
        var field=e.target;
        if(formStarted||!field||!field.matches||!field.matches('input:not([type="hidden"]),select,textarea'))return;
        if(field.matches('input[name="_honey"]'))return;
        formStarted=true;
        if(typeof window.gtag==="function")window.gtag("event","listing_form_start",{service:service,form_type:"partner_listing"});
      });
      var pending=false;
      form.addEventListener("submit",function(e){
        e.preventDefault();
        if(pending||!form.reportValidity())return;
        if(media && !media.hidden && !window.MATEPhotoPicker?.get(form)?.populate()){
          status.textContent="写真の選択・利用許諾を確認してください。";return;
        }
        if(typeof window.MATESelfService?.populate!=="function"||!window.MATESelfService.populate(form)){
          status.textContent="公開情報に未入力または不正な項目があります。確認してください。";return;
        }
        var token=form.querySelector('[name="cf-turnstile-response"]');
        // Never navigate to GAS with a token that Cloudflare has already expired.
        // This preserves all entered fields and selected compressed photos.
        if(window.turnstile && typeof window.turnstile.isExpired==="function"){
          try{
            if(window.turnstile.isExpired()){
              if(typeof window.turnstile.reset==="function")window.turnstile.reset();
              status.textContent="セキュリティ認証の有効期限が切れました。認証が更新されたら、もう一度送信してください。";
              return;
            }
          }catch(_ignored){}
        }
        if(!token||!token.value){status.textContent="セキュリティ認証の完了後に送信してください。";return}
        pending=true;
        if(button){button.disabled=true;button.textContent="送信しています…"}
        status.textContent="送信結果は次の画面に表示されます。受け付け後に申請番号が表示されます。";
        if(window.gtag)window.gtag("event","listing_inquiry_submit_attempt",{service:service,lead_type:"partner"});
        // Native navigation is supported across domains; no CORS bypass and no
        // client-side unverified "Thank you" redirect.
        // Only compressed JPEG payload is sent, never original local filenames.
        if(media && !media.hidden){
          var chosenFile=media.querySelector('input[type="file"]');
          if(chosenFile)chosenFile.disabled=true;
        }
        HTMLFormElement.prototype.submit.call(form);
      });
    });
    if(ready){
      var script=document.createElement("script");
      script.async=true;script.defer=true;
      script.src="https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.onerror=function(){
        forms.forEach(function(form){
          var btn=form.querySelector('button[type="submit"]');
          if(btn)btn.disabled=true;
          var status=form.querySelector('[role="status"]');
          if(status)status.textContent="セキュリティ認証を読み込めません。通信環境を確認してください。";
        });
      };
      document.head.appendChild(script);
    }
  });
})();
