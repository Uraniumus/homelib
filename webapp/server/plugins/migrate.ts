import { migrate } from 'drizzle-orm/postgres-js/migrator'

/**
 * На проде миграции применяются при старте контейнера: на одном VPS с одной
 * репликой это надёжнее, чем помнить про отдельную команду после деплоя.
 * Локально выключено — там миграции гоняются руками через `pnpm db:migrate`,
 * иначе dev-сервер будет дёргать их на каждом перезапуске.
 */
export default defineNitroPlugin(async () => {
  if (process.env.RUN_MIGRATIONS !== 'true') return

  const db = useDrizzle()
  await migrate(db, { migrationsFolder: './server/database/migrations' })
  console.log('[migrate] миграции применены')
})
