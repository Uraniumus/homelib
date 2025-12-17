# Homelib

Приложение состоит из FastAPI-бэкенда (`backend/`) и фронтенда на Vue + Vite (`webapp/`). Ниже — инструкции по запуску обоих сервисов локально.

## Требования
- Python 3.10+ и [Poetry](https://python-poetry.org/)
- Node.js 20.19+ (или 22.12+) и [pnpm](https://pnpm.io/) / Corepack

## Бэкенд (FastAPI)
1. Установите зависимости:
   ```bash
   cd backend
   poetry install
   ```
2. Запустите сервер (по умолчанию порт `8000`):
   ```bash
   poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
3. API будет доступно по `http://localhost:8000/api` (эндпоинты `/health`, `/books`).

## Фронтенд (Vue + Vite)
1. Установите зависимости:
   ```bash
   cd webapp
   pnpm install
   ```
2. При необходимости укажите адрес API (по умолчанию используется `http://localhost:8000/api`; переопределить можно через `.env.local`):
   ```bash
   # .env.local
   VITE_API_BASE=http://localhost:8000/api
   ```
3. Запустите дев-сервер:
   ```bash
   pnpm dev -- --host
   ```
4. Откройте `http://localhost:5173` в браузере. Фронтенд будет проксировать запросы к указанному API.

Бэкенд и фронтенд запускаются независимо; главное — держать их работающими одновременно, чтобы UI мог общаться с API.
