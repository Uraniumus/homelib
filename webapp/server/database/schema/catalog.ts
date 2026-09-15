import { sql } from 'drizzle-orm'
import {
  char,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
} from 'drizzle-orm/pg-core'
import { createdAt, fk, pk, timestamps } from './_shared'
import { users } from './users'

/**
 * Общий каталог: persons / publishers / works / editions видят все
 * пользователи, иначе одна книга заводится сто раз. Кто завёл запись —
 * в createdBy, но это авторство, а не владение.
 */

export const persons = pgTable(
  'persons',
  {
    id: pk(),
    fullName: text().notNull(),
    /** «Стругацкий, Аркадий» — для сортировки по фамилии. */
    sortName: text(),
    birthYear: smallint(),
    deathYear: smallint(),
    notes: text(),
    createdBy: fk().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  t => [index('persons_sort_name_idx').on(sql`lower(${t.sortName})`)],
)

export const publishers = pgTable('publishers', {
  id: pk(),
  name: text().notNull(),
  city: text(),
  createdBy: fk().references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
})

/** Произведение — текст как таковой, безотносительно бумаги. */
export const works = pgTable(
  'works',
  {
    id: pk(),
    title: text().notNull(),
    /** ISO 639-3, три буквы: 'rus', 'eng'. */
    originalLanguage: char({ length: 3 }),
    firstPublished: smallint(),
    /** 'novel', 'story', 'poem' — без CHECK, справочник живёт в UI. */
    form: text(),
    notes: text(),
    createdBy: fk().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  t => [index('works_title_idx').on(sql`lower(${t.title})`)],
)

/** Авторы — на произведении. Переводчики — на издании, см. editionContributors. */
export const workContributors = pgTable(
  'work_contributors',
  {
    workId: fk()
      .notNull()
      .references(() => works.id, { onDelete: 'cascade' }),
    personId: fk()
      .notNull()
      .references(() => persons.id, { onDelete: 'restrict' }),
    role: text().notNull().default('author'),
    position: smallint().notNull().default(1),
  },
  t => [primaryKey({ columns: [t.workId, t.personId, t.role] })],
)

/** Издание — конкретная книга конкретного издателя конкретного года. */
export const editions = pgTable(
  'editions',
  {
    id: pk(),
    title: text().notNull(),
    subtitle: text(),
    publisherId: fk().references(() => publishers.id, { onDelete: 'set null' }),
    publishedYear: smallint(),
    language: char({ length: 3 }),
    format: text(),
    pages: integer(),
    printRun: integer(),
    series: text(),
    volume: text(),
    /** Каноническая обложка, общая для всех. Фото экземпляра — copyPhotos. */
    coverPath: text(),
    notes: text(),
    createdBy: fk().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
    /**
     * Нормализованный ключ для поиска дублей при заведении издания:
     * заголовок без не-буквенно-цифровых символов + год.
     * Считает Postgres, приложение только читает.
     */
    dedupeKey: text().generatedAlwaysAs(
      sql`lower(regexp_replace(title, '[^[:alnum:]]', '', 'g')) || '|' || coalesce(published_year::text, '')`,
    ),
  },
  t => [index('editions_dedupe_key_idx').on(t.dedupeKey)],
)

/**
 * Справочник типов идентификаторов. Отдельная таблица, а не enum, потому что
 * список пополняется данными (ББК, УДК, номер заказа), а не миграцией кода.
 */
export const identifierTypes = pgTable('identifier_types', {
  code: text().primaryKey(),
  name: text().notNull(),
  description: text(),
})

/**
 * ISBN живёт здесь, а не колонкой в editions: у советских изданий его нет,
 * у переизданий он совпадает, на обложках встречаются опечатки.
 * Уникальность — только внутри издания.
 */
export const editionIdentifiers = pgTable(
  'edition_identifiers',
  {
    id: pk(),
    editionId: fk()
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade' }),
    type: text()
      .notNull()
      .references(() => identifierTypes.code),
    value: text().notNull(),
    createdAt: createdAt(),
  },
  t => [
    unique('edition_identifiers_edition_id_type_value_key').on(t.editionId, t.type, t.value),
    /** Поиск по отсканированному штрихкоду идёт именно этой парой. */
    index('edition_identifiers_lookup_idx').on(t.type, t.value),
  ],
)

/**
 * Many-to-many, и это покрывает оба случая:
 * сборник (издание -> много произведений, position = порядок в оглавлении)
 * и многотомник (произведение -> много изданий, part = какая часть текста).
 */
export const editionWorks = pgTable(
  'edition_works',
  {
    editionId: fk()
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade' }),
    workId: fk()
      .notNull()
      .references(() => works.id, { onDelete: 'restrict' }),
    position: smallint().notNull().default(1),
    /** Название в оглавлении, если отличается от канонического. */
    titleInEdition: text(),
    part: text(),
    pageFrom: integer(),
  },
  t => [
    primaryKey({ columns: [t.editionId, t.workId] }),
    index('edition_works_work_idx').on(t.workId),
  ],
)

/**
 * Переводчики, иллюстраторы, редакторы — свойство издания, не текста.
 * workId опционален: в сборнике у каждой повести может быть свой переводчик.
 */
export const editionContributors = pgTable(
  'edition_contributors',
  {
    id: pk(),
    editionId: fk()
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade' }),
    personId: fk()
      .notNull()
      .references(() => persons.id, { onDelete: 'restrict' }),
    role: text().notNull(),
    workId: fk().references(() => works.id, { onDelete: 'cascade' }),
  },
  t => [index('edition_contributors_edition_idx').on(t.editionId)],
)
