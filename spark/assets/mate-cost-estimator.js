/* Privacy-preserving family cost estimate: all amounts remain in this browser tab.
 * A calculation is not a quote, reservation, lead, contract, or paid conversion.
 */
(function () {
  'use strict';
  var root = document.querySelector('[data-mate-cost-estimator]');
  if (!root) return;
  var service = root.getAttribute('data-mate-cost-estimator');
  if (service !== 'CARE' && service !== 'SPARK') return;
  var result = root.querySelector('[data-cost-result]');
  var reset = root.querySelector('[data-cost-reset]');
  if (!result || !reset) return;
  var recorded = false;
  function amount(key, required, limit) {
    var input = root.querySelector('input[data-cost-key="' + key + '"]');
    if (!input) return null;
    var value = input.value.trim();
    if (value === '') return required ? null : 0;
    var number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > limit) return null;
    return number;
  }
  function format(number) {
    return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })
      .format(Math.round(number)) + '円';
  }
  function update() {
    var cost;
    var heading;
    if (service === 'CARE') {
      var hourly = amount('hourly', true, 100000);
      var hours = amount('hours', true, 24);
      var visits = amount('visits', true, 31);
      var transport = amount('transport', false, 1000000);
      var surcharge = amount('surcharge', false, 1000000);
      if (hourly === null || hours === null || visits === null ||
          transport === null || surcharge === null || hours <= 0 || visits < 1 ||
          !Number.isInteger(visits)) {
        result.textContent = '時給・利用時間・利用回数を入力すると概算を表示します。';
        return;
      }
      cost = (hourly * hours + transport + surcharge) * visits;
      heading = '入力条件での概算総額';
    } else {
      var monthly = amount('monthly', true, 1000000);
      var months = amount('months', true, 12);
      var enrollment = amount('enrollment', false, 1000000);
      var materials = amount('materials', false, 1000000);
      var other = amount('other', false, 1000000);
      if (monthly === null || months === null || enrollment === null ||
          materials === null || other === null || months < 1 ||
          !Number.isInteger(months)) {
        result.textContent = '月謝・支払い月数を入力すると概算を表示します。';
        return;
      }
      cost = monthly * months + enrollment + materials + other;
      heading = months + 'か月分の概算総額';
    }
    if (!Number.isFinite(cost) || cost > 1000000000) {
      result.textContent = '入力値が大きすぎます。実際の条件で再入力してください。';
      return;
    }
    result.textContent = heading + '：' + format(cost) +
      '。未入力の任意費用は0円として計算しています。税込・追加料金や実際の適用条件は公式見積もりをご確認ください。';
    if (!recorded && typeof window.gtag === 'function') {
      // Only service and calculator mode, never entered costs or input identifiers.
      window.gtag('event', 'mate_cost_estimator_used', {
        service: service,
        estimator_type: service === 'CARE' ? 'sitter_total' : 'lesson_total'
      });
      recorded = true;
    }
  }
  root.addEventListener('input', update, { passive: true });
  reset.addEventListener('click', function () {
    root.querySelectorAll('input[data-cost-key]').forEach(function (input) {
      input.value = '';
    });
    update();
  });
}());
