import type { H3Event } from 'h3'
import { z } from 'zod'

/**
 * Обёртки над zod, чтобы в роутах не повторять try/catch и чтобы ошибка
 * валидации всегда приезжала на фронт одинаковой: 422 и список полей.
 *
 *   const body = await parseBody(event, createCopySchema)
 *
 * Названы не readValidatedBody/getValidatedQuery намеренно: такие функции
 * уже есть в h3, и совпадение имён с автоимпортом Nitro читалось бы как
 * «вызываю h3», а вызывалось бы это.
 */

function toValidationError(error: z.ZodError) {
  return createError({
    statusCode: 422,
    message: 'Некорректные данные',
    data: {
      issues: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
  })
}

export async function parseBody<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.infer<T>> {
  const result = schema.safeParse(await readBody(event))
  if (!result.success) throw toValidationError(result.error)
  return result.data
}

export function parseQuery<T extends z.ZodType>(event: H3Event, schema: T): z.infer<T> {
  const result = schema.safeParse(getQuery(event))
  if (!result.success) throw toValidationError(result.error)
  return result.data
}

/** `/api/copies/[id]` — id из пути всегда строка, а в БД bigint. */
export function getRouteId(event: H3Event, name = 'id'): number {
  const raw = getRouterParam(event, name)
  const id = Number(raw)
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: `Некорректный ${name}` })
  }
  return id
}

/** Общие куски схем, чтобы одинаковые поля не расходились между роутами. */
export const schemas = {
  visibility: z.enum(['public', 'friends', 'private']),
  readingStatus: z.enum(['want_to_read', 'reading', 'read', 'abandoned']),
  id: z.number().int().positive(),
  /** Дата без времени: в БД это `date`, драйвер отдаёт и принимает строку. */
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ожидается YYYY-MM-DD'),
  /** ISBN приходит со сканера с дефисами и пробелами — чистим до цифр. */
  isbn: z.string().transform(v => v.replace(/[^\dXx]/g, '').toUpperCase()),
}
