import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const [service, host, filepath] of [
  ['CARE', 'care.kosodatemate.jp', 'assets/mate-funnel-events.js'],
  ['SPARK', 'spark.kosodatemate.jp', 'spark/assets/mate-funnel-events.js'],
]) {
  const script = readFileSync(filepath, 'utf8');
  function eventsFor(href, attrs = {}, cardId = 'listing-editorial-example', inCard = true) {
    const listeners = {};
    const events = [];
    const card = {
      getAttribute(key) { return key === 'id' ? cardId : attrs[key] ?? null; },
    };
    const link = {
      href,
      getAttribute(key) { return key === 'href' ? href : null; },
      closest(selector) {
        return selector === '#results .result, #cards .card, .provider' && inCard ? card : null;
      },
    };
    const element = {
      nodeType: 1,
      closest(selector) { return selector === 'a[href]' ? link : null; },
      matches() { return false; },
    };
    const document = {
      addEventListener(name, callback) { listeners[name] = callback; },
    };
    const context = {
      document,
      location: { hostname: host, href: 'https://' + host + '/' },
      window: { gtag(type, name, details) {
        if (type === 'event') events.push({ name, details: JSON.parse(JSON.stringify(details)) });
      } },
      URL,
    };
    vm.runInNewContext(script, context, { filename: filepath, timeout: 1500 });
    assert.equal(typeof listeners.click, 'function');
    listeners.click({ target: element });
    return events.filter(e => e.name === 'mate_provider_outbound_click');
  }

  test(service + ': public editorial provider click is attributed', () => {
    const events = eventsFor('https://official.example.org/', {}, 'editorial-test-service');
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].details, {
      service, link_type: 'provider_card', listing_id: 'editorial-test-service',
      listing_type: 'editorial_reference',
    });
  });
  test(service + ': owner-listed business has separate non-editorial label', () => {
    const events = eventsFor('https://owner.example.org/', {}, 'listing-owner123');
    assert.equal(events.length, 1);
    assert.equal(events[0].details.listing_id, 'owner123');
    assert.equal(events[0].details.listing_type, 'non_editorial');
  });
  test(service + ': SPARK school ID and editorial ID attributes are supported', () => {
    assert.equal(eventsFor('https://school.example/', {'data-school-id':'editorial-class-1'}, '').at(0)?.details.listing_id, 'editorial-class-1');
    assert.equal(eventsFor('https://school.example/', {'data-editorial-key':'editorial-art-2'}, '').at(0)?.details.listing_id, 'editorial-art-2');
  });
  test(service + ': internal links, unrelated links and demo cards are not referrals', () => {
    assert.equal(eventsFor('https://spark.kosodatemate.jp/', {}, 'listing-test').length, 0);
    assert.equal(eventsFor('https://' + host + '/provider.html?id=2', {}, 'listing-test').length, 0);
    assert.equal(eventsFor('https://official.example.org/', {}, 'listing-test', false).length, 0);
    assert.equal(eventsFor('https://official.example.org/', {'data-mate-demo':'true'}, 'listing-test').length, 0);
  });
  test(service + ': invalid business IDs never enter analytics', () => {
    const events = eventsFor('https://official.example.org/', {}, 'listing-<person@email>');
    assert.equal(events.length, 1);
    assert.equal(events[0].details.listing_id, undefined);
    assert.equal(events[0].details.service, service);
  });
}
