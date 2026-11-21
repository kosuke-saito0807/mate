/* MATE engagement analytics: aggregate action types only, never user inputs or URLs. */
(function () {
  'use strict';
  var service = location.hostname.indexOf('spark.') === 0 ? 'SPARK' : 'CARE';
  function emit(name, values) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, Object.assign({ service: service }, values || {}));
  }
  function asElement(target) {
    return target && target.nodeType === 1 ? target : target && target.parentElement;
  }
  function searchArea(element) {
    return element.closest('#find, #discover, .directory-search, .directory-filters');
  }
  document.addEventListener('click', function (event) {
    var element = asElement(event.target);
    if (!element || typeof element.closest !== 'function') return;
    var link = element.closest('a[href]');
    if (link) {
      var href = link.getAttribute('href') || '';
      if (href === '#find' || href === '#discover') {
        emit('mate_search_entry_click', { entry_type: 'jump_to_search' });
      }
      // Only count provider-card outbound actions, never social/legal/footer links.
      var card = link.closest('#results .result, #cards .card, .provider');
      if (card) {
        var target;
        try { target = new URL(link.href, location.href); } catch (_) { return; }
        if ((target.protocol === 'http:' || target.protocol === 'https:') &&
            target.hostname !== location.hostname &&
            !/(^|\.)kosodatemate\.jp$/.test(target.hostname)) {
          emit('mate_provider_outbound_click', { link_type: 'provider_card' });
        }
      }
    }
    if (searchArea(element) && element.closest('button')) {
      emit('mate_search_control_click', { entry_type: 'search_button' });
    }
  }, { passive: true });
  document.addEventListener('change', function (event) {
    var input = asElement(event.target);
    if (!input || !searchArea(input)) return;
    if (input.matches('input, select')) {
      // Deliberately omit the input's ID, name, selected option and typed text.
      emit('mate_search_filter_change', { control_type: input.matches('select') ? 'select' : 'input' });
    }
  }, { passive: true });
  document.addEventListener('submit', function (event) {
    var form = asElement(event.target);
    if (form && searchArea(form)) {
      emit('mate_search_submit', { entry_type: 'search_form' });
    }
  }, { passive: true });
}());
