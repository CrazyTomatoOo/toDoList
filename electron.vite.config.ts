import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
import { cpSync, existsSync } from 'node:fs'
import type { Plugin } from 'vite'

/** Copy SQL migration files to the main process output directory. */
function copyMigrations(): Plugin {
  return {
    name: 'copy-migrations',
    closeBundle() {
      const src = resolve(__dirname, 'src/main/db/migrations')
      const dest = resolve(__dirname, 'out/main/chunks/migrations')
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true })
      }
    },
  }
}

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: {
        external: ['better-sqlite3'],
        input: {
          main: resolve(__dirname, 'src/main/main.ts'),
        },
      },
    },
    plugins: [copyMigrations()],
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'src/main/preload.ts'),
        },
        output: {
          entryFileNames: 'preload.js',
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
      },
    },
  },
})
