import { bigint, timestamp } from 'drizzle-orm/pg-core'

/**
 * Общие кирпичики колонок. Имена колонок в БД не указываем: в drizzle.config.ts
 * и в клиенте включён `casing: 'snake_case'`, поэтому `createdAt` -> `created_at`.
 */

/** `bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` */
export const pk = () => bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey()

/** `bigint` под внешний ключ — тот же тип, что у pk, но без identity. */
export const fk = () => bigint({ mode: 'number' })

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()

/** Обновляется триггером `touch_updated_at()`, не приложением. */
export const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()

/** Обе колонки времени разом. */
export const timestamps = {
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}

/** Видимость: одинаковая у коллекций, подборок, отметок и отзывов. */
export const VISIBILITY = ['public', 'friends', 'private'] as const
export type Visibility = (typeof VISIBILITY)[number]

export const FRIENDSHIP_STATUS = ['pending', 'accepted', 'blocked'] as const
export type FriendshipStatus = (typeof FRIENDSHIP_STATUS)[number]

export const READING_STATUS = ['want_to_read', 'reading', 'read', 'abandoned'] as const
export type ReadingStatus = (typeof READING_STATUS)[number]

export const TAG_KIND = ['genre', 'custom'] as const
export type TagKind = (typeof TAG_KIND)[number]

/** Роли вкладчиков. Схема не ограничивает их CHECK-ом — это просто подсказка. */
export const WORK_ROLE = ['author', 'co_author', 'compiler'] as const
export const EDITION_ROLE = ['translator', 'illustrator', 'editor', 'afterword'] as const

/** Системные подборки, которые приложение ищет по slug. */
export const SYSTEM_LIST_SLUGS = { wantToBuy: 'want-to-buy' } as const

/** Хелпер для CHECK IN (...) — собирает `col IN ('a', 'b')`. */
export const inList = (values: readonly string[]) =>
  values.map(v => `'${v}'`).join(', ')
