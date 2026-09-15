import { sql } from 'drizzle-orm'
import { check, pgTable, primaryKey, text, unique } from 'drizzle-orm/pg-core'
import {
  FRIENDSHIP_STATUS,
  type FriendshipStatus,
  fk,
  inList,
  pk,
  timestamps,
} from './_shared'

export const users = pgTable('users', {
  id: pk(),
  username: text().notNull().unique(),
  displayName: text(),
  email: text().unique(),
  ...timestamps,
})

/**
 * Незарегистрированный получатель книги («мама», «дядя Коля»).
 * Если контакт позже завёл аккаунт — проставляется linkedUserId,
 * но история аренд остаётся привязанной к контакту.
 */
export const contacts = pgTable(
  'contacts',
  {
    id: pk(),
    ownerId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    linkedUserId: fk().references(() => users.id, { onDelete: 'set null' }),
    notes: text(),
    ...timestamps,
  },
  t => [unique('contacts_owner_id_name_key').on(t.ownerId, t.name)],
)

/**
 * Дружба — одна строка на пару. Кто позвал, видно по requesterId;
 * «друзья» для проверки видимости — status = 'accepted' в любую сторону,
 * поэтому запросы всегда смотрят на обе колонки.
 */
export const friendships = pgTable(
  'friendships',
  {
    requesterId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text().$type<FriendshipStatus>().notNull().default('pending'),
    ...timestamps,
  },
  t => [
    primaryKey({ columns: [t.requesterId, t.addresseeId] }),
    check('friendships_status_check', sql`${t.status} IN (${sql.raw(inList(FRIENDSHIP_STATUS))})`),
    check('friendships_not_self_check', sql`${t.requesterId} <> ${t.addresseeId}`),
  ],
)
