(function () {
  'use strict';

  // Замените на реальный номер в формате 77001234567 (без +)
  const WHATSAPP_NUMBER = '77001234567';
  const WHATSAPP_MESSAGE = 'Здравствуйте, хочу заказать десерт';

  function getWhatsAppUrl(customText) {
    const text = encodeURIComponent(customText || WHATSAPP_MESSAGE);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  }

  // Все кнопки "Заказать" / WhatsApp
  document.querySelectorAll('[data-whatsapp]').forEach(function (el) {
    el.href = getWhatsAppUrl();
  });

  // Мобильное меню
  var burger = document.querySelector('.burger');
  var mobileMenu = document.querySelector('.mobile-menu');

  if (burger && mobileMenu) {
    burger.addEventListener('click', function () {
      mobileMenu.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', mobileMenu.classList.contains('is-open'));
    });

    mobileMenu.querySelectorAll('.mobile-menu__link').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenu.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Форма заявки: отправка через WhatsApp
  var form = document.getElementById('order-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (form.querySelector('[name="name"]') || {}).value || '';
      var phone = (form.querySelector('[name="phone"]') || {}).value || '';
      var comment = (form.querySelector('[name="comment"]') || {}).value || '';
      var message = WHATSAPP_MESSAGE;
      if (name || phone || comment) {
        message += '\n\n— Имя: ' + name;
        if (phone) message += '\n— Телефон: ' + phone;
        if (comment) message += '\n— Комментарий: ' + comment;
      }
      window.open(getWhatsAppUrl(message), '_blank', 'noopener');
    });
  }

  // Плавная прокрутка для якорных ссылок (дополнительно к CSS scroll-behavior)
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    var id = anchor.getAttribute('href');
    if (id === '#') return;
    var target = document.querySelector(id);
    if (target) {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });

  // Меню и цены: загрузка из data/menu.json (при открытии через сервер) или fallback
  var menuRoot = document.getElementById('menu-root');
  if (menuRoot) {
    var fallbackMenu = {
      currency: '\u20B8',
      categories: [
        { id: 'торты', title: 'Торты', items: [
          { name: 'Торт на заказ (1 кг)', price: 8500, note: 'натуральный крем, фрукты' },
          { name: 'Торт на заказ (2 кг)', price: 15000, note: '' },
          { name: 'Медовик', price: 7500, note: 'за 1 кг' },
          { name: 'Наполеон', price: 8000, note: 'за 1 кг' },
          { name: 'Чизкейк классический', price: 9500, note: 'целый' }
        ]},
        { id: 'десерты', title: 'Десерты', items: [
          { name: 'Капкейк', price: 850, note: 'шт' },
          { name: 'Маффин ПП', price: 750, note: 'шт' },
          { name: 'Эклер', price: 650, note: 'шт' },
          { name: 'Торт-мороженое (порция)', price: 1200, note: '' },
          { name: 'Панна-кота', price: 950, note: 'порция' }
        ]},
        { id: 'хлеб', title: 'Хлеб', items: [
          { name: 'Хлеб на закваске', price: 1200, note: 'буханка' },
          { name: 'Бездрожжевой хлеб', price: 1100, note: 'буханка' },
          { name: 'Багет', price: 650, note: 'шт' }
        ]},
        { id: 'пироги', title: 'Пироги', items: [
          { name: 'Пирог яблочный', price: 2500, note: 'целый' },
          { name: 'Пирог с вишней', price: 2700, note: 'целый' },
          { name: 'Пирог с мясом', price: 2200, note: 'целый' },
          { name: 'Слойка с творогом', price: 450, note: 'шт' }
        ]}
      ]
    };

    function renderMenu(data) {
      var cur = data.currency || '\u20B8';
      menuRoot.innerHTML = data.categories.map(function (cat) {
        var rows = cat.items.map(function (item) {
          var note = item.note ? ' <span class="menu-item__note">' + escapeHtml(item.note) + '</span>' : '';
          var price = typeof item.price === 'number' ? item.price.toLocaleString('ru-KZ') + ' ' + cur : item.price;
          return '<div class="menu-item"><span class="menu-item__name">' + escapeHtml(item.name) + note + '</span><span class="menu-item__price">' + price + '</span></div>';
        }).join('');
        return '<div class="menu-category"><h3 class="menu-category__title">' + escapeHtml(cat.title) + '</h3><div class="menu-category__items">' + rows + '</div><a href="order.html?product=' + encodeURIComponent(cat.id) + '" class="btn btn--primary menu-category__order">Заказать</a></div>';
      }).join('');
    }

    function escapeHtml(s) {
      if (!s) return '';
      var div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    fetch('data/menu.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(renderMenu)
      .catch(function () { renderMenu(fallbackMenu); });
  }
})();
