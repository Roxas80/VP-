# Vkusno Polezno Astana

Telegram бот + Landing page для заказа ПП тортов и десертов в Астане.

## Структура проекта

```
.
├── bot/                      # Telegram Bot
│   ├── bot_v2_fixed.py       # Основной бот
│   ├── extra_functions.py    # Доп. функции
│   └── requirements.txt        # Зависимости Python
│
├── website/                    # Landing Page
│   ├── index.html             # Главная
│   ├── css/                   # Стили
│   ├── js/                    # Скрипты
│   └── assets/                # Картинки, шрифты
│
├── data/                       # Данные (общие)
│   ├── products.json          # Товары
│   ├── config.json            # Конфигурация
│   └── orders.json            # Заказы
│
├── shared/                     # Общие компоненты
│   └── styles/                # Общие стили
│
├── .github/workflows/          # CI/CD
│   ├── deploy-bot.yml         # Деплой бота
│   └── deploy-site.yml        # Деплой сайта
│
├── docker-compose.yml          # Docker оркестрация
├── Dockerfile.bot             # Docker бота
├── Dockerfile.site            # Docker сайта
└── README.md
```

## Компоненты

### 1. Telegram Bot (@vkusno_polezno_bot)
- Каталог товаров
- Корзина
- Оплата (Kaspi, Halyk, Freedom, Cash)
- Доставка с зонами
- Уведомления кондитеру

### 2. Landing Page
- Описание продукции
- Цены и меню
- Контакты
- Ссылка на бота

## Deploy

### Бот (VPS + Docker)
```bash
docker-compose up -d bot
```

### Сайт (GitHub Pages / Vercel / Netlify)
Автодеплой при push в main.

## Локальная разработка

### Бот
```bash
cd bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python bot_v2_fixed.py
```

### Сайт
```bash
cd website
python3 -m http.server 8080
```

## CI/CD

- **Push в `main`** → Автодеплой бота на VPS
- **Push в `main`** → Автодеплой сайта на GitHub Pages
