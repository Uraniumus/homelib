import { sql } from 'drizzle-orm'
import { check, date, index, pgTable, smallint, text } from 'drizzle-orm/pg-core'
import {
  READING_STATUS,
  VISIBILITY,
  type ReadingStatus,
  type Visibility,
  fk,
  inList,
  pk,
  timestamps,
} from './_shared'
import { editions, works } from './catalog'
import { users } from './users'

/**
 * Отметка «хочу / читаю / прочитано / брошено».
 *
 * У отметок нет «текущего статуса» колонкой: перечитывание — это ещё одна
 * строка, а актуальный статус — последняя по createdAt. Поэтому здесь нет
 * уникального индекса на (userId, workId).
 *
 * workId обязателен, editionId опционален: отмечают текст, но иногда важно,
 * в каком именно издании читали.
 */
export const bookMarks = pgTable(
  'book_marks',
  {
    id: pk(),
    userId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workId: fk()
      .notNull()
      .references(() => works.id, { onDelete: 'cascade' }),
    editionId: fk().references(() => editions.id, { onDelete: 'set null' }),
    status: text().$type<ReadingStatus>().notNull(),
    visibility: text().$type<Visibility>().notNull().default('private'),
    startedAt: date(),
    finishedAt: date(),
    rating: smallint(),
    ...timestamps,
  },
  t => [
    check('book_marks_status_check', sql`${t.status} IN (${sql.raw(inList(READING_STATUS))})`),
    check('book_marks_visibility_check', sql`${t.visibility} IN (${sql.raw(inList(VISIBILITY))})`),
    check('book_marks_rating_check', sql`${t.rating} BETWEEN 1 AND 10`),
    index('book_marks_user_idx').on(t.userId, t.workId),
    index('book_marks_work_idx').on(t.workId),
  ],
)

/**
 * Отзыв концептуально про произведение; издание уточняется, когда речь
 * про конкретный перевод или качество печати.
 * Дата отзыва — это createdAt, отдельного поля нет.
 */
export const reviews = pgTable(
  'reviews',
  {
    id: pk(),
    userId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workId: fk()
      .notNull()
      .references(() => works.id, { onDelete: 'cascade' }),
    editionId: fk().references(() => editions.id, { onDelete: 'set null' }),
    body: text().notNull(),
    visibility: text().$type<Visibility>().notNull().default('private'),
    ...timestamps,
  },
  t => [
    check('reviews_visibility_check', sql`${t.visibility} IN (${sql.raw(inList(VISIBILITY))})`),
    index('reviews_work_idx').on(t.workId),
    index('reviews_user_idx').on(t.userId),
  ],
)
