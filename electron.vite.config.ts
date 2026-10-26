import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
import { cpSync, existsSync } from 'node:fs'
import type { Plugin } from 'vite'

/**
 * Copy SQL migration files next to the main process entry.
 *
 * `src/main/db/migrations.ts` resolves them as `path.join(__dirname,
 * 'migrations')`. The main process is a single bundled entry, so `__dirname`
 * at runtime is `out/main` — not `out/main/chunks`, which is where this used
 * to land when the module was still code-split behind a dynamic import.
 */
function copyMigrations(): Plugin {
  return {
    name: 'copy-migrations',
    closeBundle() {
      const src = resolve(__dirname, 'src/main/db/migrations')
      const dest = resolve(__dirname, 'out/main/migrations')
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
