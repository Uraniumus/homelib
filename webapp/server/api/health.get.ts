import { sql } from 'drizzle-orm'

/**
 * Проверка живости для healthcheck в docker-compose и для «оно вообще
 * поднялось?» в браузере. Ходит в БД, потому что приложение без БД
 * бесполезно, и «ok» без этой проверки врал бы.
 */
export default defineEventHandler(async () => {
  const startedAt = performance.now()

  try {
    await useDrizzle().execute(sql`select 1`)
  }
  catch (error) {
    throw createError({
      statusCode: 503,
      message: 'База недоступна',
      data: { reason: error instanceof Error ? error.message : String(error) },
    })
  }

  return {
    status: 'ok' as const,
    database: 'ok' as const,
    latencyMs: Math.round(performance.now() - startedAt),
  }
})
