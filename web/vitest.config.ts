import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [{
    name: 'attachment-test-config',
    resolveId(id) {
      if (id === 'virtual:attachments/config') return '\0virtual:attachments/config';
    },
    load(id) {
      if (id === '\0virtual:attachments/config') {
        return `export default ${JSON.stringify({
          directory: fileURLToPath(new URL('../attachments', import.meta.url)),
          base: '/',
          site: 'https://example.test',
        })};`;
      }
    },
  }],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      '@assets': fileURLToPath(new URL('../assets', import.meta.url)),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
