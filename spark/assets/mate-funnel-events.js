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
    return element.closest('#find, #discover, .directory-search, .directory-filters') ||
      (element.matches('#filter, #directory-filter') ? element : null);
  }
  function listingReference(card) {
    // Business identifiers are public, bounded slugs; never emit input values or URLs.
    if (card.getAttribute('data-mate-demo') === 'true') return null;
    var id = card.getAttribute('data-school-id') || card.getAttribute('data-editorial-key') || '';
    if (!id) {
      var raw = card.getAttribute('id') || '';
      id = raw.indexOf('listing-') === 0 ? raw.slice(8) : raw;
    }
    if (!/^[A-Za-z0-9_-]{2,80}$/.test(id)) return null;
    return { listing_id: id,
      listing_type: id.indexOf('editorial-') === 0 ? 'editorial_reference' : 'non_editorial' };
  }
  document.addEventListener('click', function (event) {
    var element = asElement(event.target);
    if (!element || typeof element.closest !== 'function') return;
    var link = element.closest('a[href]');
    if (link) {
      var href = link.getAttribute('href') || '';
      if (link.getAttribute('data-mate-owner-claim')) {
        // Interest in becoming a verified partner, not an approved listing.
        // Do not send the public reference ID, user identity or form fields.
        emit('mate_owner_claim_entry_click', { entry_type: 'editorial_reference' });
      }
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
          var ref = listingReference(card);
          if (ref) emit('mate_provider_outbound_click', Object.assign({ link_type: 'provider_card' }, ref));
          else if (card.getAttribute('data-mate-demo') !== 'true')
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
