import { SYSTEM_LIST_SLUGS } from '../database/schema'
import { type Database, tables } from './drizzle'

/**
 * Всё, что должно появиться у нового пользователя при регистрации.
 * Вызывается и из роута регистрации, и из сид-скрипта, и из тестовых фабрик —
 * чтобы «пустой» пользователь везде выглядел одинаково.
 */
export async function provisionNewUser(
  db: Database,
  userId: number,
  options: { defaultCollectionName?: string } = {},
) {
  const [wantToBuy] = await db
    .insert(tables.lists)
    .values({
      ownerId: userId,
      name: 'Хочу купить',
      slug: SYSTEM_LIST_SLUGS.wantToBuy,
      visibility: 'private',
    })
    .returning()

  const [collection] = await db
    .insert(tables.collections)
    .values({
      ownerId: userId,
      name: options.defaultCollectionName ?? 'Дом',
      visibility: 'private',
    })
    .returning()

  return { wantToBuy: wantToBuy!, collection: collection! }
}
