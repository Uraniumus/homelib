import { existsSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach } from 'vitest'
import { createDatabase } from '../../server/utils/drizzle'

if (existsSync('.env')) process.loadEnvFile('.env')

/**
 * Клиент на всю жизнь процесса. Схему уже накатил globalSetup,
 * здесь остаётся только чистить данные между тестами.
 */
export const testDb = createDatabase(process.env.TEST_DATABASE_URL!, { max: 1 })

/**
 * Чистка через TRUNCATE ... CASCADE вместо транзакции с откатом: роуты
 * внутри себя открывают свои транзакции, и вложенность бы всё запутала.
 * На пустых таблицах TRUNCATE стоит доли миллисекунды.
 *
 * identifier_types не трогаем — это справочник из миграции, а не данные.
 */
export async function truncateAll() {
  await testDb.execute(sql`
    TRUNCATE TABLE
      list_items, lists,
      copy_user_tags, work_user_tags, user_tags,
      reviews, book_marks,
      loans, copy_photos, copies, locations, collections,
      edition_contributors, edition_works, edition_identifiers, editions,
      work_contributors, works, persons, publishers,
      friendships, contacts, users
    RESTART IDENTITY CASCADE
  `)
}

beforeEach(truncateAll)

afterAll(async () => {
  await testDb.$client.end()
})
