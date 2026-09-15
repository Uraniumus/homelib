import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import BookCard from '../../app/components/BookCard.vue'

/**
 * Образец теста на компонент. Проект `nuxt` в vitest.config.ts поднимает
 * окружение Nuxt, поэтому автоимпорты и композаблы внутри компонента работают.
 */

describe('BookCard', () => {
  it('показывает заглушки, когда автора и описания нет', async () => {
    const wrapper = await mountSuspended(BookCard, {
      props: { book: { title: 'Солярис' } },
    })

    expect(wrapper.text()).toContain('Автор неизвестен')
    expect(wrapper.text()).toContain('Описание отсутствует')
  })

  it('складывает инициалы обложки из первых двух слов', async () => {
    const wrapper = await mountSuspended(BookCard, {
      props: { book: { title: 'Братья Карамазовы' } },
    })

    expect(wrapper.find('.book-card__cover').text()).toBe('БК')
  })

  it('сообщает наверх, что книгу отметили прочитанной', async () => {
    const book = { id: 1, title: 'Вельд' }
    const wrapper = await mountSuspended(BookCard, { props: { book } })

    await wrapper.findAll('button')[0]!.trigger('click')

    expect(wrapper.emitted('mark-read')).toEqual([[book]])
  })
})
