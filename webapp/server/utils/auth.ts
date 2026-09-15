import type { H3Event } from 'h3'

/**
 * Сессии — на nuxt-auth-utils (`setUserSession` / `getUserSession`).
 * Здесь только то, что нужно роутам: достать текущего пользователя
 * или отказать. Логика логина появится вместе с роутом регистрации.
 */

export interface SessionUser {
  id: number
  username: string
}

/** 401, если не залогинен. Все приватные роуты начинаются с этой строки. */
export async function requireUser(event: H3Event): Promise<SessionUser> {
  const session = await getUserSession(event)
  const user = session?.user as SessionUser | undefined

  if (!user?.id) {
    throw createError({ statusCode: 401, message: 'Нужно войти' })
  }
  return user
}

/** Для публичных страниц: залогинен — вернёт, нет — вернёт null, но не упадёт. */
export async function getOptionalUser(event: H3Event): Promise<SessionUser | null> {
  const session = await getUserSession(event)
  const user = session?.user as SessionUser | undefined
  return user?.id ? user : null
}
