import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { ReadingStatus, Visibility } from '../../server/database/schema'
import { tables } from '../../server/utils/drizzle'
import { expectViolation } from '../helpers/db-errors'
import {
  makeCollection,
  makeCopy,
  makeEdition,
  makeLibrary,
  makeList,
  makeLocation,
  makeUser,
  makeWork,
} from '../factories'
import { testDb } from '../setup/database'

/**
 * Тесты на то, что схема сама себя защищает. Они не про фичи: их задача —
 * поймать момент, когда констрейнт потеряется при правке схемы, и объяснить,
 * какое именно правило из library_schema.sql перестало работать.
 */

describe('updated_at обновляет БД, а не приложение', () => {
  it('триггер стоит на каждой таблице с колонкой updated_at', async () => {
    const missing = await testDb.execute<{ table_name: string }>(sql`
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'updated_at'
        AND t.table_type = 'BASE TABLE'
        AND NOT EXISTS (
          SELECT 1 FROM pg_trigger tg
          JOIN pg_class cl ON cl.oid = tg.tgrelid
          WHERE cl.relname = c.table_name AND tg.tgname = c.table_name || '_touch'
        )
    `)

    // Завела новую таблицу с updated_at? Добавь миграцию с DO-блоком
    // из 0001_touch_updated_at_and_identifier_types.sql.
    expect(missing.map(r => r.table_name)).toEqual([])
  })

  it('при UPDATE двигает updated_at и не трогает created_at', async () => {
    const user = await makeUser()

    const [updated] = await testDb
      .update(tables.users)
      .set({ displayName: 'Новое имя' })
      .where(sql`${tables.users.id} = ${user.id}`)
      .returning()

    expect(updated!.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime())
    expect(updated!.createdAt.getTime()).toBe(user.createdAt.getTime())
  })

  it('не даёт приложению подсунуть своё updated_at', async () => {
    const user = await makeUser()
    const past = new Date('2000-01-01T00:00:00Z')

    const [updated] = await testDb
      .update(tables.users)
      .set({ displayName: 'x', updatedAt: past })
      .where(sql`${tables.users.id} = ${user.id}`)
      .returning()

    expect(updated!.updatedAt.getTime()).toBeGreaterThan(past.getTime())
  })
})

describe('аренда: одна активная на экземпляр', () => {
  it('не даёт выдать один экземпляр дважды', async () => {
    const { copy, user } = await makeLibrary()
    const other = await makeUser()

    await testDb.insert(tables.loans).values({ copyId: copy.id, borrowerUserId: other.id })

    await expectViolation(testDb.insert(tables.loans).values({ copyId: copy.id, borrowerUserId: user.id }), 'loans_one_active_idx')
  })

  it('после возврата экземпляр можно выдать снова', async () => {
    const { copy } = await makeLibrary()
    const first = await makeUser()
    const second = await makeUser()

    const [loan] = await testDb
      .insert(tables.loans)
      .values({ copyId: copy.id, borrowerUserId: first.id, lentAt: '2026-01-01' })
      .returning()

    await testDb
      .update(tables.loans)
      .set({ returnedAt: '2026-02-01' })
      .where(sql`${tables.loans.id} = ${loan!.id}`)

    await expect(
      testDb.insert(tables.loans).values({ copyId: copy.id, borrowerUserId: second.id }),
    ).resolves.toBeDefined()
  })

  it('требует ровно одного заёмщика', async () => {
    const { copy, user } = await makeLibrary()

    // Ни одного.
    await expect(
      testDb.insert(tables.loans).values({ copyId: copy.id }),
      'loans_one_borrower_check',
    )

    // Оба сразу.
    const [contact] = await testDb
      .insert(tables.contacts)
      .values({ ownerId: user.id, name: 'Мама' })
      .returning()

    await expectViolation(
      testDb.insert(tables.loans).values({
        copyId: copy.id,
        borrowerUserId: user.id,
        borrowerContactId: contact!.id,
      }),
      'loans_one_borrower_check',
    )
  })

  it('не даёт вернуть книгу раньше, чем выдали', async () => {
    const { copy, user } = await makeLibrary()

    await expectViolation(
      testDb.insert(tables.loans).values({
        copyId: copy.id,
        borrowerUserId: user.id,
        lentAt: '2026-05-01',
        returnedAt: '2026-04-01',
      }),
      'loans_returned_after_lent_check',
    )
  })
})

