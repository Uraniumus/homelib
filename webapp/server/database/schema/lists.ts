import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import {
  VISIBILITY,
  type Visibility,
  createdAt,
  fk,
  inList,
  pk,
  timestamps,
} from './_shared'
import { editions, works } from './catalog'
import { users } from './users'

/** Шарибельная подборка. Видна другим людям — отсюда ограничение на элементы. */
export const lists = pgTable(
  'lists',
  {
    id: pk(),
    ownerId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    /** Заполнен у системных подборок ('want-to-buy'), чтобы находить их кодом. */
    slug: text(),
    visibility: text().$type<Visibility>().notNull().default('private'),
    ...timestamps,
  },
  t => [
    unique('lists_owner_id_name_key').on(t.ownerId, t.name),
    unique('lists_owner_id_slug_key').on(t.ownerId, t.slug),
    check('lists_visibility_check', sql`${t.visibility} IN (${sql.raw(inList(VISIBILITY))})`),
  ],
)

/**
 * Элемент — произведение ИЛИ издание, но никогда не экземпляр:
 * подборку видят другие люди, а чужой copyId для них бессмыслен.
 */
export const listItems = pgTable(
  'list_items',
  {
    id: pk(),
    listId: fk()
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    workId: fk().references(() => works.id, { onDelete: 'cascade' }),
    editionId: fk().references(() => editions.id, { onDelete: 'cascade' }),
    position: integer().notNull().default(1),
    /** Комментарий к пункту: «после Соляриса». */
    note: text(),
    createdAt: createdAt(),
  },
  t => [
    check('list_items_one_target_check', sql`num_nonnulls(${t.workId}, ${t.editionId}) = 1`),
    uniqueIndex('list_items_work_uniq_idx')
      .on(t.listId, t.workId)
      .where(sql`${t.workId} IS NOT NULL`),
    uniqueIndex('list_items_edition_uniq_idx')
      .on(t.listId, t.editionId)
      .where(sql`${t.editionId} IS NOT NULL`),
  ],
)
