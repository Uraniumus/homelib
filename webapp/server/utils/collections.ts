import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { type Database, tables } from './drizzle'

/**
 * FK `copies.location_id` не гарантирует, что полка из той же коллекции,
 * что и экземпляр (составной FK в схему не заводили — см. комментарий
 * в library_schema.sql). Поэтому проверка живёт здесь, и её надо звать
 * в каждом роуте, который ставит или меняет locationId.
 */
export async function assertLocationInCollection(
  db: Database,
  locationId: number | null | undefined,
  collectionId: number,
) {
  if (locationId == null) return

  const [location] = await db
    .select({ id: tables.locations.id })
    .from(tables.locations)
    .where(and(eq(tables.locations.id, locationId), eq(tables.locations.collectionId, collectionId)))
    .limit(1)

  if (!location) {
    throw createError({
      statusCode: 422,
      message: 'Полка принадлежит другой коллекции',
    })
  }
}
