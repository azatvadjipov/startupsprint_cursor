# Стартап-спринт — Telegram Mini App

Полноценный учебный продукт для запуска стартап-спринта внутри Telegram Mini App. Проект включает клиентскую часть (уроки для студентов) и админку, REST API c проверкой подписки в платном канале и файловую базу данных.

## Стек

- **Frontend**: React 19 + TypeScript, Vite, react-router-dom, mobile-first UI без тяжёлых UI-библиотек.
- **Backend**: Node.js + Express + TypeScript, файловая БД (JSON), проверка подписки через Telegram Bot API.
- **Организация**: npm workspaces (`backend/`, `frontend/`), единый набор скриптов в корне репозитория.

## Структура

```
.
├── backend/            # Express API + data store
│   ├── data/db.json    # Персистентное хранилище
│   └── src/...         # Код API, сервисы, роуты
├── frontend/           # React-приложение (клиент + админка)
│   └── src/pages/...   # /app и /admin
├── env.example         # Образец переменных окружения
└── package.json        # Скрипты и workspaces
```

## Быстрый старт

```bash
git clone https://github.com/azatvadjipov/startupsprint_cursor.git
cd startupsprint_cursor
cp env.example .env            # при необходимости скорректируйте пути
npm install
npm run dev                    # параллельный запуск backend + frontend
```

- Фронтенд: http://localhost:5173 (Telegram Mini App + админка `/admin`)
- Бэкенд: http://localhost:4000 (`/api/...`)

## Переменные окружения

Создайте `.env` на основе `env.example`.

### Backend

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_BOT_TOKEN` | токен бота для Bot API |
| `TELEGRAM_CHANNEL_ID` | ID платного канала (например `@channel`) |
| `ADMIN_PASSWORD` | пароль входа в админку |
| `ADMIN_JWT_SECRET` | секрет для подписания админ-сессий (по умолчанию `startupsprint-secret`) |
| `PORT` | порт Express (по умолчанию `4000`) |
| `CLIENT_ORIGIN` | список origin'ов фронтенда через запятую. Например `http://localhost:5173,https://startupsprint.vercel.app`. На Vercel дополнительные системные домены добавятся автоматически. |
| `DATA_DIR` | (опционально) путь до папки для файловой БД. На Vercel укажите `/tmp/startupsprint-data`, иначе Lambda не сможет писать файлы. |

### Frontend (Vite)

| Переменная | Описание |
|------------|----------|
| `VITE_API_URL` | URL бэкенда (`http://localhost:4000` в dev) |
| `VITE_MOCK_TELEGRAM_ID` | запасной telegramId для локальной разработки, если WebApp не доступен |

> ⚠️ В проде обязательно подписывайте и валидируйте `initData` Telegram WebApp на сервере.

## Основные скрипты

| Команда | Что делает |
|---------|------------|
| `npm run dev` | параллельный запуск `backend` (ts-node-dev) и `frontend` (Vite) |
| `npm run build` | `frontend:build` + `backend:tsc` |
| `npm run start` | запуск прод-сборки backend + отдача собранного фронта из `frontend/dist` |

## API (кратко)

Публичные (используются клиентом):

- `POST /api/auth/telegram` — первичная авторизация по telegramId, проверка подписки, выдача программы и прогресса.
- `GET /api/programs/active?userId=...` — активная программа и уроки.
- `GET /api/progress?userId=...` — актуальный прогресс.
- `POST /api/lessons/:lessonId/start|complete` — фиксация начала/завершения урока, открытие следующего.
- `POST /api/restart-program` — сброс прогресса (сценарий «Спринт сгорел»).
- `GET /api/check-membership?telegramId=...` — принудительная проверка подписки через Bot API.

Админка (`/api/admin/*`, cookie-сессия):

- `POST /login`, `POST /logout`
- CRUD программ и уроков (`/programs`, `/programs/:id/lessons`, `/lessons/:id`, `/lessons/:id/move`)
- `GET/PUT /upsell` — глобальный апселл для бесплатных пользователей
- `GET /stats` — базовая статистика (пользователи, платные, завершившие, «сгоревшие»)

