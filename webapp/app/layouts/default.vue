<script setup lang="ts">
const { public: config } = useRuntimeConfig()
</script>

<template>
  <div class="min-h-dvh bg-default text-default">
    <header class="border-b border-default">
      <div class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <NuxtLink to="/" class="font-semibold">
          {{ config.appName }}
        </NuxtLink>
        <nav class="flex items-center gap-1">
          <UButton to="/" variant="ghost" size="sm" label="Полки" />
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-6">
      <slot />
    </main>
  </div>
</template>
