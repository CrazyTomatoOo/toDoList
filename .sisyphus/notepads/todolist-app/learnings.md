
## T2 - Main process window management, single-instance lock, context menu
- Main process window management lives in src/main/window.ts; createMainWindow, getMainWindow, focusMainWindow form the minimal surface needed for single-instance behavior and macOS reactivation.
- Electron app menu roles must be typed carefully. Use explicit `as Electron.MenuItemConstructorOptions[]` casts on submenu arrays to prevent TypeScript from widening `role` and `type` to `string`.
- `app.requestSingleInstanceLock()` is the simplest and most reliable way to enforce a single database-holding process. On second launch, the first instance receives the `second-instance` event, where we call `focusMainWindow()` to bring the existing window forward.
- For macOS, keep the app running after `window-all-closed` and recreate the window on `activate` when `BrowserWindow.getAllWindows().length === 0`.
- Unit tests for Electron main process should mock the `electron` module with `vi.mock()` before any dynamic import, and reset modules between tests with `vi.resetModules()` to avoid shared singleton state.
- The BrowserWindow mock must be a regular `function` (not an arrow) so `new BrowserWindow()` works in the test environment.
- The `ipcMain` export must be included in the mock because `src/main/main.ts` calls `registerIpcHandlers()`, which depends on `ipcMain.handle`.
- `electron-vite` with `node-linker=hoisted` can leave packages in `.ignored_*` directories if an earlier install is interrupted. Renaming them back and finishing the install can recover the workspace, but a clean `npm install` is safer.
- The Electron binary download can timeout; using `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` then running `node node_modules/electron/install.js` worked in this environment.
- Project references in tsconfig.json require referenced projects to be composite and emit declarations; since we only need type checking, running `tsc --noEmit` against each tsconfig separately is simpler and avoids the project-reference constraints.

T5 (better-sqlite3 integration) learnings:
- better-sqlite3 is a native module and must be installed as a runtime dependency so electron-builder includes it in the packaged app.
- Use @types/better-sqlite3 for TypeScript; the instance type is `Database.Database` (namespace + class), not `Database`.
- ESM + TypeScript in electron-vite: externalize `better-sqlite3` in `electron.vite.config.ts` main build (`rollupOptions.external`) so the native module is required at runtime instead of bundled.
- Database connection should live in `src/main/db/` and never be imported by the renderer.
- `app.getPath('userData')` gives the correct cross-platform data directory; never hardcode paths.
- Provide a `TODO_USER_DATA_DIR` env override and a non-Electron fallback (tmpdir) so unit tests can run without a real Electron app.
- Use `db.pragma('journal_mode = WAL')` and `db.pragma('foreign_keys = ON')` right after opening the database.
- Migration framework: store a `migrations` table with `version` and `applied_at`; read `.sql` files from `src/main/db/migrations/`, sort by numeric prefix, and run pending migrations in a transaction.
- `electron-rebuild` (or `@electron/rebuild`) must run after installing better-sqlite3 to compile the native addon against Electron's ABI; for Node tests, run `npm rebuild better-sqlite3`.
- The `test` script can rebuild better-sqlite3 for Node automatically (`npm rebuild better-sqlite3 && vitest run`) so tests pass after `npm install`/`postinstall` has left the Electron binary.
- Use `fileParallelism: false` in `vitest.config.ts` when sharing a single database connection singleton across tests.
## T4: Type-safe IPC bridge

- Use `src/shared/ipc.ts` as the single source of truth for channel names and both main/render type contracts.
- Renderer API uses method names (`ping`) while internal handlers use namespaced channel names (`ipc:ping`) for traceability.
- `contextBridge.exposeInMainWorld` only exposes whitelisted functions; `contextIsolation: true` and `nodeIntegration: false` are enforced in `window.ts`.
- `registerIpcHandlers()` / `unregisterIpcHandlers()` in `src/main/ipc/index.ts` register typed `ipcMain.handle` handlers.
- Unit tests mock `electron` so they run in Node (Vitest) without a real Electron process.
- E2E test launches the built Electron app and verifies both isolation (`window.require` undefined) and the typed ping API.
- electron-vite preload build is configured to output `out/preload/preload.js` (CJS) so the runtime path matches `window.ts`.

