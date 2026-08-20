import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    target: 'ES2020',
    rollupOptions: {
      input: {
        // `fx` = page de test des animations, servie sur /fx.html
        main: resolve(__dirname, 'index.html'),
        fx:   resolve(__dirname, 'fx.html'),
      },
    },
  },
  test: {
    environment: 'node',
  },
})
