// nuxt.config.ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  typescript: { strict: true },
  nitro: {
    // В DEV все запросы /api/* пойдут на FastAPI :8000
    devProxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true }
    }
  },
  runtimeConfig: {
    public: {
      // В DEV это будет '/api' (через devProxy). На проде можно сменить через .env
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api'
    }
  }
})
