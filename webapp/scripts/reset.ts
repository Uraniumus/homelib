import postgres from 'postgres'
import { requireDatabaseUrl } from './_env'

/**
 * Сносит схему public целиком и создаёт заново. Дальше нужен `pnpm db:migrate`.
 * Отказывается работать против чего-либо, кроме локальной БД, — чтобы
 * случайный запуск с прод-строкой в окружении не стёр библиотеку.
 */
const url = requireDatabaseUrl()
const host = new URL(url).hostname

if (!['localhost', '127.0.0.1', 'postgres', 'postgres-test', 'db'].includes(host)) {
  console.error(`Отказываюсь дропать схему на хосте "${host}". Это не локальная БД.`)
  process.exit(1)
}

const client = postgres(url, { max: 1, onnotice: () => {} })

try {
  // Схему drizzle сносим вместе с public: в ней журнал __drizzle_migrations.
  // Без этого db:migrate после db:reset решит, что всё уже применено,
  // и оставит пустую базу.
  await client.unsafe(
    'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
  )
  console.log(`Схема public на ${host} пересоздана. Дальше: pnpm db:migrate && pnpm db:seed`)
}
finally {
  await client.end()
}
