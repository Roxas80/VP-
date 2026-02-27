# Vkusno Polezno Astana

Сайт-визитка и лендинг бренда полезных десертов в Астане. Оформление заказов через страницу заказа с сохранением в PostgreSQL и опциональной синхронизацией с CRM Twenty. WhatsApp остаётся дополнительным способом заказа.

## Структура проекта

- `index.html`, `order.html` — главная и страница оформления заказа
- `styles.css`, `script.js`, `order.js` — стили и скрипты
- `data/menu.json` — меню и цены (обновлять по Instagram)
- `backend/` — API заказов (Express + PostgreSQL + интеграция с Twenty CRM)
- `backend/db/schema.sql` — схема таблицы заказов (PostgreSQL)
- `api/order.php` — приём заказов на PHP для хостинга без Node.js (Plesk)
- `backend/db/schema-mysql.sql` — схема для MySQL (вариант с PHP)

**Репозиторий:** [github.com/Roxas80/VP-](https://github.com/Roxas80/VP-) — при первом развёртывании залейте проект с компьютера (`git push`), чтобы на сервере можно было сделать `git clone`.

**Развёртывание:**  
- На сервере по SSH (сайт + Twenty CRM): [docs/DEPLOY_SSH.md](docs/DEPLOY_SSH.md)  
- На хостинге с Plesk (без SSH): [docs/DEPLOY_PLESK.md](docs/DEPLOY_PLESK.md)

## Запуск с API и БД (рекомендуется)

Так заказы будут сохраняться в PostgreSQL и при желании синхронизироваться с Twenty CRM.

### Вариант 1: Docker

```bash
docker compose up -d
```

Сайт и API: **http://localhost:3000**

- Главная: http://localhost:3000  
- Оформить заказ: http://localhost:3000/order.html  
- Проверка API: http://localhost:3000/api/health  

БД: PostgreSQL в контейнере `db`, логин/пароль/БД: `vpa`/`vpa`/`vpa` (для продакшена смените в `docker-compose.yml`).

### Вариант 2: Локально

1. Установите PostgreSQL и создайте БД:

```bash
createdb vpa
psql -d vpa -f backend/db/schema.sql
```

2. Настройте окружение:

```bash
cd backend
cp .env.example .env
# Отредактируйте .env: DATABASE_URL=postgresql://user:password@localhost:5432/vpa
npm install
```

3. Запустите API (статику отдаёт тот же сервер):

```bash
npm start
```

Откройте http://localhost:3000 (порт задаётся в `.env` как `PORT`).

## Интеграция с Twenty CRM

[Twenty](https://github.com/twentyhq/twenty) — open source CRM на PostgreSQL с REST API. Заявки с сайта создают в Twenty клиента (Person) и при настройке — сделку (Opportunity) в стадии «Новый заказ». Полная постановка и настройка CRM описаны в репозитории:

- **Постановка задачи:** [📄 Постановка задачи twenty crm.md](📄%20Постановка%20задачи%20twenty%20crm.md)
- **Настройка Twenty под постановку:** [docs/TWENTY_CRM_SETUP.md](docs/TWENTY_CRM_SETUP.md)

### Шаг 1: Развернуть Twenty

Самостоятельный хостинг (Docker):

- Документация: https://docs.twenty.com/developers/self-hosting/docker-compose  
- После установки создайте API-ключ: **Settings → APIs & Webhooks → Create key**.

### Шаг 2: Настроить бэкенд VPA

В `backend/.env` добавьте:

```env
TWENTY_API_URL=https://ваш-домен-twenty.com
TWENTY_API_KEY=ваш_api_ключ
```

Перезапустите backend. Каждый новый заказ с сайта будет сохраняться в PostgreSQL и дополнительно создаваться как контакт (Person) в Twenty. Если в Twenty есть кастомные поля для заказа (например, комментарий или категория), при необходимости можно расширить тело запроса в `backend/server.js` (функция `syncOrderToTwenty`).

## Запуск без API (только статика)

Если backend не нужен (например, только демо):

- Откройте `index.html` в браузере или раздайте папку через любой веб-сервер.
- Кнопки «Оформить заказ» ведут на `order.html`; отправка формы с `order.html` работает только при запущенном API (иначе покажется ошибка с предложением заказать через WhatsApp).

## Настройка перед публикацией

1. **WhatsApp** — в `script.js` и `order.js` замените номер на реальный в формате `77001234567`.
2. **Карта** — в `index.html` в блоке «Контакты» замените `src` у `iframe` на вашу карту (Google Maps → Встроить карту).
3. **Адрес** — замените текст «Астана, доставка по городу» при необходимости.
4. **Меню и цены** — актуальный ассортимент и цены берутся из **Instagram** [vkusno_polezno_astana](https://www.instagram.com/vkusno_polezno_astana/). На сайте используется файл `data/menu.json`: скопируйте позиции и цены из постов/сторис и отредактируйте JSON (поля `name`, `price`, `note` по категориям). На главной отображается блок «Меню и цены» со ссылкой на Instagram.
5. **Изображения** — в `styles.css` замените URL фото на свои (классы `.hero__bg`, `.product-card__image--*`, `.gallery__item--*`).

## Ссылки

- [Instagram](https://www.instagram.com/vkusno_polezno_astana)
- TikTok: @vkusno_polezno_ast
