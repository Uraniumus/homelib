import { sql } from 'drizzle-orm'
import { check, date, index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { fk, pk, timestamps } from './_shared'
import { copies } from './collections'
import { contacts, users } from './users'

/**
 * Аренда сама себе лог: не флаг на экземпляре, а строка на каждую передачу.
 *   dueAt IS NULL      — отдано бессрочно
 *   returnedAt IS NULL — ещё на руках
 * Частичный уникальный индекс не даёт завести две активные аренды экземпляра.
 */
export const loans = pgTable(
  'loans',
  {
    id: pk(),
    copyId: fk()
      .notNull()
      .references(() => copies.id, { onDelete: 'cascade' }),
    /** Ровно один из двух заёмщиков — гарантирует CHECK ниже. */
    borrowerUserId: fk().references(() => users.id, { onDelete: 'set null' }),
    borrowerContactId: fk().references(() => contacts.id, { onDelete: 'set null' }),
    lentAt: date().notNull().default(sql`current_date`),
    dueAt: date(),
    returnedAt: date(),
    notes: text(),
    ...timestamps,
  },
  t => [
    check(
      'loans_one_borrower_check',
      sql`num_nonnulls(${t.borrowerUserId}, ${t.borrowerContactId}) = 1`,
    ),
    check('loans_returned_after_lent_check', sql`${t.returnedAt} IS NULL OR ${t.returnedAt} >= ${t.lentAt}`),
    uniqueIndex('loans_one_active_idx')
      .on(t.copyId)
      .where(sql`${t.returnedAt} IS NULL`),
    index('loans_copy_idx').on(t.copyId),
  ],
)
