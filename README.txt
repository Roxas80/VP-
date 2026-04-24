Vkusno Polezno Astana — Website
================================

Файлы:
  index.html           — Главная
  menu.html            — Ассортимент (каталог)
  product.html         — Карточка товара (Медовик)
  order.html           — Оформление заказа
  design-system.html   — Дизайн-система бренда
  assets/              — JS/CSS исходники (не обязательны — вся логика инлайн в HTML)

Как запустить:
  Вариант 1 (локально): двойной клик по index.html
  Вариант 2 (локальный сервер):   python3 -m http.server 8000  → http://localhost:8000
  Вариант 3 (хостинг): загрузить все файлы в корень сайта

Деплой на GitHub Pages:
  1. Скопировать содержимое этой папки в корень репозитория
  2. Закоммитить, запушить в main
  3. Settings → Pages → Source: Deploy from branch, main, / (root)
  4. Сайт будет доступен по адресу https://<user>.github.io/<repo>/

Деплой на Netlify:
  1. Зайти на app.netlify.com/drop
  2. Перетащить эту папку в окно браузера
  3. Готово — получите URL сразу

Деплой на Vercel:
  1. vercel.com → Import Project → подключите GitHub
  2. Framework preset: Other
  3. Deploy

Переключатель языков RU / KZ / EN работает на всех страницах,
выбор сохраняется в localStorage.

© 2026 Vkusno Polezno Astana
