<script setup lang="ts">
const { public: config } = useRuntimeConfig()

useHead({
  titleTemplate: title => (title ? `${title} — ${config.appName}` : config.appName),
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