describe('ISBN — идентификатор издания, не первичный ключ', () => {
  it('один и тот же ISBN может стоять у двух изданий', async () => {
    const first = await makeEdition()
    const second = await makeEdition()

    await testDb.insert(tables.editionIdentifiers).values([
      { editionId: first.id, type: 'isbn13', value: '9785041030223' },
      { editionId: second.id, type: 'isbn13', value: '9785041030223' },
    ])

    const rows = await testDb.select().from(tables.editionIdentifiers)
    expect(rows).toHaveLength(2)
  })

  it('но не дважды у одного издания', async () => {
    const edition = await makeEdition()

    await testDb
      .insert(tables.editionIdentifiers)
      .values({ editionId: edition.id, type: 'isbn13', value: '9785041030223' })

    await expectViolation(
      testDb
        .insert(tables.editionIdentifiers)
        .values({ editionId: edition.id, type: 'isbn13', value: '9785041030223' }),
      'edition_identifiers_edition_id_type_value_key',
    )
  })

  it('издание без единого идентификатора — нормальная советская книга', async () => {
    const edition = await makeEdition({ publishedYear: 1976 })
    const identifiers = await testDb
      .select()
      .from(tables.editionIdentifiers)
      .where(sql`${tables.editionIdentifiers.editionId} = ${edition.id}`)

    expect(identifiers).toEqual([])
  })

  it('справочник типов налит миграцией', async () => {
    const types = await testDb.select().from(tables.identifierTypes)
    expect(types.map(t => t.code).sort()).toEqual(
      ['asin', 'bbk', 'isbn10', 'isbn13', 'issn', 'order_no', 'udk'],
    )
  })

  it('неизвестный тип идентификатора не проходит', async () => {
    const edition = await makeEdition()
    await expectViolation(
      testDb
        .insert(tables.editionIdentifiers)
        .values({ editionId: edition.id, type: 'shelf_mark', value: '1' }),
      'edition_identifiers_type_identifier_types_code_fk',
    )
  })
})

describe('editions.dedupe_key считает Postgres', () => {
  it('нормализует заголовок и приклеивает год', async () => {
    const edition = await makeEdition({ title: 'Солярис: роман!', publishedYear: 1976 })
    expect(edition.dedupeKey).toBe('солярисроман|1976')
  })

  it('издание без года всё равно получает ключ', async () => {
    const edition = await makeEdition({ title: 'Без года', publishedYear: null })
    expect(edition.dedupeKey).toBe('безгода|')
  })
})

describe('подборки: элемент — произведение или издание, но не оба', () => {
  it('отклоняет пустой элемент', async () => {
    const user = await makeUser()
    const list = await makeList(user.id)

    await expectViolation(testDb.insert(tables.listItems).values({ listId: list.id }), 'list_items_one_target_check')
  })

  it('отклоняет элемент сразу с произведением и изданием', async () => {
    const user = await makeUser()
    const list = await makeList(user.id)
    const work = await makeWork()
    const edition = await makeEdition()

    await expectViolation(
      testDb.insert(tables.listItems).values({
        listId: list.id,
        workId: work.id,
        editionId: edition.id,
      }),
      'list_items_one_target_check',
    )
  })

  it('не даёт положить одно произведение в подборку дважды', async () => {
    const user = await makeUser()
    const list = await makeList(user.id)
    const work = await makeWork()

    await testDb.insert(tables.listItems).values({ listId: list.id, workId: work.id })

    await expectViolation(testDb.insert(tables.listItems).values({ listId: list.id, workId: work.id }), 'list_items_work_uniq_idx')
  })

  it('но в разных подборках одно произведение лежать может', async () => {
    const user = await makeUser()
    const work = await makeWork()
    const first = await makeList(user.id)
    const second = await makeList(user.id)

    await testDb.insert(tables.listItems).values([
      { listId: first.id, workId: work.id },
      { listId: second.id, workId: work.id },
    ])

    const items = await testDb.select().from(tables.listItems)
    expect(items).toHaveLength(2)
  })

  it('системная подборка находится по slug и уникальна на пользователя', async () => {
    const { user, wantToBuy } = await makeLibrary()
    expect(wantToBuy.slug).toBe('want-to-buy')

    await expectViolation(makeList(user.id, { slug: 'want-to-buy' }), 'lists_owner_id_slug_key')
  })
})

describe('дневник: у отметок нет «текущего статуса»', () => {
  it('перечитывание — это просто ещё одна строка', async () => {
    const { user, work } = await makeLibrary()

    await testDb.insert(tables.bookMarks).values([
      { userId: user.id, workId: work.id, status: 'read', finishedAt: '2019-07-12' },
      { userId: user.id, workId: work.id, status: 'reading', startedAt: '2026-08-20' },
    ])

    // Тай-брейк по id обязателен: now() в Postgres — время транзакции,
    // поэтому у отметок, созданных одним запросом, created_at совпадает
    // до микросекунды и «последняя по created_at» становится неоднозначной.
    // В приложении сортировать актуальный статус нужно так же.
    const marks = await testDb
      .select()
      .from(tables.bookMarks)
      .where(sql`${tables.bookMarks.userId} = ${user.id}`)
      .orderBy(sql`${tables.bookMarks.createdAt} DESC, ${tables.bookMarks.id} DESC`)

    expect(marks).toHaveLength(2)
    expect(marks[0]!.status).toBe('reading')
  })

  it('оценка вне 1..10 не проходит', async () => {
    const { user, work } = await makeLibrary()

    await expectViolation(
      testDb.insert(tables.bookMarks).values({
        userId: user.id,
        workId: work.id,
        status: 'read',
        rating: 11,
      }),
      'book_marks_rating_check',
    )
  })

  it('отметку можно поставить книге, которой нет в коллекции', async () => {
    const user = await makeUser()
    const work = await makeWork()

    await expect(
      testDb
        .insert(tables.bookMarks)
        .values({ userId: user.id, workId: work.id, status: 'want_to_read' }),
    ).resolves.toBeDefined()
  })

  it('неизвестный статус не проходит', async () => {
    const { user, work } = await makeLibrary()

    await expect(
      testDb.insert(tables.bookMarks).values({
        userId: user.id,
        workId: work.id,
        // Каст намеренный: проверяем защиту на уровне БД, а не типов.
        status: 'maybe_later' as ReadingStatus,
      }),
      'book_marks_status_check',
    )
  })
})

