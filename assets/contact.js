(() => {
  const form = document.getElementById('listing-contact');
  const status = document.getElementById('form-status');
  if (!form || !status) return;
  const button = form.querySelector('button[type="submit"]');
  let busy = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true;
    button.disabled = true;
    button.textContent = '送信しています…';
    status.hidden = false;
    status.textContent = 'そのままお待ちください。';
    try {
      const response = await fetch('https://formsubmit.co/ajax/kosodatemate@gmail.com', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const result = await response.json();
      if (!response.ok || !(result.success === true || result.success === 'true')) {
        throw new Error('submission_failed');
      }
      location.assign(new URL('thanks.html', location.href).href);
    } catch (_) {
      status.setAttribute('role', 'alert');
      status.textContent = '送信結果を確認できませんでした。入力内容は残っています。送信済みの場合もあるため、繰り返し送信せず、kosodatemate@gmail.com へお問い合わせください。';
      busy = false;
      button.disabled = false;
      button.textContent = '相談内容を送信する';
    }
  });
})();
