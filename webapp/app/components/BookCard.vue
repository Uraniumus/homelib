<template>
  <article class="book-card" :class="{ 'book-card--read': book.read }">
    <div class="book-card__cover" aria-hidden="true">
      <span>{{ coverInitials }}</span>
    </div>

    <div class="book-card__body">
      <header class="book-card__header">
        <h3 class="book-card__title">{{ book.title }}</h3>
        <p class="book-card__author">{{ authorLabel }}</p>
      </header>

      <p class="book-card__description">{{ descriptionLabel }}</p>

      <dl v-if="metaItems.length" class="book-card__meta">
        <div v-for="item in metaItems" :key="item.label" class="book-card__meta-item">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </div>

    <footer class="book-card__footer">
      <span class="book-card__status">{{ statusLabel }}</span>
      <div class="book-card__actions">
        <button type="button" :disabled="loading" @click="emit('mark-read', book)">
          {{ toggleReadLabel }}
        </button>
        <button
          type="button"
          class="book-card__danger"
          :disabled="loading"
          @click="emit('remove', book)"
        >
          Удалить
        </button>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Nullable<T> = T | null | undefined

export type BookCardModel = {
  id?: string | number
  title: string
  author?: Nullable<string>
  description?: Nullable<string>
  year?: Nullable<number>
  pages?: Nullable<number>
  genre?: Nullable<string>
  read?: Nullable<boolean>
}

const props = withDefaults(
  defineProps<{
    book: BookCardModel
    loading?: boolean
  }>(),
  {
    loading: false,
  }
)

const emit = defineEmits<{
  (e: 'mark-read' | 'remove', book: BookCardModel): void
}>()

const book = computed(() => props.book)

const authorLabel = computed(() => book.value.author?.trim() || 'Автор неизвестен')
const descriptionLabel = computed(
  () => book.value.description?.trim() || 'Описание отсутствует'
)
const coverInitials = computed(() => {
  return book.value.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? '')
    .join('')
    .padEnd(2, '•')
})

const metaItems = computed(() => {
  const items: Array<{ label: string; value: string | number }> = []
  if (book.value.year) items.push({ label: 'Год', value: book.value.year })
  if (book.value.pages) items.push({ label: 'Страниц', value: book.value.pages })
  if (book.value.genre) items.push({ label: 'Жанр', value: book.value.genre })
  return items
})

const statusLabel = computed(() => {
  if (props.loading) return 'Сохранение...'
  return book.value.read ? 'Прочитана' : 'В очереди'
})

const toggleReadLabel = computed(() =>
  book.value.read ? 'Сбросить' : 'Отметить прочитанной'
)
</script>

<style scoped>
.book-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  padding: 16px;
  border: 1px solid #d6d8df;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}

.book-card--read {
  border-color: #5cbf80;
  background: #f6fff9;
}

.book-card__cover {
  width: 64px;
  height: 96px;
  border-radius: 8px;
  background: linear-gradient(135deg, #9ba0ff, #5257c9);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 1px;
}

.book-card__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.book-card__header {
  display: flex;
  flex-direction: column;
}

.book-card__title {
  margin: 0;
  font-size: 18px;
}

.book-card__author {
  margin: 4px 0 0;
  color: #5a6171;
  font-size: 14px;
}

.book-card__description {
  margin: 0;
  color: #333;
  font-size: 14px;
}

.book-card__meta {
  display: flex;
  gap: 16px;
  margin: 0;
}

.book-card__meta-item dt {
  font-size: 12px;
  text-transform: uppercase;
  color: #8b90a3;
  margin-bottom: 2px;
}

.book-card__meta-item dd {
  margin: 0;
  font-weight: 500;
}

.book-card__footer {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.book-card__actions {
  display: flex;
  gap: 8px;
}

.book-card__status {
  font-size: 14px;
  color: #5a6171;
}

.book-card button {
  border: 0;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 500;
}

.book-card button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.book-card__danger {
  background: #ffecee;
  color: #c9354d;
}

.book-card__danger:not(:disabled):hover {
  background: #ffd5db;
}
</style>
