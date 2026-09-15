import { tables } from '../../server/utils/drizzle'
import { provisionNewUser } from '../../server/utils/provisioning'
import { testDb } from '../setup/database'

/**
 * Фабрики для тестов: создают валидную строку с осмысленными значениями
 * по умолчанию, чтобы в тесте оставалось только то, что он проверяет.
 *
 *   const { user, collection } = await makeUser()
 *   const copy = await makeCopy({ collectionId: collection.id })
 *
 * Все поля перекрываются через overrides. Все функции возвращают строку
 * целиком, включая сгенерированный id.
 */

/**
 * Счётчик уникальности. Не сбрасывается между тестами намеренно: TRUNCATE
 * обнуляет id, а имена должны оставаться разными, иначе UNIQUE-индексы
 * поймают тест на ровном месте.
 */
let counter = 0
const uniq = () => ++counter

type Insert<T extends { $inferInsert: unknown }> = T['$inferInsert']

export async function makeUser(overrides: Partial<Insert<typeof tables.users>> = {}) {
  const n = uniq()
  const [user] = await testDb
    .insert(tables.users)
    .values({
      username: `user${n}`,
      displayName: `Пользователь ${n}`,
      email: `user${n}@example.test`,
      ...overrides,
    })
    .returning()
  return user!
}

/** Пользователь ровно в том состоянии, в каком он появляется после регистрации. */
export async function makeProvisionedUser(overrides: Partial<Insert<typeof tables.users>> = {}) {
  const user = await makeUser(overrides)
  const { collection, wantToBuy } = await provisionNewUser(testDb, user.id)
  return { user, collection, wantToBuy }
}

export async function makeContact(
  ownerId: number,
  overrides: Partial<Insert<typeof tables.contacts>> = {},
) {
  const [contact] = await testDb
    .insert(tables.contacts)
    .values({ ownerId, name: `Контакт ${uniq()}`, ...overrides })
    .returning()
  return contact!
}

export async function makePerson(overrides: Partial<Insert<typeof tables.persons>> = {}) {
  const n = uniq()
  const [person] = await testDb
    .insert(tables.persons)
    .values({ fullName: `Автор ${n}`, sortName: `Автор, ${n}`, ...overrides })
    .returning()
  return person!
}

export async function makePublisher(overrides: Partial<Insert<typeof tables.publishers>> = {}) {
  const [publisher] = await testDb
    .insert(tables.publishers)
    .values({ name: `Издательство ${uniq()}`, ...overrides })
    .returning()
  return publisher!
}

export async function makeWork(overrides: Partial<Insert<typeof tables.works>> = {}) {
  const [work] = await testDb
    .insert(tables.works)
    .values({
      title: `Произведение ${uniq()}`,
      originalLanguage: 'rus',
      form: 'novel',
      ...overrides,
    })
    .returning()
  return work!
}

export async function makeEdition(overrides: Partial<Insert<typeof tables.editions>> = {}) {
  const [edition] = await testDb
    .insert(tables.editions)
    .values({
      title: `Издание ${uniq()}`,
      publishedYear: 1980,
      language: 'rus',
      ...overrides,
    })
    .returning()
  return edition!
}

/** Издание + связанное произведение, когда важен весь слой каталога. */
export async function makeCatalogedEdition(options: {
  workOverrides?: Partial<Insert<typeof tables.works>>
  editionOverrides?: Partial<Insert<typeof tables.editions>>
  authorId?: number
} = {}) {
  const work = await makeWork(options.workOverrides)
  const edition = await makeEdition(options.editionOverrides)

  await testDb.insert(tables.editionWorks).values({ editionId: edition.id, workId: work.id })

  if (options.authorId) {
    await testDb
      .insert(tables.workContributors)
      .values({ workId: work.id, personId: options.authorId, role: 'author' })
  }

  return { work, edition }
}

export async function makeCollection(
  ownerId: number,
  overrides: Partial<Insert<typeof tables.collections>> = {},
) {
  const [collection] = await testDb
    .insert(tables.collections)
    .values({ ownerId, name: `Коллекция ${uniq()}`, ...overrides })
    .returning()
  return collection!
}

export async function makeLocation(
  collectionId: number,
  overrides: Partial<Insert<typeof tables.locations>> = {},
) {
  const [location] = await testDb
    .insert(tables.locations)
    .values({ collectionId, name: `Полка ${uniq()}`, ...overrides })
    .returning()
  return location!
}

/**
 * Экземпляр. Издание и коллекция создаются сами, если не переданы, —
 * тесту про аренду не должно быть дела до каталога.
 */
export async function makeCopy(overrides: Partial<Insert<typeof tables.copies>> = {}) {
  const editionId = overrides.editionId ?? (await makeEdition()).id
  const collectionId = overrides.collectionId ?? (await makeCollection((await makeUser()).id)).id

  const [copy] = await testDb
    .insert(tables.copies)
    .values({ ...overrides, editionId, collectionId })
    .returning()
  return copy!
}

export async function makeLoan(
  copyId: number,
  overrides: Partial<Insert<typeof tables.loans>> = {},
) {
  // Заёмщик обязан быть ровно один — если не задан, заводим контакт.
  const hasBorrower = overrides.borrowerUserId != null || overrides.borrowerContactId != null
  const borrower = hasBorrower
    ? {}
    : { borrowerContactId: (await makeContact((await makeUser()).id)).id }

  const [loan] = await testDb
    .insert(tables.loans)
    .values({ copyId, lentAt: '2026-01-01', ...borrower, ...overrides })
    .returning()
  return loan!
}

export async function makeTag(
  ownerId: number,
  overrides: Partial<Insert<typeof tables.userTags>> = {},
) {
  const [tag] = await testDb
    .insert(tables.userTags)
    .values({ ownerId, name: `тег-${uniq()}`, kind: 'custom', ...overrides })
    .returning()
  return tag!
}

export async function makeList(
  ownerId: number,
  overrides: Partial<Insert<typeof tables.lists>> = {},
) {
  const [list] = await testDb
    .insert(tables.lists)
    .values({ ownerId, name: `Подборка ${uniq()}`, ...overrides })
    .returning()
  return list!
}

/**
 * Готовая библиотека одного пользователя: он сам, коллекция с полкой,
 * произведение, издание и экземпляр на этой полке. Точка входа для
 * большинства тестов на роуты.
 */
export async function makeLibrary() {
  const { user, collection, wantToBuy } = await makeProvisionedUser()
  const location = await makeLocation(collection.id)
  const author = await makePerson()
  const { work, edition } = await makeCatalogedEdition({ authorId: author.id })
  const copy = await makeCopy({
    editionId: edition.id,
    collectionId: collection.id,
    locationId: location.id,
  })

  return { user, collection, location, author, work, edition, copy, wantToBuy }
}
