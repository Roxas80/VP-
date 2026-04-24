# Развёртывание VPA и Twenty CRM на сервере по SSH — пошагово с нуля

Полный порядок: окружение → СУБД → загрузка структуры данных → приложения → веб-сервер → SSL. Отдельно: какая СУБД у кого, когда выполняется схема, почтовый сервер.

---

## Оглавление

1. [Что ставится и в какой очерёдности](#1-что-ставится-и-в-какой-очередности)
2. [СУБД: кто какую использует](#2-субд-кто-какую-использует)
3. [Когда и как загружается структура данных (схема)](#3-когда-и-как-загружается-структура-данных-схема)
4. [Почтовый сервер](#4-почтовый-сервер)
5. [Файлы проекта VPA, нужные для деплоя](#5-файлы-проекта-vpa-нужные-для-деплоя)
6. [Команды по шагам (порядок исполнения)](#6-команды-по-шагам-порядок-исполнения)

---

## 1. Что ставится и в какой очерёдности

Рекомендуемый порядок:

| Шаг | Действие | Зачем |
|-----|----------|--------|
| 1 | Подготовка ОС (обновление, пакеты) | База для всего |
| 2 | Docker + Docker Compose | Запуск контейнеров |
| 3 | Nginx + Certbot | Прокси и SSL позже |
| 4 | Файрвол (22, 80, 443) | Безопасность |
| 5 | **Twenty CRM** (Docker) | Сначала CRM: в ней заведёте API-ключ для сайта |
| 6 | **Сайт VPA** (Docker) | Сайт и API заказов; подключается к Twenty по API |
| 7 | Конфиги Nginx (прокси на порты 3000 и 3080) | Доступ по доменам |
| 8 | SSL (Let's Encrypt) | HTTPS |

Отдельно PostgreSQL на хост **не ставится**: у VPA и у Twenty свои контейнеры с БД (см. ниже).

---

## 2. СУБД: кто какую использует

- **Сайт VPA (заказы с формы)**  
  - **PostgreSQL 16** в контейнере `db` внутри нашего `docker-compose.yml`.  
  - Образ: `postgres:16-alpine`.  
  - Одна база `vpa`, пользователь `vpa`, пароль задаётся в compose.  
  - Схема (таблица `orders` и индексы) подгружается **автоматически** при первом запуске контейнера (см. п. 3).

- **Twenty CRM**  
  - **PostgreSQL** (и **Redis**) — внутри **собственного** Docker Compose Twenty.  
  - Ставить отдельную СУБД на хост для Twenty не нужно: скрипт/репозиторий Twenty поднимает свои сервисы (server, worker, postgres, redis).  
  - Структуру БД Twenty создаёт **сам** при первом старте (миграции внутри образа).

Итого: **две независимые PostgreSQL** — одна в контейнерах VPA, вторая в контейнерах Twenty. На сервере только Docker, Nginx и системные пакеты.

---

## 3. Когда и как загружается структура данных (схема)

### Сайт VPA

- **Скрипт:** `backend/db/schema.sql` (в репозитории).
- **Как попадает в контейнер:** в `docker-compose.yml` он смонтирован в каталог инициализации PostgreSQL:
  ```yaml
  volumes:
    - ./backend/db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
  ```
- **Когда выполняется:** при **первом** запуске контейнера `db` (когда тома с данными ещё пустые). Стандартный механизм PostgreSQL: все `.sql` из `docker-entrypoint-initdb.d/` выполняются по алфавиту один раз при инициализации БД.
- **Что делать вручную:** ничего. Достаточно положить проект в `/opt/vpa` и выполнить `docker compose up -d`. Таблица `orders` появится сама.

Если нужно пересоздать БД с нуля (осторожно, данные удалятся):

```bash
cd /opt/vpa
docker compose down
docker volume rm vpa_postgres_data   # имя может быть с префиксом каталога
docker compose up -d
```

### Twenty CRM

- **Скриптов от нас нет.** Схему создаёт само приложение Twenty при старте (миграции внутри образа).
- **Последовательность:** установка Twenty по официальной инструкции → `docker compose up -d` → при первом запуске контейнеры Twenty применяют миграции к своей PostgreSQL.
- Вручную SQL для Twenty выполнять не нужно.

---

## 4. Почтовый сервер

- **Сайт VPA**  
  Письма не отправляет. Форма сохраняет заявку в PostgreSQL и при настройке отправляет данные в Twenty по API. Отдельный почтовый сервер для сайта **не нужен**.

- **Twenty CRM**  
  Может отправлять письма (приглашения, уведомления). Это **опционально**:
  - Настройка через переменные окружения в конфиге Twenty (их docker-compose / .env), например SMTP-хост, порт, логин, пароль. Точный список — в [документации Twenty](https://docs.twenty.com/developers/self-hosting/configuration).
  - Либо через веб-интерфейс Twenty (Settings), если вынесено в UI.
  - Можно использовать внешний SMTP (например, почта хостинга, SendGrid, Mailgun и т.п.). Отдельный свой почтовый сервер на том же хосте для старта **не обязателен**.

---

## 5. Файлы проекта VPA, нужные для деплоя

Список по папкам (всё в каталоге VPA):

| Путь | Назначение |
|------|------------|
| `index.html` | Главная страница сайта |
| `order.html` | Страница оформления заказа |
| `styles.css` | Стили |
| `script.js` | Логика главной (меню, WhatsApp, форма в футере) |
| `order.js` | Отправка формы заказа на API (с fallback на PHP при необходимости) |
| `data/menu.json` | Меню и цены (подставляется в блок «Меню и цены») |
| `backend/server.js` | API заказов (Express): POST /api/orders, раздача статики |
| `backend/package.json` | Зависимости Node.js |
| `backend/Dockerfile` | Образ для контейнера приложения VPA |
| `backend/db/schema.sql` | **Скрипт структуры БД** для PostgreSQL (таблица `orders`) — выполняется автоматически при первом старте контейнера `db` |
| `backend/.env.example` | Пример переменных; на сервере копируете в `backend/.env` и заполняете |
| `backend/.env` | Создаётся на сервере из `.env.example` (DATABASE_URL можно переопределить в compose; TWENTY_* берутся отсюда) |
| `docker-compose.yml` | Запуск контейнеров: приложение VPA (порт 3000) и PostgreSQL для заказов |
| `api/order.php` | Не используется при деплое через Docker (вариант для Plesk без Node) |
| `backend/db/schema-mysql.sql` | Не используется при деплое через Docker (для варианта с PHP + MySQL) |

Остальное (документация, чек-листы, постановки) для деплоя не обязательно, но полезно держать в репозитории.

---

## 6. Команды по шагам (порядок исполнения)

Выполнять по порядку, подставляя свои `IP_СЕРВЕРА`, домены и пароли.

---

### Шаг 1. Подключение по SSH

```bash
ssh user@IP_СЕРВЕРА
```

---

### Шаг 2. Обновление системы и базовые пакеты (Ubuntu/Debian)

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git
```

---

### Шаг 3. Установка Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker aseka
```

Запустить демон Docker и включить автозапуск при загрузке сервера:

```bash
sudo systemctl start docker
sudo systemctl enable docker
sudo systemctl status docker
# Должно быть: Active: active (running)
```

Проверка: `docker ps` (после перелогина — без sudo, до — возможно `sudo docker ps`).

**Права для пользователя aseka (Docker и каталоги в /opt):** выполнить один раз от root или с `sudo`. После этого работать по SSH под пользователем `aseka`.

```bash
# Доступ к Docker без sudo (группа docker)
sudo usermod -aG docker aseka

# Владелец каталогов в /opt — aseka (создать при необходимости и передать права)
sudo mkdir -p /opt/twenty /opt/vpa
sudo chown -R aseka:aseka /opt/twenty /opt/vpa
```

Если каталоги уже существуют и заняты root:

```bash
sudo chown -R aseka:aseka /opt/twenty /opt/vpa
```

Выйти из SSH и зайти снова под **aseka**, чтобы применилась группа `docker`:

```bash
exit
# снова: ssh aseka@IP_СЕРВЕРА
```

---

### Шаг 4. Установка Docker Compose (плагин)

```bash
sudo apt install -y docker-compose-plugin
docker compose version
```

---

### Шаг 5. Nginx и Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
```

---

### Шаг 6. Файрвол

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

### Шаг 7. Установка Twenty CRM

**Важно:** все команды ниже выполняются **на сервере по SSH**, а не на вашем компьютере. Если скрипт пишет «Docker is not running», часто скрипт запущен локально (Mac/Windows), где Docker Desktop не запущен — подключайтесь к серверу и выполняйте команды там.

**Проверка Docker на сервере:**

```bash
sudo systemctl start docker
sudo systemctl status docker   # должно быть active (running)
docker ps                      # пустая таблица — нормально; ошибка «Cannot connect» — Docker не работает
docker run --rm hello-world   # должен вывести «Hello from Docker!»
```

Если `docker ps` или `hello-world` работают — Docker запущен. Тогда ставим Twenty **вручную** (без скрипта, чтобы не зависеть от его проверок).

**Вариант A — установка Twenty вручную (рекомендуется при ошибке скрипта):**

Если при `git clone ... .` в `/opt/twenty` появляется «Permission denied», клонируйте в домашний каталог и перенесите:

```bash
cd ~
rm -rf twenty
git clone --depth 1 https://github.com/twentyhq/twenty.git twenty
sudo rm -rf /opt/twenty
sudo mv twenty /opt/twenty
sudo chown -R aseka:aseka /opt/twenty
cd /opt/twenty/packages/twenty-docker
```

Либо, если права на `/opt/twenty` уже исправлены:

```bash
sudo mkdir -p /opt/twenty
sudo chown aseka:aseka /opt/twenty
cd /opt/twenty
git clone --depth 1 https://github.com/twentyhq/twenty.git .
cd packages/twenty-docker
```

Файл окружения для Twenty:

**Вариант 1 — скачать с GitHub** (если сервер имеет доступ в интернет):

```bash
cd /opt/twenty/packages/twenty-docker
curl -sLo .env https://raw.githubusercontent.com/twentyhq/twenty/main/packages/twenty-docker/.env.example
```

**Вариант 2 — взять из проекта VPA** (если с GitHub недоступен): в репозитории VPA есть `docs/twenty-docker.env.example`. Скопировать его на сервер в каталог Twenty и переименовать в `.env`:

```bash
# На вашем компьютере (из каталога VPA):
scp docs/twenty-docker.env.example aseka@IP_СЕРВЕРА:/opt/twenty/packages/twenty-docker/.env

# На сервере:
cd /opt/twenty/packages/twenty-docker
nano .env
```

В `.env` обязательно задать свой пароль БД и сгенерировать APP_SECRET: `openssl rand -base64 32`.

В `.env` задать (или оставить по умолчанию) и при необходимости изменить порт сервера. В `docker-compose.yml` в секции сервера (twenty-server или server) поменять порты на `"3080:3000"`:

```bash
nano docker-compose.yml
# Найти секцию с портами сервера и указать: "3080:3000"
```

Запуск:

```bash
docker compose up -d
docker compose ps
```

**Вариант B — через официальный скрипт (если Docker на сервере точно работает):**

```bash
sudo mkdir -p /opt/twenty
sudo chown aseka:aseka /opt/twenty
cd /opt/twenty
bash <(curl -sL https://raw.githubusercontent.com/twentyhq/twenty/main/packages/twenty-docker/scripts/install.sh)
```

После любого варианта в `/opt/twenty` (или в `packages/twenty-docker`) будут конфиги Twenty. Дальше — шаг 8 (порт 3080, если ещё не задан).

---

### Шаг 8. Порт и домен для Twenty (чтобы не конфликтовать с VPA на 3000)

Перейти в каталог, где лежит `docker-compose.yml` Twenty (часто `packages/twenty-docker`), и отредактировать порты и при необходимости `.env`:

```bash
cd /opt/twenty/packages/twenty-docker
# или cd /opt/twenty — смотрите, где именно лежит docker-compose.yml
nano docker-compose.yml
```

В секции сервера (server/app) изменить проброс порта на **3080**:

```yaml
ports:
  - "3080:3000"
```

Сохранить и выйти. При необходимости в том же каталоге создать/править `.env` по [документации Twenty](https://docs.twenty.com/developers/self-hosting/docker-compose) (например, базовый URL для фронта).

---

### Шаг 9. Запуск Twenty (СУБД и миграции поднимутся внутри контейнеров)

```bash
cd /opt/twenty/packages/twenty-docker
docker compose up -d
docker compose ps
```

Проверка: `curl -I http://127.0.0.1:3080` — должен ответить веб-сервер.

---

### Шаг 10. Первый вход в Twenty и создание API-ключа

1. В браузере открыть: `http://IP_СЕРВЕРА:3080` (или временно пробросить порт).
2. Зарегистрировать первого пользователя (админ).
3. В интерфейсе: **Settings → APIs & Webhooks → Create key**. Скопировать ключ и сохранить — он понадобится для сайта VPA.

---

### Шаг 11. Загрузка проекта VPA на сервер

**Если репозиторий GitHub пустой** (например [github.com/Roxas80/VP-](https://github.com/Roxas80/VP-)) — сначала залейте проект с вашего компьютера:

```bash
# На вашем компьютере, в каталоге VPA:
cd /путь/к/VPA
git init
git add .
git commit -m "Initial: сайт VPA + backend + docs"
git branch -M main
git remote add origin https://github.com/Roxas80/VP-.git
git push -u origin main
```

После этого на сервере можно клонировать (вариант B ниже). В репозитории будет и `docs/twenty-docker.env.example` для Twenty.

**Вариант A — с вашего компьютера по rsync/scp (без Git на сервере):**

```bash
# На вашем компьютере (не на сервере):
rsync -avz --exclude 'node_modules' --exclude '.git' ./ aseka@IP_СЕРВЕРА:/opt/vpa/
```

**Вариант B — на сервере через Git (после push в GitHub):**

```bash
sudo mkdir -p /opt/vpa
sudo chown aseka:aseka /opt/vpa
cd /opt/vpa
git clone https://github.com/Roxas80/VP-.git .
```

Проверка на сервере:

```bash
ls -la /opt/vpa/
# Должны быть: index.html, order.html, backend/, data/, docker-compose.yml, backend/db/schema.sql
```

---

### Шаг 12. Переменные окружения и пароль БД для VPA

```bash
cd /opt/vpa
cp backend/.env.example backend/.env
nano backend/.env
```

Заполнить (подставить свои значения):

```env
DATABASE_URL=postgresql://vpa:ПАРОЛЬ_БД@db:5432/vpa
PORT=3000
STATIC_DIR=/app/static

TWENTY_API_URL=https://crm.vkusnopolezno.kz
TWENTY_API_KEY=ваш_api_ключ_из_шага_10
```

Пароль БД заменить на надёжный и **тот же** указать в `docker-compose.yml` (шаг 13).

---

### Шаг 13. Пароль PostgreSQL в docker-compose VPA

```bash
nano /opt/vpa/docker-compose.yml
```

В секции `db` → `environment` задать тот же пароль, что в `backend/.env`:

```yaml
POSTGRES_USER: vpa
POSTGRES_PASSWORD: ваш_надёжный_пароль
POSTGRES_DB: vpa
```

В секции `app` → `environment` (если там жёстко прописан DATABASE_URL) подставить тот же пароль:

```yaml
DATABASE_URL: postgresql://vpa:ваш_надёжный_пароль@db:5432/vpa
```

Сохранить.

---

### Шаг 14. Запуск сайта VPA (БД создаётся, schema.sql выполнится автоматически)

```bash
cd /opt/vpa
docker compose up -d
docker compose ps
```

Проверка:

```bash
curl -I http://127.0.0.1:3000
curl -s http://127.0.0.1:3000/api/health
# Ожидается JSON с "ok": true
```

---

### Шаг 15. Конфиг Nginx для сайта VPA

Подставьте свой домен вместо `vkusnopolezno.kz`:

```bash
sudo nano /etc/nginx/sites-available/vpa
```

Вставить:

```nginx
server {
    listen 80;
    server_name vkusnopolezno.kz www.vkusnopolezno.kz;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Сохранить.

---

### Шаг 16. Конфиг Nginx для Twenty CRM

```bash
sudo nano /etc/nginx/sites-available/twenty
```

Вставить (домен заменить при необходимости):

```nginx
server {
    listen 80;
    server_name crm.vkusnopolezno.kz;
    location / {
        proxy_pass http://127.0.0.1:3080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Сохранить.

---

### Шаг 17. Включение сайтов и перезагрузка Nginx

```bash
sudo ln -sf /etc/nginx/sites-available/vpa /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/twenty /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### Шаг 18. SSL (Let's Encrypt)

Перед этим DNS для доменов должен указывать на IP сервера.

```bash
sudo certbot --nginx -d vkusnopolezno.kz -d www.vkusnopolezno.kz -d crm.vkusnopolezno.kz
```

Следовать подсказкам. После успеха сайт и CRM будут доступны по HTTPS.

---

### Шаг 19. Финальные настройки на сайте

- В файлах `/opt/vpa/script.js` и `/opt/vpa/order.js` заменить номер WhatsApp на реальный (`WHATSAPP_NUMBER` / `whatsappNumber`).
- При необходимости отредактировать `/opt/vpa/data/menu.json`.

Перезапуск приложения VPA после правок файлов (если нужно):

```bash
cd /opt/vpa
docker compose up -d --build app
```

---

## Краткая сводка

| Вопрос | Ответ |
|--------|--------|
| В какой очерёдности ставится окружение? | ОС → Docker → Nginx/Certbot → файрвол → Twenty → VPA → Nginx-конфиги → SSL. |
| Какая СУБД у сайта VPA? | PostgreSQL 16 в контейнере (наш docker-compose). |
| Какая СУБД у Twenty? | Своя PostgreSQL (и Redis) внутри Docker Twenty. Отдельно не ставится. |
| Когда загружается структура в БД VPA? | При первом запуске контейнера `db`: скрипт `backend/db/schema.sql` из `docker-entrypoint-initdb.d/`. |
| Когда загружается структура в БД Twenty? | Автоматически при первом старте контейнеров Twenty (миграции в образе). |
| Нужен ли почтовый сервер для сайта? | Нет. |
| Нужен ли почтовый сервер для Twenty? | Опционально (SMTP для писем); можно внешний сервис или позже настроить в Twenty. |

После выполнения шагов 1–19 проект VPA и CRM Twenty развёрнуты и связаны: заявки с сайта сохраняются в PostgreSQL VPA и при настроенных `TWENTY_API_URL` и `TWENTY_API_KEY` попадают в Twenty как контакты/заказы.
