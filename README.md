# Home Library

A multi-user web app for keeping track of a personal book collection: a catalogue
with a precise model of editions, physical copies on shelves, lending books out,
a reading diary, and shareable lists.

Product context and the reasoning behind the architectural decisions live in
[context.md](context.md). The data model is [library_schema.sql](library_schema.sql),
ported to Drizzle in [webapp/server/database/schema/](webapp/server/database/schema/).

> Both of those documents, and the comments throughout the code, are in Russian.

## Stack

| Layer | What |
|---|---|
| Front and back | Nuxt 4 (Vue 3 + Nitro in one codebase) |
| UI | Nuxt UI 4 on top of Tailwind |
| Database | PostgreSQL 17, Drizzle ORM |
| Sessions | nuxt-auth-utils |
| Photos | S3-compatible storage, uploaded via presigned PUT |
| Tests | Vitest (unit / server / nuxt) |
| Production | docker compose: Nuxt + Postgres + Caddy on a single VPS |

The whole app lives in [webapp/](webapp/); the repository root holds only what
is needed to deploy it.

## Quick start

You need Node 22.12+ (tested on 24.12), pnpm 10, and Docker.

```bash
# 1. Infrastructure: postgres, a test postgres, and MinIO
docker compose up -d

# 2. Dependencies and environment
cd webapp
pnpm install
cp .env.example .env          # NUXT_SESSION_PASSWORD: openssl rand -base64 32

# 3. Schema and fixtures
pnpm db:migrate
pnpm db:seed

# 4. Dev server
pnpm dev                      # http://localhost:3000
```

MinIO comes up with everything else: API on `:9000`, console on `:9001`
(login `homelib`, password `homelib-secret`). The `homelib` bucket is created
automatically.

## Commands

