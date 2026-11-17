import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/mjgrok/',
  plugins: [
    react(),
    {
      name: 'serve-source-entry',
      apply: 'serve',
      transformIndexHtml(html: string) {
        return html
          .replace(/<link rel="stylesheet"[^>]*>/, '')
          .replace(/src="\/mjgrok\/assets\/[^"]+"/, 'src="/mjgrok/src/main.tsx"')
      },
    },
  ],
  resolve: {
    alias: {
      '@mjwaits/shared': new URL('./shared/engine/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
