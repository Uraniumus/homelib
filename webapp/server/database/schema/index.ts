/**
 * Схема БД — источник истины по модели данных.
 * Правишь здесь -> `pnpm db:generate` -> `pnpm db:migrate`.
 * Руками SQL в server/database/migrations/ не пишем, кроме нумерованных
 * custom-миграций (триггеры, справочники) — их drizzle-kit не генерирует.
 */
export * from './_shared'
export * from './users'
export * from './catalog'
export * from './collections'
export * from './loans'
export * from './tags'
export * from './lists'
export * from './diary'
export * from './relations'