All of them run from `webapp/`.

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with HMR |
| `pnpm build` / `pnpm preview` | Production build and running it locally |
| `pnpm typecheck` | `vue-tsc` across every project, scripts and tests included |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm db:generate` | Build a migration from the schema diff |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Load fixtures (truncates every table first) |
| `pnpm db:reset` | Drop the `public` and `drizzle` schemas entirely (local only) |
| `pnpm db:studio` | Drizzle Studio — browse the data |
| `pnpm test` | Every test |
| `pnpm test:unit` | Only the fast ones, no database |
| `pnpm test:server` | Only the ones that talk to Postgres |
| `pnpm test:nuxt` | Only component tests |

## How the code is laid out

```
webapp/
  app/                    ← front end (Nuxt 4 keeps client code here)
    pages/                  file-based routing: pages/books/[id].vue → /books/:id
    components/             auto-imported, no prefix needed
    layouts/
    assets/css/main.css     Tailwind + Nuxt UI
  server/                 ← back end (Nitro)
    api/                    file-based routing: api/books.get.ts → GET /api/books
    utils/                  auto-imported across server/**
      drizzle.ts              useDrizzle(), tables, createDatabase()
      auth.ts                 requireUser(), getOptionalUser()
      validation.ts           parseBody(), parseQuery(), shared zod schemas
      collections.ts          assertLocationInCollection()
      provisioning.ts         what a newly registered user gets
    database/
      schema/                 SOURCE OF TRUTH for the schema
      migrations/             generated SQL, never edited by hand
    plugins/migrate.ts      runs migrations on container start in production
  scripts/                ← migrate / seed / reset, run through tsx
  tests/
    unit/                   no database
    server/                 against a real Postgres
    nuxt/                   components
    factories/              makeUser(), makeCopy(), makeLibrary()
    setup/                  test database preparation
```

### The database schema

Edit the TypeScript in `server/database/schema/`, then:

```bash
pnpm db:generate    # drizzle-kit builds the SQL from the diff
pnpm db:migrate     # applies it
```

Two things that are easy to forget:

- **drizzle-kit cannot see triggers or reference data.** It only generates table
  DDL. The `touch_updated_at()` function, the triggers that use it, and the
  `identifier_types` rows live in the hand-written migration
  `0001_touch_updated_at_and_identifier_types.sql`. Add a new table with an
  `updated_at` column and you need another hand-written migration with the same
  DO block. `tests/server/schema-invariants.test.ts` catches that omission and
  names the table that is missing its trigger.
- **`casing: 'snake_case'`** is set in two places: `drizzle.config.ts` and
  `server/utils/drizzle.ts`. It is what lets columns be camelCase in TypeScript
  and snake_case in the database without naming them twice. The two settings
  cannot drift apart — queries would start addressing columns that do not
  exist. That is why the client is only ever built through `createDatabase()`,
  and `drizzle()` is never called anywhere else.

### Your first server route

```ts
// server/api/copies/index.post.ts
import { z } from 'zod'

const body = z.object({
  editionId: schemas.id,
  collectionId: schemas.id,
  locationId: schemas.id.optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)          // 401 when not signed in
  const input = await parseBody(event, body)     // 422 with the offending fields
  const db = useDrizzle()

  // The FK does not guarantee the shelf belongs to the same collection —
  // that check is ours to make
  await assertLocationInCollection(db, input.locationId, input.collectionId)

  const [copy] = await db.insert(tables.copies).values(input).returning()
  return copy
})
```

`requireUser`, `parseBody`, `useDrizzle`, `tables`, `schemas`, and
`assertLocationInCollection` are auto-imported — no import statement needed.

### Tests

`tests/server/` run against a real Postgres on `:5433`. The schema is recreated
once per run and the data is wiped with `TRUNCATE` before each test, so no test
depends on another or on the order they run in.

```ts
import { makeLibrary } from '../factories'
import { testDb } from '../setup/database'

it('refuses to lend the same copy twice', async () => {
  const { copy, user } = await makeLibrary()   // user + collection + shelf + book
  await testDb.insert(tables.loans).values({ copyId: copy.id, borrowerUserId: user.id })
  // ...
})
```

The factories in `tests/factories/` build a valid row with sensible defaults, so
a test only spells out what it is actually checking.

Assert constraint violations with `expectViolation` from
`tests/helpers/db-errors.ts` rather than `rejects.toThrow(/name/)`: Drizzle wraps
the driver error in a `DrizzleQueryError` whose `message` holds only the query
text. The constraint name is in `cause`.

```ts
await expectViolation(
  testDb.insert(tables.loans).values({ copyId: copy.id, borrowerUserId: other.id }),
  'loans_one_active_idx',
)
```

## Deployment

One VPS, three containers: Nuxt, Postgres, and Caddy. Caddy obtains and renews
the Let's Encrypt certificate on its own.

```bash
# On the server
git clone <repo> homelib && cd homelib
cp webapp/.env.example .env      # .env goes next to docker-compose.prod.yml

# Must be filled in:
#   POSTGRES_PASSWORD       — make it long
#   NUXT_SESSION_PASSWORD   — openssl rand -base64 32
#   DOMAIN                  — its A record must already point here
#   ACME_EMAIL              — for Let's Encrypt notifications
#   S3_*                    — object storage credentials

docker compose -f docker-compose.prod.yml up -d --build
```

Migrations are applied when the container starts (`RUN_MIGRATIONS=true`, see
`server/plugins/migrate.ts`), so there is no separate command to remember after
a deploy.

To update:

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

The Postgres port is not exposed: only the app container reaches the database,
over the internal network.

### Backups

A home-grown `pg_dump` on cron into object storage (Cold tier) — a hosting
provider's managed backup costs more than the server itself and does not survive
the provider going away. Not set up yet; see stage 8 of the roadmap.

## Roadmap

Progress is measured in screens, where **a screen is a page with a route** under
`app/pages/`. Modals, forms, and filters inside a page do not count separately,
and the server routes behind a screen are part of that screen. The pace is
5 screens per week.

Not everything is measured in screens. The barcode scanner, photo uploads, and
the cross-cutting visibility rules barely add pages but eat the time of several.
Those are listed on their own line below, with weeks budgeted for them.

### Stage 1. First slice: "scan a barcode → book on a shelf" — week 1

The scenario that makes people start using the product.

| Screen | What it does |
|---|---|
| `/register`, `/login` | Session-based sign-up and sign-in |
| `/` | My shelf: a list of copies |
| `/scan` | ISBN barcode scanner |
| `/books/new` | Create an edition and a copy |

Beyond the screens: sessions on `nuxt-auth-utils`, calling `provisionNewUser()`
at registration, looking up a scanned ISBN in `edition_identifiers`.

The first route and the first component are built together as a reference for
the patterns, so this week has slack in it; the pace evens out afterwards.

**Done when:** you can create an account, scan a book, and see it on your shelf.

### Stage 2. MVP: a shelf worth using — weeks 2–3

| Screen | What it does |
|---|---|
| `/copies/[id]` | Copy detail |
| `/copies/[id]/edit` | Condition, shelf, notes |
| `/collections` | List of collections |
| `/collections/[id]` | A collection with filters |
| `/collections/[id]/locations` | Managing shelves |
| `/search` | Catalogue search |
| `/editions/[id]` | Edition detail |
| `/editions/[id]/edit` | Edition, identifiers, contents, translators |
| `/works/[id]` | Work detail |
| `/works/[id]/edit` | Work and its authors |

Beyond the screens: entering a book **without an ISBN** by hand — Soviet editions
never make it into the catalogue otherwise — and deduplicating on `dedupe_key`
when an edition is created.

The nastiest screen here is `/editions/[id]/edit`: it is where `edition_works`
lives, meaning both anthologies (one edition → many works) and multi-volume sets
(one work → many editions). Budget more for it than it looks like it needs.

**Done when:** any book on the shelf can be entered, found, and edited —
including a Soviet edition with no ISBN and an anthology. From this point the
product is usable every day; everything after is expansion.

### Stage 3. Photos — week 4

| Screen | What it does |
|---|---|
| `/copies/[id]/photos` | Copy photos: spine, autograph, inscription |
| — | Edition cover, inside `/editions/[id]/edit` |

Few screens, but the week goes entirely: presigned PUT that bypasses the app
server, client-side compression to ~300 KB, a hard refusal above 10 MB, and a
per-copy photo counter. The limits already sit in `runtimeConfig.limits`.

**Done when:** a photo uploads from a phone and does not eat the storage budget.

### Stage 4. Lending — week 5

| Screen | What it does |
|---|---|
| `/loans` | Who has what, and what you borrowed |
| `/loans/new` | Lend a copy out |
| `/contacts` | Borrowers without an account |
| `/contacts/[id]` | A contact and their lending history |

A partial unique index prevents lending the same copy twice, and a CHECK
prevents naming two borrowers at once; both are already covered by tests.

**Done when:** you can see who has a book and since when.

### Stage 5. Reading diary — week 6

| Screen | What it does |
|---|---|
| `/diary` | Marks: want to read / reading / read / abandoned |
| `/diary/[id]` | A mark: dates, rating, visibility |
| `/reviews/new` | Write a review |
| `/reviews/[id]` | A review — the first page people share by link |
| `/reviews/[id]/edit` | Edit a review |

Marks have no "current status" column: rereading is another row, and the current
status is the most recent one by `created_at`. Sort by `created_at DESC, id DESC`:
`now()` in Postgres is transaction time, so without the id tie-break the ordering
is ambiguous.

**Done when:** you can mark and comment on a book, including one you do not own.

### Stage 6. Tags and lists — week 7

| Screen | What it does |
|---|---|
| `/tags` | Tags with counts, renaming, merging |
| `/lists` | My lists |
| `/lists/new` | Create a list |
| `/lists/[id]` | A list — a shareable page |
| `/lists/[id]/edit` | Contents and ordering |

Tags attach to different things: a genre belongs to the text (`work_user_tags`),
"give away" belongs to the paper (`copy_user_tags`). The pool of tags is shared
between them.

`/lists/[id]` is what Nuxt with SSR was chosen for: it needs og tags, or a link
pasted into a messenger shows up blank.

**Done when:** a list can be sent to someone without an account and unfurls into
a proper preview.

### Stage 7. Visibility and the social side — weeks 8–9

| Screen | What it does |
|---|---|
| `/settings` | Profile, default visibility |
| `/u/[username]` | Public profile |
| `/friends` | Friends and requests |
| `/feed` | Friends' feed: reviews and marks |
| `/persons/[id]` | An author or translator |
| `/publishers/[id]` | A publisher |

Two weeks, because the real work here is cross-cutting rather than per-screen:
the `public / friends / private` rule has to behave identically across
collections, lists, marks, and reviews, and `copies.is_hidden` has to be filtered
**before** the collection's `visibility` is checked. This is the case where
writing a test per combination up front is the cheaper path.

**Done when:** a stranger sees exactly what was opened to them and not one row
more.

### Stage 8. PWA and launch — week 10

| Screen | What it does |
|---|---|
| `/about` | What this is and why |
| `/limits` | Plan and current usage |

Beyond the screens: manifest and offline cache, installing the icon on a phone,
`pg_dump` on cron into cold storage, a billing alert, and the free-tier limits on
books and photos.

**Done when:** the app installs on a phone with its own icon, and the backup
lives somewhere other than the server holding the database.

### Timeline

Counting from the week of 7 September 2026.

| Weeks | Stage | Screens | Done by |
|---|---|---|---|
| 1 | First slice | 5 | 13 Sep |
| 2–3 | **MVP: a shelf worth using** | 10 | **27 Sep** |
| 4 | Photos | 2 | 4 Oct |
| 5 | Lending | 4 | 11 Oct |
| 6 | Reading diary | 5 | 18 Oct |
| 7 | Tags and lists | 5 | 25 Oct |
| 8–9 | Visibility and the social side | 6 | 8 Nov |
| 10 | PWA and launch | 2 | **15 Nov** |

**39 screens, 10 weeks.** Usable every day from 27 September; the schema fully
covered by 15 November.

The estimate assumes the current split of work: screens and the main tests are
written by the project owner, while infrastructure, edge-case tests, and review
are the assistant's. Doing all of it alone, multiply by one and a half — every
screen carries a server route behind it, and that route rarely makes it into a
"5 screens a week" estimate.

### Schema coverage

All 24 tables are assigned to a stage, so nothing is left as "wire it up later".

| Stage | Tables |
|---|---|
| 1 | `users`, `collections`, `locations`, `copies`, `editions`, `works`, `identifier_types`, `edition_identifiers` |
| 2 | `persons`, `publishers`, `work_contributors`, `edition_contributors`, `edition_works` |
| 3 | `copy_photos` |
| 4 | `contacts`, `loans` |
| 5 | `book_marks`, `reviews` |
| 6 | `user_tags`, `work_user_tags`, `copy_user_tags`, `lists`, `list_items` |
| 7 | `friendships` |

### Out of scope

Deliberately deferred; not part of the 10 weeks:

- **A feed with likes.** For now that is a query over `reviews` and `book_marks`.
  A separate append-only `activities` table comes later, once event aggregation
  becomes the bottleneck.
- **A composite FK on `locations`.** Right now a shelf from someone else's
  collection is caught by `assertLocationInCollection()`. The airtight version,
  via `UNIQUE (collection_id, id)`, is described in a comment in the schema.
- **TWA for Google Play** — an evening's work with Bubblewrap, but only after
  the PWA.
- **An iOS wrapper via Capacitor** — last, and straight away with native push
  and camera, or it risks rejection under the minimum-functionality rule.
- **Subscriptions.** Not sold inside the iOS app — website only.
