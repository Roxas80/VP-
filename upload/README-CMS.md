# Decap CMS — настройка GitHub OAuth

Decap CMS работает на `/admin-cms/`. Авторизация — через **GitHub OAuth** (никаких токенов вручную). Для этого нужен бесплатный OAuth-прокси.

## Самый простой путь — Netlify (бесплатно, 5 минут)

1. Зарегистрируйтесь на [netlify.com](https://app.netlify.com/) (можно через GitHub).
2. **Создайте OAuth-приложение в GitHub:**
   - Откройте https://github.com/settings/developers → **New OAuth App**
   - Application name: `Vkusno Polezno CMS`
   - Homepage URL: `https://roxas80.github.io/VP-/`
   - Authorization callback URL: `https://api.netlify.com/auth/done`
   - Зарегистрируйте, скопируйте **Client ID** и сгенерируйте **Client Secret**.
3. **Подключите приложение к Netlify:**
   - В Netlify откройте: User settings → Applications → **OAuth → Install provider**
   - Выберите GitHub, вставьте Client ID и Client Secret.
4. Готово. Заходите на `https://roxas80.github.io/VP-/admin-cms/` → кнопка **Login with GitHub** → разрешаете доступ → правите контент.

## Альтернатива — свой Cloudflare Worker

Если не хотите Netlify, можно поднять свой OAuth-прокси на Cloudflare Workers (тоже бесплатно). Готовый туториал: https://github.com/sterlingwes/decap-cloudflare-oauth

После настройки замените в `admin-cms/config.yml`:
```yaml
base_url: https://api.netlify.com
```
на адрес вашего Worker.

## Кто может входить?

GitHub OAuth даёт доступ только тем, у кого есть **права на запись в репозиторий** `Roxas80/VP-`. Чтобы добавить редактора:

1. GitHub → ваш репозиторий → Settings → Collaborators → Add people.
2. Пригласите по email/логину как Collaborator.
3. После принятия приглашения они смогут логиниться в `/admin-cms/`.

## Что лучше — самописная админка или Decap?

| | Самописная (`/admin.html`) | Decap CMS (`/admin-cms/`) |
|---|---|---|
| Вход | Email + пароль | GitHub OAuth |
| Безопасность | Зависит от пароля | На уровне GitHub-аккаунта |
| Загрузка картинок | Только URL | Drag & drop |
| Кастомизация | Полная | Конфиг YAML |
| Аудит изменений | Один автор коммитов | Каждый коммит подписан автором |

Можете использовать обе одновременно — они правят одни и те же `data/*.json`.
