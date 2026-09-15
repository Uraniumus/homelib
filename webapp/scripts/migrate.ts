import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { requireDatabaseUrl } from './_env'

const url = requireDatabaseUrl()

// max: 1 — миграции должны идти одним соединением по порядку.
// onnotice — глушим NOTICE вида «schema "drizzle" already exists»:
// на повторном запуске это норма, а в выводе они выглядят как авария.
const client = postgres(url, { max: 1, onnotice: () => {} })

try {
  await migrate(drizzle(client), { migrationsFolder: './server/database/migrations' })
  console.log('Миграции применены.')
}
finally {
  await client.end()
}
