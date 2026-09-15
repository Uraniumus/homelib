import { sql } from 'drizzle-orm'
import { check, index, pgTable, primaryKey, text, unique } from 'drizzle-orm/pg-core'
import {
  TAG_KIND,
  type TagKind,
  createdAt,
  fk,
  inList,
  pk,
  timestamps,
} from './_shared'
import { works } from './catalog'
import { copies } from './collections'
import { users } from './users'

/**
 * Один пул тегов на пользователя и две связи, потому что теги вешаются на
 * разные сущности: жанр — свойство текста, «утилизировать» — свойство бумаги.
 *
 * Почему таблица, а не jsonb: по тегам фильтруют, группируют и их
 * переименовывают. На всех трёх операциях json-массив проигрывает.
 */
export const userTags = pgTable(
  'user_tags',
  {
    id: pk(),
    ownerId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** Только для группировки в UI, на логику не влияет. */
    kind: text().$type<TagKind>(),
    ...timestamps,
  },
  t => [
    unique('user_tags_owner_id_name_key').on(t.ownerId, t.name),
    check('user_tags_kind_check', sql`${t.kind} IN (${sql.raw(inList(TAG_KIND))})`),
  ],
)

/** Теги на произведениях: жанры, «любимое». */
export const workUserTags = pgTable(
  'work_user_tags',
  {
    tagId: fk()
      .notNull()
      .references(() => userTags.id, { onDelete: 'cascade' }),
    workId: fk()
      .notNull()
      .references(() => works.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  t => [
    primaryKey({ columns: [t.tagId, t.workId] }),
    index('work_user_tags_work_idx').on(t.workId),
  ],
)

/** Теги на экземплярах: «отдать в библиотеку», «утилизировать». */
export const copyUserTags = pgTable(
  'copy_user_tags',
  {
    tagId: fk()
      .notNull()
      .references(() => userTags.id, { onDelete: 'cascade' }),
    copyId: fk()
      .notNull()
      .references(() => copies.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  t => [
    primaryKey({ columns: [t.tagId, t.copyId] }),
    index('copy_user_tags_copy_idx').on(t.copyId),
  ],
)
