<template>
  <main style="max-width:720px;margin:40px auto;font-family:system-ui">
    <h1>Library</h1>
    <p>Health: {{ health }}</p>

    <h2>Добавить книгу</h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <input v-model="title" placeholder="Title" />
      <input v-model="author" placeholder="Author (optional)" />
      <button @click="addBook">Add</button>
    </div>

    <h2>Книги</h2>
    <ul>
      <li v-for="(b, i) in books" :key="i">{{ b.title }} — {{ b.author ?? '—' }}</li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

type Book = { title: string; author: string | null }

const defaultApiBase = 'http://localhost:8000/api'
const apiBase = (import.meta.env.VITE_API_BASE ?? defaultApiBase).replace(/\/$/, '')

const health = ref('...')
const books = ref<Book[]>([])
const title = ref('')
const author = ref('')

async function fetchHealth() {
  try {
    const res = await fetch(`${apiBase}/health`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (res.status === 304) {
      health.value = 'ok'
      return
    }
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
    const payload = await safeJson(res)
    health.value = payload.status ?? 'unknown'
  } catch (error) {
    console.error(error)
    health.value = 'error'
  }
}

async function fetchBooks() {
  try {
    const res = await fetch(`${apiBase}/books`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Books fetch failed: ${res.status}`)
    books.value = await safeJson(res)
  } catch (error) {
    console.error(error)
    books.value = []
  }
}

async function addBook() {
  const payload = { title: title.value.trim(), author: author.value.trim() || null }
  if (!payload.title) return

  try {
    await fetch(`${apiBase}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    title.value = ''
    author.value = ''
    await fetchBooks()
  } catch (error) {
    console.error(error)
  }
}

onMounted(async () => {
  await Promise.all([fetchHealth(), fetchBooks()])
})

async function safeJson(res: Response) {
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    throw new Error(`Expected JSON, received: ${text.slice(0, 120)}`)
  }
  return res.json()
}
</script>