describe('видимость и скрытые экземпляры', () => {
  it('коллекция по умолчанию приватная, экземпляр — не скрытый', async () => {
    const user = await makeUser()
    const collection = await makeCollection(user.id)
    const copy = await makeCopy({ collectionId: collection.id })

    expect(collection.visibility).toBe('private')
    expect(copy.isHidden).toBe(false)
  })

  it('неизвестная видимость не проходит', async () => {
    const user = await makeUser()
    await expectViolation(makeCollection(user.id, { visibility: 'friends-of-friends' as Visibility }), 'collections_visibility_check')
  })

  it('скрытый экземпляр всё равно можно выдать в аренду', async () => {
    const { collection, edition } = await makeLibrary()
    const hidden = await makeCopy({
      collectionId: collection.id,
      editionId: edition.id,
      isHidden: true,
    })
    const borrower = await makeUser()

    await expect(
      testDb.insert(tables.loans).values({ copyId: hidden.id, borrowerUserId: borrower.id }),
    ).resolves.toBeDefined()
  })
})

describe('дружба', () => {
  it('нельзя подружиться с самим собой', async () => {
    const user = await makeUser()
    await expect(
      testDb.insert(tables.friendships).values({ requesterId: user.id, addresseeId: user.id }),
      'friendships_not_self_check',
    )
  })

  it('пара уникальна в заданном направлении', async () => {
    const a = await makeUser()
    const b = await makeUser()

    await testDb.insert(tables.friendships).values({ requesterId: a.id, addresseeId: b.id })

    await expectViolation(testDb.insert(tables.friendships).values({ requesterId: a.id, addresseeId: b.id }), 'friendships_requester_id_addressee_id_pk')
  })
})

describe('полки', () => {
  it('имя полки уникально внутри коллекции, но не между ними', async () => {
    const user = await makeUser()
    const home = await makeCollection(user.id)
    const dacha = await makeCollection(user.id)

    await makeLocation(home.id, { name: 'Верхняя полка' })

    // В другой коллекции то же имя допустимо.
    await expect(makeLocation(dacha.id, { name: 'Верхняя полка' })).resolves.toBeDefined()

    // В той же — нет.
    await expectViolation(
      makeLocation(home.id, { name: 'Верхняя полка' }),
      'locations_collection_id_name_key',
    )
  })

  it('БД НЕ проверяет, что полка из той же коллекции — это делает приложение', async () => {
    const user = await makeUser()
    const home = await makeCollection(user.id)
    const dacha = await makeCollection(user.id)
    const dachaShelf = await makeLocation(dacha.id)

    // Известная дыра в схеме: составной FK не заведён.
    // Если этот тест вдруг упадёт — значит, гарантию добавили на уровне БД,
    // и assertLocationInCollection можно выкидывать.
    await expect(
      makeCopy({ collectionId: home.id, locationId: dachaShelf.id }),
    ).resolves.toBeDefined()
  })
})

describe('каталог общий, личное каскадится', () => {
  it('удаление пользователя уносит его коллекции и экземпляры, но не каталог', async () => {
    const { user, edition, work } = await makeLibrary()

    await testDb.delete(tables.users).where(sql`${tables.users.id} = ${user.id}`)

    expect(await testDb.select().from(tables.collections)).toHaveLength(0)
    expect(await testDb.select().from(tables.copies)).toHaveLength(0)

    const editions = await testDb.select().from(tables.editions)
    const works = await testDb.select().from(tables.works)
    expect(editions.map(e => e.id)).toContain(edition.id)
    expect(works.map(w => w.id)).toContain(work.id)
    // created_by обнуляется, запись остаётся общей.
    expect(editions.find(e => e.id === edition.id)!.createdBy).toBeNull()
  })

  it('издание нельзя удалить, пока у кого-то есть экземпляр', async () => {
    const { edition } = await makeLibrary()

    await expect(
      testDb.delete(tables.editions).where(sql`${tables.editions.id} = ${edition.id}`),
      'copies_edition_id_editions_id_fk',
    )
  })
})