## T3 - Testing infrastructure
- Keep the E2E shell minimal: a single `data-testid="app-shell"` container plus a heading is enough to prove the renderer boots without pulling in feature UI.
- For Playwright Electron tests, launching the built `out/main/main.js` is more stable than pointing at source TS once the app is bundled.
- Vitest config should keep a single `include` entry; duplicated keys are easy to miss and can hide config drift.

## T6 - Lists and tasks schema
- Versioned SQL migrations auto-discover by numeric filename, so adding `src/main/db/migrations/002_lists_and_tasks.sql` is enough for `runMigrations()` to apply the schema.
- SQLite `PRAGMA table_info` reports `INTEGER PRIMARY KEY` columns with `notnull: 0`; tests should assert primary-key status rather than expect `notnull: 1` for those columns.
- Keep row-shape types in `src/main/db/schema.ts` as plain interfaces only; repositories in T7/T8 can import these without exposing SQL to the renderer.

## T6 follow-up
- Test harness assertions should check the durable contract (migrations table exists) rather than a specific version number once additional migrations are added.

## T7/T8 - Task and list repositories with IPC
- Keep repository row types in `src/main/db/schema.ts`, and expose renderer-safe structural IPC types in `src/shared/ipc.ts` so the preload bridge stays typed without exposing the database connection.
- `better-sqlite3` transaction wrappers are a good fit for task sort-order updates; validate that every reordered task belongs to the target list before issuing any updates so rollback preserves the previous order.
- Preserve the existing ping IPC contract by re-exporting the new handler aggregator from `src/main/ipc/index.ts` while `main.ts` imports the concrete `src/main/ipc/handlers/index.ts` entrypoint.
- Repository tests should run migrations in a temp `TODO_USER_DATA_DIR`, then call `closeDb()` and remove the temp directory in `afterEach` to avoid singleton database bleed-through.

## T9+T10 - Base UI layout and state management
- When two independent hooks (`useLists` and `useTasks`) manage related data, the parent component must coordinate cross-hook refreshes. After any task mutation (create/update/delete/toggle), call `useLists.refresh()` to update sidebar task counts.
- `electron-vite` does NOT copy non-JS assets (like `.sql` migration files) to the output directory. A custom Vite plugin with `closeBundle()` hook that `cpSync`s the migrations dir to `out/main/chunks/migrations/` is needed for the built app to find its SQL files.
- E2E tests with Playwright Electron: `page.waitForFunction` with async callbacks doesn't reliably poll IPC calls. Use a `for` loop with `page.evaluate()` + `page.waitForTimeout()` instead.
- `npm test` rebuilds `better-sqlite3` for Node.js ABI; E2E tests need it rebuilt for Electron ABI. `pretest:e2e` must include `npx electron-rebuild --force` after `npm run build`.
- Playwright E2E tests sharing state across `test()` blocks: earlier tests can leave modals open that block clicks in later tests. Always clean up UI state (close forms) at the end of tests that open modals.
- CSS variables with `[data-theme='dark']` selector provide clean light/dark mode support without CSS-in-JS or heavy libraries. T14 just needs to toggle the `data-theme` attribute on `<html>`.

## T11 - Native notification reminders
- Store reminders in `tasks.reminder_at` (ISO string) and query `reminder_at <= ?` with `completed_at IS NULL` in `getTasksWithPendingReminders()`.
- The reminder scheduler should live in the main process, poll with `setInterval`, create a native Electron `Notification`, clear the reminder immediately after `show()`, and emit a `reminder:fired` event to the renderer.
- Use an env var (`REMINDER_POLL_INTERVAL_MS`) to speed up polling in E2E tests; default to a longer interval (e.g., 60s) in production.
- E2E automation of Electron notifications is unreliable. Treat the database side-effect (`reminder_at` becomes `NULL`) as the durable assertion and keep the IPC event listener as a secondary verification.
- Attach the renderer listener inside the same `page.evaluate()` call before the form save, then poll the task state via `window.electronAPI.tasks.getByListId()` until `reminder_at` is cleared.
- Avoid `page.waitForFunction` with async IPC callbacks in Playwright Electron; a polling loop with `page.evaluate()` and `page.waitForTimeout()` is more reliable.
- Reminder click handling: `Notification.on('click')` triggers an IPC `reminder:clicked` event that the renderer uses to select the task list.

