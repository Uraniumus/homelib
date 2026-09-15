// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Nuxt-компоненты часто одностраничные: index.vue, default.vue.
    'vue/multi-word-component-names': 'off',
  },
  ignores: ['server/database/migrations/**'],
})
