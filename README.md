# Домашняя библиотека

Multi-user веб-приложение для учёта личной библиотеки: каталог книг с точной
моделью изданий, экземпляры на полках, выдача «в аренду», читательский дневник
и шарибельные подборки.

Продуктовый контекст и обоснование архитектурных решений — в [context.md](context.md).
Модель данных — в [library_schema.sql](library_schema.sql), она же портирована
в Drizzle: [webapp/server/database/schema/](webapp/server/database/schema/).

## Стек

| Слой | Чем |
|---|---|
| Фронт и бэк | Nuxt 4 (Vue 3 + Nitro в одной кодовой базе) |
| UI | Nuxt UI 4 поверх Tailwind |
| БД | PostgreSQL 17, Drizzle ORM |
| Сессии | nuxt-auth-utils |
| Фото | S3-совместимое хранилище, загрузка через presigned PUT |
| Тесты | Vitest (unit / server / nuxt) |
| Прод | docker compose: Nuxt + Postgres + Caddy на одном VPS |

Всё приложение живёт в [webapp/](webapp/); в корне только то, что нужно для
разворачивания.

## Быстрый старт

Нужны Node 22.12+ (проверено на 24.12), pnpm 10 и Docker.

```bash
# 1. Инфраструктура: postgres, тестовый postgres и MinIO
docker compose up -d

# 2. Зависимости и окружение
cd webapp
pnpm install
cp .env.example .env          # NUXT_SESSION_PASSWORD: openssl rand -base64 32

# 3. Схема и фикстуры
pnpm db:migrate
pnpm db:seed

# 4. Дев-сервер
pnpm dev                      # http://localhost:3000
```

MinIO поднимается вместе с остальным: API на `:9000`, консоль на
`:9001` (логин `homelib`, пароль `homelib-secret`), бакет `homelib`
создаётся автоматически.

## Команды

Все — из `webapp/`.