## T11 follow-up - Scheduler timing boundary fix
- The `ReminderScheduler.check()` gate `reminderTime > this.lastCheckTime` caused reminders to be skipped forever when the `datetime-local` input truncated the reminder to a minute already passed by the scheduler's previous poll.
- Fix: fire any due reminder (`reminderTime <= now`) and rely on `clearReminder` to prevent double-firing. Removed the `lastCheckTime` field entirely.
- The unit-test mock for `createSchedulerDeps` now simulates clearing: `clearReminder` filters the reminder out of the pending list, so interval polls stop firing once the reminder is cleared.
- E2E reminder test now uses `toDatetimeLocal(new Date())` (current minute) instead of `new Date(Date.now() + 2000)`, making the reminder already due and eliminating the minute-boundary flake.
- Verification: `npm run typecheck` passes, `npm test` (69 tests) passes, `npm run test:e2e` (18 tests) passes.

## T14 - Dark/light theme mode with persistence
- Theme service lives in `src/renderer/services/theme.ts` as pure functions + a `useTheme` React hook.
- `localStorage` key `todolist-theme` stores the user's preference (`light`, `dark`, or `system`).
- Flash prevention: an inline `<script>` in `index.html` reads localStorage and sets `document.documentElement.dataset.theme` before React mounts.
- The `useTheme` hook initializes synchronously in `useState` initializer to avoid a flash even without the inline script.
- Mode cycling order: `system → light → dark → system`. The toggle button uses Unicode symbols (☾/☀/◐) instead of emoji or external icon libraries.
- System theme is only read at startup (per plan: "仅在启动时读取系统主题；运行期间不实时跟随系统变化"). No `matchMedia` listener is registered.
- E2E persistence test: close app, relaunch with same `TODO_USER_DATA_DIR`, verify `data-theme` attribute matches pre-restart value.
- Vitest `@vitest-environment jsdom` directive at the top of test files enables browser API testing without modifying vitest.config.ts glob patterns.
- `.main-header-actions` CSS class added to styles.css for flex layout of header action buttons (theme toggle + add task).

## T12+T13 - Drag-and-drop sorting and search/filter

### Drag-and-Drop (T12)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` provide the sortable list framework.
- `useSortableTasks` hook (`.tsx` extension required for JSX) wraps `DndContext`, `SortableContext`, and `verticalListSortingStrategy`. Returns a `DndProvider` component that wraps the task list.
- `SortableTaskItem` wraps `TaskItem` with `useSortable` from @dnd-kit, providing transform/transition styles and drag handle listeners.
- `TaskItem` accepts optional `dragHandleProps` (spread onto a drag handle button). When props are provided, a `⠿` drag handle appears on hover.
- `TaskList` accepts `onReorder` callback. When provided and tasks > 1, uses `SortableTaskItem` inside `DndProvider`. Otherwise falls back to plain `TaskItem`.
- Sort order persistence: on drag end, call `window.electronAPI.tasks.updateSortOrder(listId, taskIds)` with the new order. The `useTasks.refresh()` reconciles local state.
- Drag handle CSS: `opacity: 0` by default, `opacity: 1` on `.task-item:hover`. `cursor: grab` / `cursor: grabbing` for affordance. `touch-action: none` for pointer event handling.

### Search and Filter (T13)
- `useSearchAndFilter` hook takes `tasks` (from useTasks) and `selectedListId`. Returns filtered tasks, filter state, and setters.
- When no filters are active, returns the original tasks array (no IPC call). When filtering, debounces 200ms then calls `window.electronAPI.tasks.search(query, filters)`.
- `searchTasks` with empty query (`%%` LIKE pattern) matches all tasks, so it works for filter-only scenarios.
- Filters reset when `selectedListId` changes (prevents stale filters on list switch).
- `SearchBar` component: text input with clear button. `FilterBar` component: two select dropdowns (priority, status).
- `App.tsx` renders `search-filter-bar` between header and task list when a list is selected.
- Empty state: `emptyMessage` prop on `TaskList` shows "No tasks match your search" when filtering yields no results.

