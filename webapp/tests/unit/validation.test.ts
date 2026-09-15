import { describe, expect, it } from 'vitest'
import { schemas } from '../../server/utils/validation'

/**
 * Быстрые тесты без БД: чистые схемы валидации. Проект `unit` в vitest.config.ts
 * ничего не поднимает, так что этот файл гоняется за миллисекунды.
 */

describe('schemas.isbn', () => {
  it('чистит дефисы и пробелы со сканера', () => {
    expect(schemas.isbn.parse('978-5-04-103022-3')).toBe('9785041030223')
    expect(schemas.isbn.parse(' 978 5 04 103022 3 ')).toBe('9785041030223')
  })

  it('сохраняет X в контрольном разряде ISBN-10', () => {
    expect(schemas.isbn.parse('0-8044-2957-x')).toBe('080442957X')
  })
})

describe('schemas.isoDate', () => {
  it('принимает YYYY-MM-DD', () => {
    expect(schemas.isoDate.parse('2026-03-15')).toBe('2026-03-15')
  })

  it('отклоняет всё остальное', () => {
    expect(schemas.isoDate.safeParse('15.03.2026').success).toBe(false)
    expect(schemas.isoDate.safeParse('2026-03-15T00:00:00Z').success).toBe(false)
  })
})

describe('schemas.visibility', () => {
  it('знает ровно три значения — те же, что в CHECK схемы', () => {
    expect(schemas.visibility.options).toEqual(['public', 'friends', 'private'])
  })
})