## Файловая база

Все данные хранятся в `backend/data/db.json`. При первом запуске файл подсеивается стартовой программой и апселлом. Если нужно начать заново — удалите файл, сервис создаст новый. Для боевых нагрузок рекомендуется перенести сущности в полнофункциональную БД (например, Supabase).

## Тестирование и сборка

```bash
npm run dev    # запуск в режиме разработки
npm run build  # production build (vite + tsc)
npm run start  # запуск production-сборки (Express раздаёт /frontend/dist)
```

## Деплой на Vercel

> ℹ️ В корне репозитория лежит `vercel.json`, поэтому Vercel больше не ищет дефолтную папку `public`.  
> Сборка запускает `npm run build`, а готовый фронтенд берётся из `frontend/dist`. Если проект в Vercel был создан раньше, убедитесь, что в Settings → Build & Output `Output Directory` пуст или совпадает с `frontend/dist`.

Есть два варианта:

1. **Единый Node-сервер (рекомендуется для простоты)**  
   - В Settings проекта выберите `Framework Preset: Other`.  
   - Install command: `npm install`  
   - Build command: `npm run build`  
   - Output directory можно оставить пустым: backend сам раздаёт `frontend/dist`.  
   - Start command: `npm run start` (Vercel запустит Node-сервер).  
   - Пропишите все backend и frontend переменные окружения в разделе **Environment Variables**.

   > Vercel запускает Node-приложения как serverless-функции. Если нужен холодный старт <100 мс, вынесите Express в `api/server.ts` и экспортируйте handler через `@vercel/node`. Текущая сборка «из коробки» лучше подходит для Vercel Hobby с включённым `Node.js Server` (Build Output API).

2. **Разнести фронт и бэк**  
   - Фронтенд: создайте отдельный проект, в настройках Vercel укажите `Root Directory = frontend`, Build command `npm run build`, Output `dist`.  
   - Бэкенд: задеплойте Express на Render / Railway / Fly.io или на отдельный Vercel-проект (см. выше), пропишите публичный URL в `VITE_API_URL`.  
   - Telegram Mini App должен использовать URL фронтенда, указанный в Vercel.

## Подключение Supabase

Проект по умолчанию использует JSON-файл. Чтобы перенести хранилище в Supabase:

1. Создайте проект Supabase, выпишите `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`.  
2. Заведите таблицы `programs`, `lessons`, `users`, `user_program_progress`, `user_lesson_progress`, `upsell_settings` по тем же полям, что и в `types.ts`.  
3. Добавьте в backend клиент Supabase (`@supabase/postgrest-js` или `@supabase/supabase-js`) и вынесите доступ к данным в отдельный репозиторий (например, `supabaseRepository.ts`).  
4. Замените функции чтения/записи из `db.ts` на запросы в Supabase. Основная бизнес-логика (`programService`) останется прежней.  
5. Для прод-окружения пропишите новые ENV (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), а `VITE_API_URL` укажите на домен backend.  
6. Для realtime-проверок можно подключить Supabase Triggers (например, чтобы инвалидировать прогресс при изменении уроков).

## Telegram Mini App

- Клиент берёт `telegramId` из `window.Telegram.WebApp.initDataUnsafe`.  
- В dev-режиме можно заменить ID на `VITE_MOCK_TELEGRAM_ID`.  
- На сервере обязательно реализуйте проверку подписи initData перед выдачей данных (оставлен комментарий в коде).

## Полезно знать

- Все UI-тексты на русском, дизайн заточен под мобильный WebView.  
- Уроки поддерживают тайминги (delay + expires) и FOMO-логику; при «сгорании» программа помечается как `FAILED`.  
- Апселл (заголовок/текст/кнопка) редактируется в админке и используется при попытке открыть платный урок бесплатником.  
- Логи Bot API не сохраняются — при недоступности API пользователь считается бесплатным и получает понятное сообщение.

## Лицензия

Проект открыт в учебных целях. Вы можете дополнять и адаптировать его под свои задачи, но не забывайте проверить требования Telegram Mini Apps перед прод-запуском.