| Команда | Что делает |
|---|---|
| `pnpm dev` | Дев-сервер с HMR |
| `pnpm build` / `pnpm preview` | Прод-сборка и её локальный запуск |
| `pnpm typecheck` | `vue-tsc` по всем проектам, включая скрипты и тесты |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm db:generate` | Собрать миграцию из диффа схемы |
| `pnpm db:migrate` | Накатить миграции |
| `pnpm db:seed` | Залить фикстуры (перед этим чистит все таблицы) |
| `pnpm db:reset` | Дропнуть схемы public и drizzle целиком (только локально) |
| `pnpm db:studio` | Drizzle Studio — смотреть данные в браузере |
| `pnpm test` | Все тесты |
| `pnpm test:unit` | Только быстрые, без БД |
| `pnpm test:server` | Только те, что ходят в Postgres |
| `pnpm test:nuxt` | Только компонентные |

## Как устроен код

```
webapp/
  app/                    ← фронт (Nuxt 4 держит клиентский код здесь)
    pages/                  файловый роутинг: pages/books/[id].vue → /books/:id
    components/             автоимпортируются, префикса не нужно
    layouts/
    assets/css/main.css     Tailwind + Nuxt UI
  server/                 ← бэк (Nitro)
    api/                    файловый роутинг: api/books.get.ts → GET /api/books
    utils/                  автоимпортируются в server/**
      drizzle.ts              useDrizzle(), tables, createDatabase()
      auth.ts                 requireUser(), getOptionalUser()
      validation.ts           parseBody(), parseQuery(), общие zod-схемы
      collections.ts          assertLocationInCollection()
      provisioning.ts         что заводится новому пользователю
    database/
      schema/                 ИСТОЧНИК ИСТИНЫ по схеме
      migrations/             сгенерированный SQL, руками не править
    plugins/migrate.ts      миграции при старте контейнера на проде
  scripts/                ← migrate / seed / reset, гоняются через tsx
  tests/
    unit/                   без БД
    server/                 с настоящим Postgres
    nuxt/                   компоненты
    factories/              makeUser(), makeCopy(), makeLibrary()
    setup/                  подготовка тестовой БД
```

### Схема БД

Правишь TypeScript в `server/database/schema/`, потом:

```bash
pnpm db:generate    # drizzle-kit собирает SQL из диффа
pnpm db:migrate     # накатывает
```

Два места, о которых легко забыть:

- **Триггеры и справочники drizzle-kit не видит.** Он генерирует только DDL
  таблиц. Функция `touch_updated_at()`, триггеры на неё и строки
  `identifier_types` живут в ручной миграции
  `0001_touch_updated_at_and_identifier_types.sql`. Заведёшь новую таблицу с
  `updated_at` — нужна новая ручная миграция с тем же DO-блоком. Тест
  `tests/server/schema-invariants.test.ts` ловит такой пропуск и говорит,
  какой таблице не хватает триггера.
- **`casing: 'snake_case'`** выставлен в двух местах: `drizzle.config.ts` и
  `server/utils/drizzle.ts`. Из-за него в TS колонки в camelCase, а в БД — в
  snake_case, и имена колонок в схеме можно не указывать. Расцепить эти два
  места нельзя: запросы поедут в колонки, которых нет. Поэтому клиент создаётся
  только через `createDatabase()`, свой `drizzle()` нигде не зовём.

### Первый серверный роут

```ts
// server/api/copies/index.post.ts
import { z } from 'zod'

const body = z.object({
  editionId: schemas.id,
  collectionId: schemas.id,
  locationId: schemas.id.optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)          // 401, если не залогинен
  const input = await parseBody(event, body)     // 422 со списком полей
  const db = useDrizzle()

  // FK не гарантирует, что полка из той же коллекции — проверяем сами
  await assertLocationInCollection(db, input.locationId, input.collectionId)

  const [copy] = await db.insert(tables.copies).values(input).returning()
  return copy
})
```

`requireUser`, `parseBody`, `useDrizzle`, `tables`, `schemas` и
`assertLocationInCollection` автоимпортируются — импортировать их не нужно.

### Тесты

`tests/server/` работают с настоящим Postgres на `:5433`. Схема пересоздаётся
один раз на прогон, данные чистятся `TRUNCATE` перед каждым тестом, поэтому
тесты не зависят друг от друга и от порядка запуска.

```ts
import { makeLibrary } from '../factories'
import { testDb } from '../setup/database'

it('не даёт выдать один экземпляр дважды', async () => {
  const { copy, user } = await makeLibrary()   // юзер + коллекция + полка + книга
  await testDb.insert(tables.loans).values({ copyId: copy.id, borrowerUserId: user.id })
  // ...
})
```

Фабрики в `tests/factories/` создают валидную строку с осмысленными
значениями по умолчанию: в тесте пишешь только то, что он проверяет.

Проверять нарушение констрейнта надо через `expectViolation` из
`tests/helpers/db-errors.ts`, а не через `rejects.toThrow(/имя/)`: drizzle
заворачивает ошибку драйвера в `DrizzleQueryError`, у которого в `message`
лежит только текст запроса. Имя констрейнта — в `cause`.

```ts
await expectViolation(
  testDb.insert(tables.loans).values({ copyId: copy.id, borrowerUserId: other.id }),
  'loans_one_active_idx',
)
```

## Деплой

Один VPS, три контейнера: Nuxt, Postgres и Caddy. Caddy сам получает и
продлевает сертификат Let's Encrypt.

```bash
# На сервере
git clone <repo> homelib && cd homelib
cp webapp/.env.example .env      # .env кладём рядом с docker-compose.prod.yml

# Обязательно заполнить:
#   POSTGRES_PASSWORD       — придумать длинный
#   NUXT_SESSION_PASSWORD   — openssl rand -base64 32
#   DOMAIN                  — A-запись должна уже смотреть сюда
#   ACME_EMAIL              — для уведомлений Let's Encrypt
#   S3_*                    — реквизиты объектного хранилища

docker compose -f docker-compose.prod.yml up -d --build
```

Миграции накатываются при старте контейнера (`RUN_MIGRATIONS=true`,
см. `server/plugins/migrate.ts`) — отдельной командой после деплоя ничего
делать не надо.

Обновление:

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

Порт Postgres наружу не открыт: до базы ходит только контейнер приложения по
внутренней сети.

### Бэкапы

Свой `pg_dump` по крону в объектное хранилище (класс Cold) — платный бэкап
провайдера дороже самого сервера и не переживает смерть провайдера.
Ещё не настроено, см. «Что дальше».

## Что дальше

Каркас готов; следующее — по [context.md](context.md):

1. Первый вертикальный срез: «отсканировала штрихкод → книга на полке».
   Первый роут и первый компонент делаются вместе как образец паттернов.
2. Регистрация и вход (`nuxt-auth-utils` подключён, роутов ещё нет).
3. Загрузка фото: presigned PUT + сжатие до ~300 КБ и жёсткий отказ на >10 МБ,
   счётчик фото на экземпляр. Лимиты уже лежат в `runtimeConfig.limits`.
4. PWA-манифест и офлайн-кэш.
5. Скрипт бэкапа и алерт на биллинг.
