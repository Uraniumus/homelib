import type { PostgresError } from 'postgres'
import { expect } from 'vitest'

/**
 * Проверяет, что запрос нарушил именно этот констрейнт.
 *
 * Нужен потому, что drizzle заворачивает ошибку драйвера в DrizzleQueryError,
 * а в его message лежит только текст запроса — имени констрейнта там нет.
 * Поэтому `rejects.toThrow(/имя_констрейнта/)` не работает: тест падает,
 * даже когда БД отработала правильно. Настоящая ошибка лежит в cause —
 * это PostgresError с полями constraint_name, code и detail.
 */
export async function expectViolation(operation: PromiseLike<unknown>, constraint: string) {
  let caught: unknown
  let thrown = false

  try {
    await operation
  }
  catch (error) {
    caught = error
    thrown = true
  }

  if (!thrown) {
    expect.fail(`Ожидалось нарушение констрейнта "${constraint}", но запрос прошёл`)
  }

  const pg = (caught as { cause?: PostgresError }).cause

  expect(
    pg?.constraint_name,
    `нарушен другой констрейнт: ${pg?.message ?? String(caught)}`,
  ).toBe(constraint)
}
