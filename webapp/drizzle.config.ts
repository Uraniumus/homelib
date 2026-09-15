import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit запускается вне Nuxt, поэтому .env читаем сами.
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema/index.ts',
  out: './server/database/migrations',
  // TS пишем в camelCase, в БД колонки в snake_case.
  // Тот же casing выставлен в server/utils/drizzle.ts — их нельзя расцеплять.
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://homelib:homelib@localhost:5432/homelib',
  },
  strict: true,
  verbose: true,
})
