import { existsSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Один раз на весь прогон: пересоздать схему в тестовой БД и накатить
 * миграции. Значит, тесты всегда видят ровно ту схему, что в репозитории,
 * и падение миграции — тоже упавший тест.
 */
export async function setup() {
  if (existsSync('.env')) process.loadEnvFile('.env')

  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL не задан.\n'
      + 'Скопируй .env.example в .env и подними тестовую БД:\n'
      + '  docker compose up -d postgres-test',
    )
  }

  const client = postgres(url, { max: 1, onnotice: () => {} })

  try {
    await client`select 1`
  }
  catch (error) {
    throw new Error(
      `Тестовая БД недоступна по ${url}\n`
      + 'Подними её: docker compose up -d postgres-test\n'
      + `Ошибка: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    )
  }

  // Дропаем схему целиком: так тесты не зависят от того, что осталось
  // от прошлого прогона или от недокатанной миграции.
  //
  // Схему drizzle сносим вместе с public, и это обязательно: в ней лежит
  // журнал __drizzle_migrations. Если оставить его, migrate() решит, что всё
  // уже применено, и вернёт пустую БД — тесты упадут все разом на TRUNCATE.
  await client.unsafe(
    'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
  )
  await migrate(drizzle(client), { migrationsFolder: './server/database/migrations' })
  await client.end()
}
