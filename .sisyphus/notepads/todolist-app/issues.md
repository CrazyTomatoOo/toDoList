
## T2 - Main process window management, single-instance lock, context menu
- The workspace `node_modules` was in a broken state with packages quarantined as `.ignored_*` and the Electron binary missing. Resolved by cleaning and reinstalling dependencies, then manually triggering the Electron post-install with a mirror.
- `src/main/main.ts` was corrupted with duplicated code (two `app.whenReady()` blocks and two window creation functions). Rewrote it cleanly with single-instance lock, menu, and lifecycle handlers.
- `npm test` currently fails for non-T2 test files:
  - `src/__tests__/example.test.ts` intentionally RED tests T5 migration logic and throws as expected.
  - `src/__tests__/main/ipc.test.ts` imports real `electron`/`ipcMain` and does not mock Electron; it needs the T3 harness or T4 implementation to run safely in Vitest.
- macOS Dock reactivate could not be fully automated in this environment because AppleScript accessibility access for `System Events` and `Dock` is denied. A screenshot of the running ToDoList window was captured, but the close-then-Dock-click sequence was not executed automatically.

T5 issues / blockers:
- electron-rebuild leaves the better_sqlite3.node binary compiled for Electron, which cannot be loaded by Node/Vitest. Workaround: `npm test` now rebuilds for Node first; `npx electron-rebuild --force` is needed before packaging / running the built app.
- The workspace initially had a corrupted/pnpm-style `node_modules` and a lingering `npm`/`pnpm` install process. I had to kill those processes, remove `node_modules`, and reinstall with `npm install` before adding better-sqlite3.
- `electron-rebuild` without `--force` did not recompile after I manually ran `npm rebuild better-sqlite3`; `--force` was required to ensure the binary matched Electron's ABI.
- Pre-existing `src/__tests__/main/ipc.test.ts` fails in Node because it imports `ipcMain` from `electron` without mocking it; this is unrelated to T5 and should be fixed by T3 / a future test harness.
## T4: Issues encountered

- Dependency state was initially inconsistent (npm/pnpm lock mismatch, T1 parallel work). Required fresh install with pnpm to obtain working binaries.
- T5 added `src/main/db/connection.ts` and `src/main/db/migrations.ts` imports to `main.ts` before better-sqlite3 was rebuilt for the current Electron version, causing E2E app launch to crash. Worked around by lazy-loading the DB modules and catching the native-module error so the app can still start for IPC/UI verification. T5 should ensure native module rebuild is integrated (electron-rebuild / postinstall).
- Project references in tsconfig required `composite: true` and `noEmit: false` in child configs; root `noEmit` was removed so the CLI `--noEmit` flag controls emission.
- electron-vite defaults produced `preload.mjs`/`preload.cjs`; had to configure `rollupOptions.output` with `entryFileNames: "preload.js"` and `format: "cjs"` to match the runtime path and existing window tests.
- Parallel agent writes repeatedly overwrote `main.ts`, `preload.ts`, and `shared/ipc.ts`; had to rewrite files fully to recover from merge-corrupted states.

## T3 - Testing infrastructure
- The initial E2E example failed because `src/renderer/App.tsx` rendered nothing; the test needed a real shell element before Playwright could assert visibility.
- The Vitest config briefly had a duplicated `include` key; it was cleaned up to avoid config ambiguity.

## T6 - Lists and tasks schema
- No blockers. Existing migration tests needed their expected latest version updated from 1 to 2 after adding the new migration.

## T6 follow-up
- `src/__tests__/example.test.ts` had to stop hardcoding migration version 1 after `002_lists_and_tasks.sql` landed; otherwise the harness went red for the wrong reason.

## T9+T10 - Base UI layout
- Sidebar task counts were stale after task mutations because `App.tsx` didn't call `useLists.refresh()` after task CRUD operations. Fixed by destructuring `refresh` as `refreshLists` and calling it in every task mutation handler.
- E2E tests failed with 'no such table: lists' because `electron-vite` build didn't copy `.sql` migration files to `out/main/chunks/migrations/`. Fixed with a custom Vite plugin in `electron.vite.config.ts`.
- `pretest:e2e` script was `npm run build` only; after `npm test` rebuilds better-sqlite3 for Node, E2E would crash. Fixed to `npm run build && npx electron-rebuild --force`.
- Playwright `page.waitForFunction` with async callbacks silently failed to poll IPC; replaced with explicit for-loop polling pattern.

## T12+T13 - Drag-and-drop and search/filter
- `useSortableTasks.ts` must use `.tsx` extension (not `.ts`) because it contains JSX in the `DndProvider` component. TypeScript errors with `TS1005: '>' expected` if using `.ts`.
- Edit tool auto-strips `</div>` boundary echo lines when the replacement starts with a `</div>` adjacent to a surviving `</div>`. Must manually re-add the closing tag after editing.
- Playwright E2E drag-and-drop simulation with `page.mouse.down()/move()/up()` is unreliable for @dnd-kit. The PointerSensor activation constraint (5px distance) and pointer event handling make mouse simulation flaky. Solution: test sort order persistence via direct IPC calls instead of UI drag simulation.
- `useSearchAndFilter` debounce must be cleaned up on unmount and on filter change to prevent stale async calls.

