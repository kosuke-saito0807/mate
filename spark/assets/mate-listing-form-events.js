/* MATE listing form funnel: anonymous, aggregate UX actions only.
 * A submit attempt is NOT a successful application, approval, or paid contract.
 * No input values, names, email addresses, form contents or URLs are sent.
 */
(function () {
  'use strict';
  var form = document.querySelector('form[data-mate-direct-listing="true"]');
  if (!form) return;
  var serviceField = form.querySelector('input[name="service"]');
  var raw = serviceField ? serviceField.getAttribute('value') : '';
  var service = /^(CARE|SPARK|PLAY)$/.test(raw || '') ? raw : 'OTHER';
  var started = false;
  var validationNoted = false;
  function emit(name) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, { service: service, funnel: 'listing_application' });
  }
  document.addEventListener('click', function (event) {
    var target = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement);
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('a[data-mate-listing-preview="true"]')) {
      // Count curiosity about listing presentation, not a successful application.
      // No URL, provider identity, recipient token or form values are sent.
      emit('mate_listing_preview_click');
    }
  }, { passive: true });
  form.addEventListener('focusin', function (event) {
    var el = event.target;
    if (started || !(el instanceof Element)) return;
    if (!el.matches('input:not([type="hidden"]), select, textarea')) return;
    started = true;
    emit('mate_listing_form_start');
  });
  form.addEventListener('invalid', function () {
    if (validationNoted) return;
    validationNoted = true;
    emit('mate_listing_validation_block');
  }, true);
  form.addEventListener('submit', function () {
    emit('mate_listing_submit_attempt');
  }, true);
}());
