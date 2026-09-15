import { drizzle } from 'drizzle-orm/postgres-js'
import { createError } from 'h3'
import postgres from 'postgres'
import * as schema from '../database/schema'

export { schema }
/** `tables.copies`, `tables.editions` — короче, чем импортировать каждую таблицу. */
export const tables = schema

export type Database = ReturnType<typeof createDatabase>

/**
 * Единственное место, где создаётся клиент. Здесь же задан `casing:
 * 'snake_case'` — он обязан совпадать с drizzle.config.ts, иначе запросы
 * поедут в колонки, которых нет. Поэтому свой drizzle() нигде больше не зовём.
 *
 * Принимает и строку подключения, и готовый клиент postgres — второе нужно
 * тестам, которые гоняют всё в одной транзакции.
 */
export function createDatabase(
  connection: string | postgres.Sql,
  options: postgres.Options<Record<string, never>> = {},
) {
  const client = typeof connection === 'string'
    // Пул небольшой: у Postgres по умолчанию 100 коннектов на всех.
    ? postgres(connection, { max: 10, ...options })
    : connection

  return drizzle(client, { schema, casing: 'snake_case' })
}

let instance: Database | undefined

/**
 * Синглтон для серверных роутов, автоимпортируется в server/**.
 * Скрипты и тесты живут вне Nitro и поднимают клиент через createDatabase().
 *
 *   const db = useDrizzle()
 *   const rows = await db.select().from(tables.works).limit(10)
 */
export function useDrizzle(): Database {
  if (!instance) {
    const url = useRuntimeConfig().databaseUrl
    if (!url) {
      throw createError({
        statusCode: 500,
        message: 'DATABASE_URL не задан — проверь .env',
      })
    }
    instance = createDatabase(url)
  }
  return instance
}