### E2E Testing
- Drag-and-drop UI interaction (mouse drag) is flaky in Playwright Electron. Better to test the durable contract: call `updateSortOrder` via IPC, verify order changes, verify persistence across restart.
- Search/filter E2E tests work reliably with `page.fill()` and `page.selectOption()` + `waitForTimeout(500)` for debounce.
- `createTask` helper must capture `countBefore` before creating the task, then assert `countBefore + 1` after.

## T15 - JSON/CSV import/export
- Implemented manual CSV parse/stringify; handles quoted commas and quotes but not arbitrary newlines in fields (acceptable for MVP).
- For E2E dialog automation, Playwright `electronApp.evaluate` cannot use dynamic `import()` in the ESM main process. Use a `globalThis.__dialogMock` set from the test and consumed by the IPC handler instead.
- Electron single-instance lock prevents two `electron.launch()` instances from running concurrently; close the first app and wait before launching a fresh instance for roundtrip tests.
- `page.waitForTimeout` throws after `electronApp.close()`; use `new Promise((r) => setTimeout(r, ms))` for post-close delays.


## T16 - macOS DMG packaging
- electron-builder with electron-vite: set `directories.output` to `dist`, `files` to `out/**/*`, `package.json`, and native module dependencies (`better-sqlite3`, `bindings`, `file-uri-to-path`).
- Use `asarUnpack: ['node_modules/better-sqlite3/**/*.node']` so the native binary is extracted from the asar archive and can be loaded by Node.
- Let electron-builder use its default `dmg.contents` layout; a manual `path: ToDoList.app` entry caused dmgbuild to fail with `FileNotFoundError` in this environment.
- The `mac.minimumSystemVersion` and `target: dmg` config are straightforward in `electron-builder.yml`.
- Set `hardenedRuntime: false` and `gatekeeperAssess: false` for v1.0 independent DMG without code signing/notarization.
- `TODO_USER_DATA_DIR` env override works in the packaged app, so the verification script can isolate user data to a temp directory and assert `todo.db` creation as proof that better-sqlite3 loaded.
- `hdiutil attach` output can include spaces in the mount point (e.g., `/Volumes/ToDoList 0.0.0-arm64`); parse with `awk -F'\\t'` rather than whitespace.
- Screenshot evidence can be captured with `screencapture -x` on macOS during verification.


## T17 - Windows EXE packaging
- Extend `electron-builder.yml` with a `win:` section; `target` can be an object `{ target: nsis, arch: x64 }`.
- Windows app icon: `win.icon: build/icon.ico` (defaults to this path anyway).
- `publisherName` is not a top-level `win` property; it belongs under `win.sign` for code signing. To disable code signing without skipping executable resource editing, use `win.signExecutable: false` (keep `signAndEditExecutable: true` / default).
- `win.signAndEditExecutable: false` skips executable resource editing entirely, which also skips applying the icon and metadata; prefer `signExecutable: false` when you still want the icon embedded.
- On this arm64 macOS, `electron-builder 26.15.3` bundles its own NSIS/7zip tools and successfully built the NSIS installer without requiring Wine.
- Use `png2icons` to generate a multi-resolution `icon.ico` from `build/icon.png` (CLI: `png2icons input.png output -icowe -i`).
- The `asarUnpack` rule for `better-sqlite3` applies cross-platform; Windows packaging rebuilt the module for `x64` ABI automatically.
- Running `npm run build:mac` after adding the Windows section still produced the DMG, confirming the two configurations coexist.

