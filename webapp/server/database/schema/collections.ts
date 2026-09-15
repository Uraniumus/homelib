import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  smallint,
  text,
  unique,
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
import { editions } from './catalog'
import { users } from './users'

/**
 * Коллекция — физическое место («дом», «дача»), экземпляр лежит ровно в одной.
 * Тематические подборки — это lists, не коллекции.
 */
export const collections = pgTable(
  'collections',
  {
    id: pk(),
    ownerId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    visibility: text().$type<Visibility>().notNull().default('private'),
    ...timestamps,
  },
  t => [
    unique('collections_owner_id_name_key').on(t.ownerId, t.name),
    check('collections_visibility_check', sql`${t.visibility} IN (${sql.raw(inList(VISIBILITY))})`),
  ],
)

/** Справочник полок внутри коллекции — выпадающий список в UI. */
export const locations = pgTable(
  'locations',
  {
    id: pk(),
    collectionId: fk()
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    /** 'стеллаж в спальне, полка 2' */
    name: text().notNull(),
    position: smallint().notNull().default(1),
    ...timestamps,
  },
  t => [unique('locations_collection_id_name_key').on(t.collectionId, t.name)],
)

/**
 * Физический экземпляр на полке.
 *
 * ВАЖНО: FK на locations не гарантирует, что полка принадлежит той же
 * коллекции, что и экземпляр. Это на совести приложения — проверяй в роутах,
 * которые ставят или меняют locationId (см. assertLocationInCollection).
 */
export const copies = pgTable(
  'copies',
  {
    id: pk(),
    editionId: fk()
      .notNull()
      .references(() => editions.id, { onDelete: 'restrict' }),
    collectionId: fk()
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    locationId: fk().references(() => locations.id, { onDelete: 'set null' }),
    condition: text(),
    acquiredAt: date(),
    acquiredFrom: text(),
    /**
     * Скрытый экземпляр видит только владелец. Фильтруется ДО проверки
     * visibility коллекции. Выдавать в аренду скрытую книгу можно.
     */
    isHidden: boolean().notNull().default(false),
    notes: text(),
    ...timestamps,
  },
  t => [
    index('copies_edition_idx').on(t.editionId),
    index('copies_collection_idx').on(t.collectionId),
  ],
)

/**
 * Фото экземпляра: корешок, автограф, дарственная.
 * storageKey — ключ объекта в S3 (uuid, генерирует приложение);
 * хранилище не знает про доменные id, БД остаётся источником истины.
 */
export const copyPhotos = pgTable(
  'copy_photos',
  {
    id: pk(),
    copyId: fk()
      .notNull()
      .references(() => copies.id, { onDelete: 'cascade' }),
    storageKey: text().notNull(),
    caption: text(),
    position: smallint().notNull().default(1),
    createdAt: createdAt(),
  },
  t => [index('copy_photos_copy_idx').on(t.copyId)],
)
