import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { builtinModules } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/Provider/Provider.js'),
      formats: ['cjs'],
      fileName: () => 'Provider.js'
    },
    outDir: 'dist',
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
        /^[^./]/
      ]
    }
  }
})