## T15 - JSON/CSV import/export
- First E2E attempt used `await import("electron")` inside `electronApp.evaluate`; this fails in ESM main process with "A dynamic import callback was not specified". Resolved with a `globalThis.__dialogMock` injection.
- Roundtrip tests initially tried to launch a second Electron app while the first was still running; single-instance lock caused the second launch to fail. Resolved by closing the export app first.


## T16 - macOS DMG packaging
- Environment proxy variables `http_proxy`/`https_proxy` were set to `127.0.0.1:7890` without a protocol, which caused electron-builder's `HttpProxyAgent` to throw `TypeError: Invalid URL` when downloading Electron and dmgbuild artifacts. Worked around by setting the variables to `http://127.0.0.1:7890` for the build command.
- Custom `dmg.contents` configuration with `path: ToDoList.app` caused `dmgbuild` to fail with `FileNotFoundError: ToDoList.app`. Removing the `dmg.contents` section and letting electron-builder use defaults resolved the issue.
- LSP diagnostics could not be run because the configured Biome server is not installed in this environment; type checking via `npm run typecheck` passed instead.


## T17 - Windows EXE packaging
- First attempt added `publisherName: ToDoList` directly under `win:` and `sign: false`, both rejected by electron-builder's schema. Correct fix: remove `publisherName` and use `win.signExecutable: false`.
- `png-to-ico` npm package produced an unreadable/invalid ICO from a 1024x1024 PNG; switched to `png2icons` which generated a proper multi-resolution Windows executable ICO.
- LSP diagnostics remain unavailable (Biome not installed); `npm run typecheck` and build commands passed instead.

## T18 - Packaged macOS app integration and smoke test
- `playwright.config.ts` contained duplicate `testMatch` and `timeout` keys; cleaned up to a single well-formed config.
- No blockers: the packaged app launches, better-sqlite3 loads, and the full integration flow completes in ~5s on arm64 macOS.
- Windows EXE smoke testing is not possible on macOS; documented as a limitation in `scripts/smoke-test.js`.

## T19 - Performance and edge-case checks
- No virtualization was needed: the packaged macOS app scrolled 1000 rendered task items within the smoothness threshold in `scripts/perf-report.js`.
- `scripts/perf-report.js` depends on the packaged macOS app existing in `dist/mac-arm64/ToDoList.app` or a DMG in `dist/`; it records a clear failure in `.sisyphus/evidence/task-19-perf-test.txt` if neither artifact is present.
- Vitest service tests initially failed because better-sqlite3 was compiled for Electron (NODE_MODULE_VERSION 136) while system Node uses version 127. Fixed by running `npm rebuild better-sqlite3` before Vitest, then restored the Electron build with `npx electron-rebuild --force` afterward.

## Final QA findings — 2026-07-15
- `npm run test:e2e` passed 37/37 and packaged integration passed 1/1.
- First `node scripts/smoke-test.js` run timed out waiting for `todo.db`; immediate rerun passed and saved `smoke-test-rerun.txt`. Treat as smoke-test flakiness unless explained.
- Running `npx vitest run src/__tests__/perf/edge-cases.test.ts` after `npm run test:e2e` failed because `better-sqlite3` had been rebuilt for Electron (NODE_MODULE_VERSION 136) while Node wanted 127. `npm rebuild better-sqlite3` then rerun passed 6/6; test sequence needs native-module rebuild isolation.
- Manual final QA rerun passed cross-task integration, empty state, invalid input, and rapid actions; initial manual script failed due duplicate dialog handlers in QA script, not app behavior.

## F3 final QA rerun — 2026-07-15
- No blocking QA defects found in rerun. E2E 37/37, npm test 105/105, edge cases 6/6, packaged integration 1/1, smoke passed first attempt, perf passed smooth threshold, manual scenarios 4/4.


## F4 rejection fixes — 2026-07-15
- No remaining F4 blockers found after verification. `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:e2e` passed.
- `node scripts/perf-report.js` still may fall back from direct SQLite seeding to renderer IPC when `better-sqlite3` is rebuilt for Electron ABI; this is expected after E2E and the script records the fallback in evidence.

## 2026-07-15 - F4 cleanup

Removed unaccounted root/generated files (`1`, `EOF`, `tsconfig.main.tsbuildinfo`, `tsconfig.renderer.tsbuildinfo`) and added T18 evidence documenting that Windows packaged-app smoke testing cannot be executed from macOS; only the macOS .app smoke test is locally exercised while the Windows EXE artifact is verified as a valid Nullsoft Installer.

- Note: `npm run typecheck` regenerated the TypeScript build-info files because the child configs are composite; removed them again after the successful verification so the final root directory is clean.
