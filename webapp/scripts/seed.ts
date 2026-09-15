import { sql } from 'drizzle-orm'
import { createDatabase, tables } from '../server/utils/drizzle'
import { provisionNewUser } from '../server/utils/provisioning'
import { requireDatabaseUrl } from './_env'

/**
 * Фикстуры для локальной разработки.
 *
 * Данные подобраны так, чтобы задеть неочевидные места модели, а не просто
 * налить десять строк: советское издание без ISBN, сборник (одно издание —
 * три произведения), двухтомник (одно произведение — два издания), переводчик
 * на издании при авторе на произведении, книга на руках у контакта без
 * аккаунта, скрытый экземпляр, перечитывание двумя отметками.
 *
 * Скрипт идемпотентен на уровне «запусти на чистой БД»: перед наливкой
 * чистит все таблицы. Для чистой БД с нуля: pnpm db:reset && pnpm db:migrate && pnpm db:seed
 */

const db = createDatabase(requireDatabaseUrl(), { max: 1 })

/** Чистим в обратном порядке зависимостей — RESTART IDENTITY сбрасывает счётчики. */
async function truncateAll() {
  await db.execute(sql`
    TRUNCATE TABLE
      list_items, lists,
      copy_user_tags, work_user_tags, user_tags,
      reviews, book_marks,
      loans, copy_photos, copies, locations, collections,
      edition_contributors, edition_works, edition_identifiers, editions,
      work_contributors, works, persons, publishers,
      friendships, contacts, users
    RESTART IDENTITY CASCADE
  `)
}

