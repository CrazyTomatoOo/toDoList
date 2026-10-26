import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
import { cpSync, existsSync } from 'node:fs'
import type { Plugin } from 'vite'

/**
 * Copy SQL migration files next to the main-process bundle.
 *
 * migrations.ts resolves its SQL dir as `path.join(__dirname, "migrations")`
 * after bundling. When rollup inlines the module into main.js that is
 * `out/main/migrations`; when it emits it as a chunk it is
 * `out/main/chunks/migrations`. Copy to both so the runtime lookup lands on
 * real files either way.
 */
function copyMigrations(): Plugin {
  return {
    name: 'copy-migrations',
    closeBundle() {
      const src = resolve(__dirname, 'src/main/db/migrations')
      for (const dest of [
        resolve(__dirname, 'out/main/migrations'),
        resolve(__dirname, 'out/main/chunks/migrations'),
      ]) {
        if (existsSync(src)) {
          cpSync(src, dest, { recursive: true })
        }
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
