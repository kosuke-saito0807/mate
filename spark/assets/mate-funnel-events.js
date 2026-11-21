/* MATE privacy-minimizing engagement events.
 * Reports only service and action category. Never send search terms, user IDs,
 * provider URLs, contact data, or input values to analytics.
 * Requires GA4 gtag from the site's existing consent/configuration.
 */
(function () {
  'use strict';
  var service = location.hostname.indexOf('spark.') === 0 ? 'SPARK' : 'CARE';
  function emit(name, parameters) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, Object.assign({ service: service }, parameters || {}));
  }
  function node(value) {
    return value && value.nodeType === 1 ? value : value && value.parentElement;
  }
  document.addEventListener('click', function (event) {
    var element = node(event.target);
    if (!element || typeof element.closest !== 'function') return;
    var link = element.closest('a[href]');
    if (link) {
      var target;
      try { target = new URL(link.href, location.href); } catch (_) { return; }
      if ((target.protocol === 'https:' || target.protocol === 'http:') &&
          target.hostname !== location.hostname &&
          !/(^|\\.)kosodatemate\\.jp$/.test(target.hostname)) {
        emit('mate_provider_outbound_click', { link_type: 'external_provider_or_source' });
      }
      if (link.getAttribute('href') === '#find' || link.getAttribute('href') === '#discover') {
        emit('mate_search_entry_click', { entry_type: 'jump_to_search' });
      }
    }
    var searchSection = element.closest('#find, #discover');
    if (searchSection && element.closest('button')) {
      emit('mate_search_control_click', { entry_type: 'search_area_button' });
    }
  }, { passive: true });
  document.addEventListener('submit', function (event) {
    var form = node(event.target);
    if (form && form.closest && form.closest('#find, #discover')) {
      emit('mate_search_submit', { entry_type: 'search_form' });
    }
  }, { passive: true });
}());