async function seed() {
  await truncateAll()

  // ---------- Пользователи ----------

  const [sveta, kolya] = await db
    .insert(tables.users)
    .values([
      { username: 'sveta', displayName: 'Света', email: 'sveta@example.com' },
      { username: 'kolya', displayName: 'Коля', email: 'kolya@example.com' },
    ])
    .returning()

  const svetaSetup = await provisionNewUser(db, sveta!.id, { defaultCollectionName: 'Дом' })
  await provisionNewUser(db, kolya!.id)

  await db.insert(tables.friendships).values({
    requesterId: sveta!.id,
    addresseeId: kolya!.id,
    status: 'accepted',
  })

  // Заёмщик без аккаунта — ровно тот случай, ради которого заведены contacts.
  const [mama] = await db
    .insert(tables.contacts)
    .values({ ownerId: sveta!.id, name: 'Мама', notes: 'Отдаёт медленно, но отдаёт' })
    .returning()

  // ---------- Полки ----------

  const home = svetaSetup.collection
  const [dacha] = await db
    .insert(tables.collections)
    .values({ ownerId: sveta!.id, name: 'Дача', visibility: 'friends' })
    .returning()

  const [bedroom, hallway, dachaShelf] = await db
    .insert(tables.locations)
    .values([
      { collectionId: home.id, name: 'Стеллаж в спальне, полка 2', position: 1 },
      { collectionId: home.id, name: 'Прихожая, верхняя полка', position: 2 },
      { collectionId: dacha!.id, name: 'Веранда', position: 1 },
    ])
    .returning()

  // ---------- Каталог: люди и издатели ----------

  const [strugatsky, lem, bradbury, shirokov, dostoevsky] = await db
    .insert(tables.persons)
    .values([
      { fullName: 'Аркадий Стругацкий', sortName: 'Стругацкий, Аркадий', birthYear: 1925, deathYear: 1991, createdBy: sveta!.id },
      { fullName: 'Станислав Лем', sortName: 'Лем, Станислав', birthYear: 1921, deathYear: 2006, createdBy: sveta!.id },
      { fullName: 'Рэй Брэдбери', sortName: 'Брэдбери, Рэй', birthYear: 1920, deathYear: 2012, createdBy: sveta!.id },
      { fullName: 'Дмитрий Брускин', sortName: 'Брускин, Дмитрий', notes: 'Переводчик Лема', createdBy: sveta!.id },
      { fullName: 'Фёдор Достоевский', sortName: 'Достоевский, Фёдор', birthYear: 1821, deathYear: 1881, createdBy: sveta!.id },
    ])
    .returning()

  const [detlit, mir, eksmo, nauka] = await db
    .insert(tables.publishers)
    .values([
      { name: 'Детская литература', city: 'Москва', createdBy: sveta!.id },
      { name: 'Мир', city: 'Москва', createdBy: sveta!.id },
      { name: 'Эксмо', city: 'Москва', createdBy: sveta!.id },
      { name: 'Наука', city: 'Ленинград', createdBy: sveta!.id },
    ])
    .returning()

  // ---------- Каталог: произведения ----------

  const [solaris, fahrenheit, veldt, pedestrian, smiles, karamazov, picnic] = await db
    .insert(tables.works)
    .values([
      { title: 'Солярис', originalLanguage: 'pol', firstPublished: 1961, form: 'novel', createdBy: sveta!.id },
      { title: '451 градус по Фаренгейту', originalLanguage: 'eng', firstPublished: 1953, form: 'novel', createdBy: sveta!.id },
      { title: 'Вельд', originalLanguage: 'eng', firstPublished: 1950, form: 'story', createdBy: sveta!.id },
      { title: 'Пешеход', originalLanguage: 'eng', firstPublished: 1951, form: 'story', createdBy: sveta!.id },
      { title: 'И грянул гром', originalLanguage: 'eng', firstPublished: 1952, form: 'story', createdBy: sveta!.id },
      { title: 'Братья Карамазовы', originalLanguage: 'rus', firstPublished: 1880, form: 'novel', createdBy: sveta!.id },
      // Произведение без единого издания в каталоге — так тоже бывает:
      // его можно отметить прочитанным и положить в подборку.
      { title: 'Пикник на обочине', originalLanguage: 'rus', firstPublished: 1972, form: 'novel', createdBy: sveta!.id },
    ])
    .returning()

  // Авторы — на произведении.
  await db.insert(tables.workContributors).values([
    { workId: solaris!.id, personId: lem!.id },
    { workId: fahrenheit!.id, personId: bradbury!.id },
    { workId: veldt!.id, personId: bradbury!.id },
    { workId: pedestrian!.id, personId: bradbury!.id },
    { workId: smiles!.id, personId: bradbury!.id },
    { workId: karamazov!.id, personId: dostoevsky!.id },
    { workId: picnic!.id, personId: strugatsky!.id },
  ])

  // ---------- Каталог: издания ----------

  const [solarisSoviet, bradburyOmnibus, karamazovVol1, karamazovVol2, fahrenheitModern]
    = await db
      .insert(tables.editions)
      .values([
        // Советское издание: ISBN нет вовсе, зато есть номер заказа и тираж.
        {
          title: 'Солярис',
          publisherId: mir!.id,
          publishedYear: 1976,
          language: 'rus',
          format: 'hardcover',
          pages: 288,
          printRun: 100000,
          series: 'Зарубежная фантастика',
          createdBy: sveta!.id,
        },
        // Сборник: одно издание — три рассказа, порядок в оглавлении.
        {
          title: 'Марсианские хроники и другие рассказы',
          publisherId: detlit!.id,
          publishedYear: 1987,
          language: 'rus',
          format: 'hardcover',
          pages: 416,
          printRun: 200000,
          createdBy: sveta!.id,
        },
        // Двухтомник: одно произведение — два издания, part различает части.
        {
          title: 'Братья Карамазовы. Том 1',
          publisherId: nauka!.id,
          publishedYear: 1976,
          language: 'rus',
          pages: 424,
          volume: '1',
          series: 'Литературные памятники',
          createdBy: sveta!.id,
        },
        {
          title: 'Братья Карамазовы. Том 2',
          publisherId: nauka!.id,
          publishedYear: 1976,
          language: 'rus',
          pages: 400,
          volume: '2',
          series: 'Литературные памятники',
          createdBy: sveta!.id,
        },
        {
          title: '451 градус по Фаренгейту',
          publisherId: eksmo!.id,
          publishedYear: 2019,
          language: 'rus',
          format: 'paperback',
          pages: 272,
          createdBy: sveta!.id,
        },
      ])
      .returning()

  await db.insert(tables.editionIdentifiers).values([
    // У советского издания ISBN нет — только внутренние номера.
    { editionId: solarisSoviet!.id, type: 'order_no', value: '2843' },
    { editionId: solarisSoviet!.id, type: 'bbk', value: '84.4Пол' },
    { editionId: bradburyOmnibus!.id, type: 'bbk', value: '84.7США' },
    { editionId: fahrenheitModern!.id, type: 'isbn13', value: '9785041030223' },
    { editionId: fahrenheitModern!.id, type: 'isbn10', value: '5041030227' },
    { editionId: karamazovVol1!.id, type: 'udk', value: '882' },
  ])

  await db.insert(tables.editionWorks).values([
    { editionId: solarisSoviet!.id, workId: solaris!.id, position: 1 },
    { editionId: fahrenheitModern!.id, workId: fahrenheit!.id, position: 1 },
    // Сборник: три произведения с порядком и страницами.
    { editionId: bradburyOmnibus!.id, workId: veldt!.id, position: 1, pageFrom: 5 },
    { editionId: bradburyOmnibus!.id, workId: pedestrian!.id, position: 2, pageFrom: 31 },
    { editionId: bradburyOmnibus!.id, workId: smiles!.id, position: 3, pageFrom: 44, titleInEdition: 'И грянул гром…' },
    // Двухтомник: одно произведение, две части.
    { editionId: karamazovVol1!.id, workId: karamazov!.id, position: 1, part: 'Книги I–VI' },
    { editionId: karamazovVol2!.id, workId: karamazov!.id, position: 1, part: 'Книги VII–XII, эпилог' },
  ])

  // Переводчик — на издании, не на произведении.
  await db.insert(tables.editionContributors).values([
    { editionId: solarisSoviet!.id, personId: shirokov!.id, role: 'translator', workId: solaris!.id },
  ])

  // ---------- Экземпляры ----------

  // Последние два экземпляра ниже по коду не нужны, поэтому не разбираем их.
  const [solarisCopy, omnibusCopy, karamazov1Copy, karamazov2Copy]
    = await db
      .insert(tables.copies)
      .values([
        {
          editionId: solarisSoviet!.id,
          collectionId: home.id,
          locationId: bedroom!.id,
          condition: 'good',
          acquiredAt: '2019-06-14',
          acquiredFrom: 'Букинист на Арбате',
          notes: 'Штамп школьной библиотеки на форзаце',
        },
        { editionId: bradburyOmnibus!.id, collectionId: home.id, locationId: bedroom!.id, condition: 'fair', acquiredFrom: 'От бабушки' },
        { editionId: karamazovVol1!.id, collectionId: home.id, locationId: hallway!.id, condition: 'good' },
        { editionId: karamazovVol2!.id, collectionId: home.id, locationId: hallway!.id, condition: 'good' },
        { editionId: fahrenheitModern!.id, collectionId: dacha!.id, locationId: dachaShelf!.id, condition: 'new', acquiredAt: '2024-03-02' },
        // Скрытый: не виден никому, кроме владельца, даже во «friends»-коллекции.
        { editionId: fahrenheitModern!.id, collectionId: dacha!.id, locationId: dachaShelf!.id, isHidden: true, notes: 'Подарок, пока сюрприз' },
      ])
      .returning()

  await db.insert(tables.copyPhotos).values([
    { copyId: solarisCopy!.id, storageKey: '00000000-0000-4000-8000-000000000001', caption: 'Корешок', position: 1 },
    { copyId: solarisCopy!.id, storageKey: '00000000-0000-4000-8000-000000000002', caption: 'Штамп на форзаце', position: 2 },
  ])

  // ---------- Аренды ----------

  await db.insert(tables.loans).values([
    // На руках у контакта без аккаунта, бессрочно.
    { copyId: omnibusCopy!.id, borrowerContactId: mama!.id, lentAt: '2025-11-02', notes: 'Обещала к Новому году' },
    // На руках у зарегистрированного друга, со сроком.
    { copyId: karamazov1Copy!.id, borrowerUserId: kolya!.id, lentAt: '2026-01-15', dueAt: '2026-03-15' },
    // Уже вернулась — активной арендой не считается, частичный индекс её не видит.
    { copyId: solarisCopy!.id, borrowerUserId: kolya!.id, lentAt: '2025-04-01', returnedAt: '2025-05-20' },
  ])

  // ---------- Теги ----------

  const [scifi, classics, toGiveAway] = await db
    .insert(tables.userTags)
    .values([
      { ownerId: sveta!.id, name: 'фантастика', kind: 'genre' },
      { ownerId: sveta!.id, name: 'классика', kind: 'genre' },
      { ownerId: sveta!.id, name: 'отдать в библиотеку', kind: 'custom' },
    ])
    .returning()

  // Жанр — свойство текста.
  await db.insert(tables.workUserTags).values([
    { tagId: scifi!.id, workId: solaris!.id },
    { tagId: scifi!.id, workId: fahrenheit!.id },
    { tagId: scifi!.id, workId: veldt!.id },
    { tagId: classics!.id, workId: karamazov!.id },
  ])

  // «Отдать» — свойство конкретной бумаги.
  await db.insert(tables.copyUserTags).values([
    { tagId: toGiveAway!.id, copyId: karamazov2Copy!.id },
  ])

  // ---------- Дневник ----------

  await db.insert(tables.bookMarks).values([
    // Перечитывание: две строки, актуальный статус — последняя по createdAt.
    { userId: sveta!.id, workId: solaris!.id, editionId: solarisSoviet!.id, status: 'read', visibility: 'friends', startedAt: '2019-07-01', finishedAt: '2019-07-12', rating: 9 },
    { userId: sveta!.id, workId: solaris!.id, status: 'reading', visibility: 'private', startedAt: '2026-08-20' },
    { userId: sveta!.id, workId: karamazov!.id, status: 'abandoned', visibility: 'private', startedAt: '2024-01-05' },
    // Отметка про книгу, которой нет в коллекции — так и задумано.
    { userId: kolya!.id, workId: fahrenheit!.id, status: 'want_to_read', visibility: 'public' },
  ])

  await db.insert(tables.reviews).values([
    { userId: sveta!.id, workId: solaris!.id, editionId: solarisSoviet!.id, body: 'Перевод Брускина сильно лучше позднего. И бумага приятная.', visibility: 'public' },
    { userId: sveta!.id, workId: karamazov!.id, body: 'Пока не мой темп. Вернусь через пару лет.', visibility: 'private' },
    { userId: kolya!.id, workId: solaris!.id, body: 'Океан как персонаж — до сих пор ничего лучше не читал.', visibility: 'friends' },
  ])

  // ---------- Подборки ----------

  await db.insert(tables.listItems).values([
    // Системная «Хочу купить» — элемент-произведение: издание неважно.
    { listId: svetaSetup.wantToBuy.id, workId: pedestrian!.id, position: 1, note: 'Найти отдельным изданием' },
    // Элемент-издание: важна именно эта серия.
    { listId: svetaSetup.wantToBuy.id, editionId: karamazovVol2!.id, position: 2, note: 'Второй том в том же оформлении' },
  ])

  const [shareable] = await db
    .insert(tables.lists)
    .values({
      ownerId: sveta!.id,
      name: 'С чего начать фантастику',
      description: 'Подборка для тех, кто спрашивает',
      visibility: 'public',
    })
    .returning()

  await db.insert(tables.listItems).values([
    { listId: shareable!.id, workId: solaris!.id, position: 1, note: 'Начинать отсюда' },
    { listId: shareable!.id, workId: fahrenheit!.id, position: 2 },
    { listId: shareable!.id, workId: veldt!.id, position: 3, note: 'Если длинное не заходит' },
    { listId: shareable!.id, workId: picnic!.id, position: 4 },
  ])

  console.log([
    'Фикстуры налиты:',
    '  пользователи: sveta, kolya (друзья)',
    '  каталог: 7 произведений, 5 изданий (в т.ч. советское без ISBN, сборник, двухтомник)',
    '  полки: Дом (2 локации), Дача (1 локация)',
    '  экземпляры: 6, из них 1 скрытый; 2 активные аренды + 1 возвращённая',
    '  дневник: 4 отметки (включая перечитывание), 3 отзыва',
    '  подборки: «Хочу купить» (системная) и публичная «С чего начать фантастику»',
  ].join('\n'))
}

try {
  await seed()
}
finally {
  await db.$client.end()
}
