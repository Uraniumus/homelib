<script setup lang="ts">
/**
 * Заглушка каркаса: показывает, что фронт видит сервер, а сервер — базу.
 * Отсюда начинается первый вертикальный срез «отсканировала штрихкод →
 * книга на полке» — эту страницу можно смело переписать целиком.
 */
const { data: health, error } = await useFetch('/api/health')

useHead({ title: 'Полки' })
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Сервер не отвечает"
      :description="error.message"
    />
    <UAlert
      v-else
      color="success"
      variant="subtle"
      title="Каркас поднят"
      :description="`База отвечает за ${health?.latencyMs} мс.`"
    />

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Что дальше
        </h2>
      </template>

      <ol class="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Поднять инфраструктуру: <code>docker compose up -d</code></li>
        <li>Накатить схему: <code>pnpm db:migrate &amp;&amp; pnpm db:seed</code></li>
        <li>Первый роут в <code>server/api/</code> и первый экран — вместо этой страницы</li>
      </ol>
    </UCard>
  </div>
</template>
