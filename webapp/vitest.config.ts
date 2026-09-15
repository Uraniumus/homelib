import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

/**
 * Три проекта, потому что у них разные требования к окружению:
 *
 *   unit   — чистые функции, ничего не поднимает, работает всегда;
 *   server — ходит в настоящий Postgres (TEST_DATABASE_URL);
 *   nuxt   — компоненты в окружении Nuxt, поднимается медленнее остальных.
 *
 * Гонять всё:        pnpm test
 * Только быстрые:    pnpm test:unit
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'server',
          include: ['tests/server/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['./tests/setup/database.global.ts'],
          setupFiles: ['./tests/setup/database.ts'],
          // Тесты делят одну БД и чистят её между собой,
          // поэтому файлы гоняем последовательно.
          fileParallelism: false,
          hookTimeout: 60_000,
        },
      },
      // Этот проект оборачивается отдельно: только так @nuxt/test-utils
      // успевает поднять окружение Nuxt до запуска тестов.
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.test.ts'],
          environment: 'nuxt',
        },
      }),
    ],
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
