/* CARE/SPARK editorial directory comparison, entirely within the browser.
 * Filters use the REGION DISPLAYED IN THE EDITORIAL REFERENCE, not a claim
 * that services cover that prefecture. No query or preferences are transmitted.
 */
(function () {
  'use strict';
  var select = document.getElementById('directory-region');
  var query = document.getElementById('filter') ||
    document.getElementById('directory-filter');
  var output = document.getElementById('directory-filter-result');
  var empty = document.getElementById('empty');
  var cards = Array.from(document.querySelectorAll('.provider[data-region]'));
  var sections = Array.from(document.querySelectorAll('#directory-content .group'));
  if (!select || !query || !output || !empty || !cards.length) return;

  var prefectures = ('北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 ' +
    '栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 ' +
    '山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 ' +
    '奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 ' +
    '高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県 全国')
    .split(' ');
  var allowed = new Set(prefectures);
  function tokens(card) {
    var raw = card.getAttribute('data-region') || '';
    // Examples: 東京都, 東京都・神奈川県・千葉県, 全国（エリア要確認）.
    return raw.split(/[・、,]/).map(function (part) {
      var match = part.trim().match(/^([一-龠ぁ-んァ-ンー]+(?:都|道|府|県)|全国)/);
      return match && allowed.has(match[1]) ? match[1] : '';
    }).filter(Boolean);
  }
  var byCard = new Map();
  var represented = new Set();
  cards.forEach(function (card) {
    var regions = tokens(card);
    byCard.set(card, regions);
    regions.forEach(function (name) { represented.add(name); });
  });
  prefectures.filter(function (name) { return represented.has(name); })
    .forEach(function (name) {
      var option = document.createElement('option');
      option.value = name;
      option.textContent = name === '全国' ? '全国と記載された情報' : name;
      select.appendChild(option);
    });

  // Allow a link from a region guide to start on that exact displayed region.
  var requested = '';
  try {
    var url = new URL(window.location.href);
    var raw = url.searchParams.get('region') || '';
    if (raw.length <= 8 && represented.has(raw)) requested = raw;
  } catch (_) {}
  select.value = requested;

  function apply() {
    var text = query.value.trim().normalize('NFKC').toLocaleLowerCase('ja');
    var region = select.value;
    var count = 0;
    cards.forEach(function (card) {
      var regionMatch = !region || byCard.get(card).includes(region);
      var wordMatch = !text ||
        card.textContent.normalize('NFKC').toLocaleLowerCase('ja').includes(text);
      card.hidden = !(regionMatch && wordMatch);
      if (!card.hidden) count++;
    });
    sections.forEach(function (section) {
      section.hidden = !Array.from(section.querySelectorAll('.provider'))
        .some(function (card) { return !card.hidden; });
    });
    empty.hidden = count !== 0;
    output.textContent = count + '件を表示（全' + cards.length +
      '件）。記載地域で絞り込んでいます。実際の提供地域・受け入れ条件は公式サイトでご確認ください。';
  }
  query.addEventListener('input', apply, {passive:true});
  select.addEventListener('change', function () {
    // Only a public prefecture label enters the address bar, not free text.
    try {
      var url = new URL(window.location.href);
      if (select.value) url.searchParams.set('region', select.value);
      else url.searchParams.delete('region');
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
    apply();
  });
  apply();
}());
