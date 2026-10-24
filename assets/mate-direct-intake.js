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
      var button=form.querySelector('button[type="submit"]');
      var status=form.querySelector('[role="status"]')||document.createElement("p");
      if(!status.parentNode){status.setAttribute("role","status");form.appendChild(status)}
      status.setAttribute("aria-live","polite");
      status.hidden=false;
      var sendLabel=button?button.textContent:"";
      var service=(form.querySelector('[name="service"]')||{}).value;
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
      var consent=document.createElement("input");
      consent.type="hidden";consent.name="privacy_agree";consent.value="同意する";
      // The visible, required listing/privacy consent must still be checked first.
      form.appendChild(consent);
      var wrap=document.createElement("div");
      wrap.className="mate-direct-captcha";
      wrap.style.cssText="margin:18px 0;min-height:65px";
      var widget=document.createElement("div");
      widget.className="cf-turnstile";
      widget.setAttribute("data-sitekey",cfg.siteKey);
      widget.setAttribute("data-action","mate_listing");
      wrap.appendChild(widget);
      if(button&&button.parentNode)button.parentNode.insertBefore(wrap,button);
      else form.appendChild(wrap);
      form.action=cfg.endpoint;
      form.method="POST";
      form.removeAttribute("target");
      status.textContent="送信するとGoogle Apps Script経由で運営の審査台帳に保存されます。登録だけでは公開されません。";
      var pending=false;
      form.addEventListener("submit",function(e){
        e.preventDefault();
        if(pending||!form.reportValidity())return;
        if(typeof window.MATESelfService?.populate!=="function"||!window.MATESelfService.populate(form)){
          status.textContent="公開情報に未入力または不正な項目があります。確認してください。";return;
        }
        var token=form.querySelector('[name="cf-turnstile-response"]');
        if(!token||!token.value){status.textContent="セキュリティ認証の完了後に送信してください。";return}
        pending=true;
        if(button){button.disabled=true;button.textContent="送信しています…"}
        status.textContent="送信結果は次の画面に表示されます。受け付け後に申請番号が表示されます。";
        if(window.gtag)window.gtag("event","listing_inquiry_submit_attempt",{service:service,lead_type:"partner"});
        // Native navigation is supported across domains; no CORS bypass and no
        // client-side unverified "Thank you" redirect.
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
