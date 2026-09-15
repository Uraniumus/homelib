import { existsSync } from 'node:fs'

/** Скрипты запускаются через tsx вне Nuxt, поэтому .env читаем руками. */
export function loadEnv(file = '.env') {
  if (existsSync(file)) process.loadEnvFile(file)
}

export function requireDatabaseUrl(variable = 'DATABASE_URL'): string {
  loadEnv()
  const url = process.env[variable]
  if (!url) {
    console.error(`${variable} не задан. Скопируй .env.example в .env и поправь строку подключения.`)
    process.exit(1)
  }
  return url
}
