// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    'nuxt-auth-utils',
    '@nuxt/test-utils/module',
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Всё, что здесь, живёт только на сервере и в браузер не попадает.
    // Значения по умолчанию берём из тех же переменных, что читают
    // drizzle-kit и скрипты, — чтобы имя переменной было одно на проект.
    // NUXT_DATABASE_URL по-прежнему работает как override.
    databaseUrl: process.env.DATABASE_URL ?? '',
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? 'ru-central1',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
    /** Лимиты бесплатного тарифа — предохранители из context.md. */
    limits: {
      maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024),
      photosPerCopy: Number(process.env.PHOTOS_PER_COPY ?? 3),
      booksPerUser: Number(process.env.BOOKS_PER_USER ?? 100),
    },
    public: {
      // Сюда попадает то, что не жалко отдать в браузер.
      appName: 'Домашняя библиотека',
    },
  },

  future: { compatibilityVersion: 4 },

  // SSR нужен ради превью подборок и отзывов в мессенджерах — не выключать.
  ssr: true,

  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0f172a' },
      ],
    },
  },

  nitro: {
    experimental: { asyncContext: true },
  },

  typescript: { typeCheck: false },
})
