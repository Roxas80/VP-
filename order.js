(function () {
  'use strict';

  // Подстановка категории из ссылки (например order.html?product=торты)
  var params = new URLSearchParams(window.location.search);
  var product = params.get('product');
  if (product) {
    var select = document.querySelector('select[name="product"]');
    if (select) {
      var opt = Array.from(select.options).find(function (o) { return o.value === product; });
      if (opt) select.value = product;
    }
  }

  var form = document.getElementById('order-form');
  var formWrap = document.getElementById('order-form-wrap');
  var successBlock = document.getElementById('order-success');
  var errorBlock = document.getElementById('order-error');
  var errorText = errorBlock ? errorBlock.querySelector('.order-error__text') : null;
  var submitBtn = document.getElementById('order-submit');

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка…';
    }

    var body = {
      name: (form.querySelector('[name="name"]') || {}).value || '',
      phone: (form.querySelector('[name="phone"]') || {}).value || '',
      product: (form.querySelector('[name="product"]') || {}).value || '',
      comment: (form.querySelector('[name="comment"]') || {}).value || '',
    };

    var payload = JSON.stringify(body);
    var opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload };

    function onSuccess() {
      if (formWrap) formWrap.hidden = true;
      if (successBlock) successBlock.hidden = false;
    }
    function onError(msg) {
      if (formWrap) formWrap.hidden = true;
      if (errorBlock) {
        if (errorText) errorText.textContent = msg || 'Не удалось отправить заказ.';
        errorBlock.hidden = false;
      }
    }
    function done() {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить заказ';
      }
    }

    // Сначала Node.js API; при недоступности — PHP на Plesk (api/order.php)
    fetch('/api/orders', opts)
      .then(function (res) {
        return res.json().then(function (data) {
          if (res.ok) {
            onSuccess();
          } else {
            throw new Error(data.error || 'Ошибка отправки');
          }
        });
      })
      .catch(function () {
        return fetch('/api/order.php', opts).then(function (res) {
          return res.json().then(function (data) {
            if (res.ok) {
              onSuccess();
            } else {
              throw new Error(data.error || 'Ошибка отправки');
            }
          });
        });
      })
      .catch(function (err) {
        onError(err.message);
      })
      .finally(done);
  });

  // WhatsApp: тот же номер, что в script.js (замените на реальный)
  var whatsappNumber = '77001234567';
  var whatsappMsg = 'Здравствуйте, хочу заказать десерт';
  document.querySelectorAll('[data-whatsapp]').forEach(function (el) {
    el.href = 'https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent(whatsappMsg);
  });
})();
