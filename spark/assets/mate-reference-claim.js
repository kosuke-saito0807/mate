/* Help an actual provider start a formal application from a public editorial
 * reference card. This is an INPUT HINT only, never ownership verification.
 * Only first-party public JSON is read. No user data is sent or stored.
 */
(function () {
  'use strict';
  var hash = window.location.hash || '';
  if (!/^#claim=editorial-[a-z0-9_-]{2,80}$/.test(hash)) return;
  var referenceId = hash.slice('#claim='.length);
  var form = document.querySelector('form[data-mate-direct-listing="true"]');
  var notice = document.querySelector('[data-mate-claim-notice]');
  if (!form || !notice) return;
  var serviceField = form.querySelector('input[name="service"]');
  var service = serviceField && serviceField.value;
  if (service !== 'CARE' && service !== 'SPARK') return;
  var source = service === 'CARE' ? 'editorial-care.json' : 'editorial-schools.json';
  // Relative same-origin URL; do not contact the provider or an outside party.
  window.fetch(source, { cache: 'no-store', credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('source unavailable');
      return response.json();
    })
    .then(function (rows) {
      if (!Array.isArray(rows)) return;
      var match = rows.find(function (row) {
        return row && row.id === referenceId &&
          row.editorial === true && row.approved === false;
      });
      if (!match || typeof match.name !== 'string' ||
          typeof match.url !== 'string') return;
      var name = match.name.trim();
      var website = match.url.trim();
      if (!name || name.length > 160 || website.length > 500) return;
      var url;
      try { url = new URL(website); } catch (_) { return; }
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return;
      var company = form.querySelector('input[name="company"]');
      var site = form.querySelector('input[name="website"]');
      if (!company || !site) return;
      // Never replace fields that the visitor has already edited.
      if (!company.value.trim()) company.value = name;
      if (!site.value.trim()) site.value = website;
      notice.textContent = '編集部の未承認参考情報から、事業者名と公式URLを入力補助しました。内容を必ずご確認・修正し、担当者様の権限がある場合にのみ申請してください。入力補助は本人確認や掲載承認ではありません。';
      notice.hidden = false;
      if (typeof window.gtag === 'function') {
        // Record only anonymous type, never ID, name, address or form values.
        window.gtag('event', 'mate_editorial_claim_prefill', {
          service: service, reference_type: 'unapproved_editorial'
        });
      }
    })
    .catch(function () {
      // Manual application continues to work. Never auto-submit or auto-publish.
    });
}());