## T18 - Packaged macOS app integration and smoke test
- The integration test launches the packaged macOS app using `electron.launch({ executablePath: 'dist/mac-arm64/ToDoList.app/Contents/MacOS/ToDoList' })` rather than `out/main/main.js`.
- `TODO_USER_DATA_DIR` isolates the packaged app data; asserting `todo.db` exists in that dir proves better-sqlite3 loaded in the packaged build.
- The DMG fallback helper mounts the DMG with `hdiutil`, copies `ToDoList.app` to a temp dir, and detaches the DMG, so the test can run even when the unpacked `.app` is missing.
- Deleting all lists via the UI requires a single `page.on('dialog', dialog => dialog.accept())` listener because `ListSidebar` uses `window.confirm`.
- The pure-Node smoke test verifies the app launches, the DB is created, and a renderer page is reachable via `--remote-debugging-port`; full UI assertions remain the domain of the Playwright test.
- Windows EXE runtime testing cannot be performed on macOS; only the macOS DMG/.app is exercised here.

## T19 - Performance and edge-case checks
- Repository performance tests can wrap repeated `createTask` calls in `getDb().transaction(...)`; the singleton connection participates correctly and keeps the 1000-task seed under the 5s requirement.
- Added `countTasksByList(listId)` for an explicit count-query performance contract instead of inferring counts from full list reads.
- Packaged app performance can be measured with Playwright `chromium.connectOverCDP` against the Electron `--remote-debugging-port`; a direct SQLite seed into `TODO_USER_DATA_DIR/todo.db` lets the app launch with 1000 tasks already present.
- 1000-task packaged renderer scroll measured smooth on this machine (avg 8.2ms frame, worst 10.2ms), so `VirtualizedTaskList` was not added.
- Evidence generation: A standalone Playwright _electron script can capture screenshots without modifying E2E test files. Each capture uses a fresh temp user data dir to keep state isolated.
- Drag handles: Hovering over a task item reveals the drag handle for the screenshot.
- Theme toggle: Cycling the theme toggle until document.documentElement.dataset.theme === 'dark' reliably forces dark mode regardless of OS preference.

## 2026-07-15 - Lint cleanup
- `eslint.config.js` needs explicit flat-config globals for `scripts/**/*.js` and `src/__tests__/**/*.{ts,tsx}`; scripts are Node-oriented, while tests need both Node and browser globals for Playwright/Vitest coverage.
- Browser globals inside Playwright `page.evaluate` callbacks in Node scripts can be referenced through `globalThis` to satisfy ESLint without broadening script globals.

## Final QA evidence — 2026-07-15
- Evidence saved under `.sisyphus/evidence/final-qa/`: e2e run, integration run/screenshot, smoke/perf/edge outputs, manual scenario screenshots.
- Packaged Electron automation works reliably through Playwright `_electron.launch({ executablePath, env: { TODO_USER_DATA_DIR } })`; native file dialogs can be mocked with `globalThis.__dialogMock` in the Electron app context.

## F3 final QA rerun — 2026-07-15
- Required sequence avoided ABI issues: `npm run test:e2e` first, then `npm test` to rebuild `better-sqlite3` for Node, then `npx vitest run src/__tests__/perf/edge-cases.test.ts`.
- Smoke test passed on first attempt this rerun; no retry artifact was needed.
- Evidence for rerun is in `.sisyphus/evidence/final-qa/`: `e2e-full-run.txt`, `npm-test-node-rebuild.txt`, `edge-cases.txt`, `integration-run.txt`, `integration.png`, `smoke-test.txt`, `perf-report.txt`, `manual-scenarios.txt`, and manual screenshots.


## F4 rejection fixes — 2026-07-15
- List editing now reuses `ListForm` with `initialName`; pass the full list-name set as `existingNames` so duplicate validation remains consistent between create and edit.
- Theme persistence is now main-process owned: renderer calls `window.electronAPI.theme.*`, main uses Electron `nativeTheme.shouldUseDarkColors`, and SQLite `settings` stores the `theme` key.
- Adding a migration requires updating migration-version tests; the current settings migration is version 3.
- `scripts/perf-report.js` now writes separate memory evidence to `.sisyphus/evidence/task-19-memory-leak.txt` using CDP `Performance.getMetrics` before/after repeated scrolls.

- Git commit pass found this repo had no local commits, so commit style defaulted to semantic English; generated artifacts are ignored via `.gitignore` (`node_modules/`, `out/`, `dist/`, `test-results/`, `.sisyphus/test-results/`).
