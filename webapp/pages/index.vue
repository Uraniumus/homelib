<template>
  <main style="max-width:720px;margin:40px auto;font-family:system-ui">
    <h1>Library Nuxt</h1>
    <p>Health: {{ health }}</p>

    <h2>Добавить книгу</h2>
    <input v-model="title" placeholder="Title" />
    <input v-model="author" placeholder="Author (optional)" />
    <button @click="addBook">Add</button>

    <h2>Книги</h2>
    <ul>
      <li v-for="(b, i) in books" :key="i">{{ b.title }} — {{ b.author ?? '—' }}</li>
    </ul>
  </main>
</template>
<!-- pages/index.vue -->
<script setup lang="ts">
const api = useRuntimeConfig().public.apiBase // по умолчанию '/api'
const { data: health } = await useFetch(`${api}/health`)
const { data: books, refresh } = await useFetch(`${api}/books`)

const title = ref('')
const author = ref('')

async function addBook() {
  await $fetch(`${api}/books`, { method: 'POST', body: { title: title.value, author: author.value || null } })
  title.value = ''; author.value = ''
  await refresh()
}
</script>