# Repository Guidelines

## Project Overview

Offline-first, cross-platform desktop todo app: Electron 37 + React 18 + TypeScript 5.9 + SQLite (`better-sqlite3`). Features: task CRUD, custom lists, Eisenhower quadrant board, recurring tasks with end dates, reminders, drag-and-drop reordering, search/filter, JSON/CSV import/export, system-aware light/dark theme, keyboard + a11y support. No cloud, no account, no telemetry.

UI follows a Feishu/Lark-inspired token system in `src/renderer/styles.css`: brand `#1456F0`, neutral `N50`–`N900` scale, 8px grid. Theming is applied via `data-theme` on `<html>`. User-facing copy is Simplified Chinese（中文界面）— hardcoded string literals, no i18n framework; keep it that way (`lang="zh-CN"`, CJK font stack in `--font-family`).

## Architecture & Data Flow

Three-process Electron layout with a strict main/renderer split:

- **Main process** owns all persistence: synchronous `better-sqlite3` in `src/main/db/`, WAL + foreign keys on.
- **Renderer** is plain React — no Context, Redux, or Zustand; state is hook-local `useState`.
- **Communication** is exclusively typed IPC through `window.electronAPI` (exposed by `src/main/preload.ts`; `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`). Never expose Node APIs/`require` to the renderer; add new capability to the preload whitelist only.

Typical data flow (create task): `TaskForm` → `useTasks.createTask` → `window.electronAPI.tasks.create` → `ipcMain.handle('tasks:create')` → `createTask()` in `src/main/db/repositories/taskRepository.ts` → SQLite. After resolve, `useTasks.refresh()` refetches via `tasks:getByListId` and the list re-renders. Mutations are followed by refetch, never optimistic state.

**IPC contract single source of truth: `src/shared/ipc.ts`** defines `IPC_CHANNELS`, `IpcHandlers`, and `ElectronAPI`. Adding a channel requires all of:

1. Channel constant + types in `src/shared/ipc.ts`
2. Handler wiring in `src/main/ipc/handlers/<domain>.ts`
3. Entry in the registration array in `src/main/ipc/handlers/index.ts`
4. Exposure in `src/main/preload.ts`

**Recurrence:** completing a recurring task inside `updateTask` calls `generateNextRecurringInstance` (`src/main/db/repositories/taskRecurrence.ts`) and inserts the next instance in the same transaction. That file is the only place recurrence math lives (daily/weekly/monthly/yearly, end-date clamping, leap/month-end handling).

**Reminders:** `ReminderScheduler` polls pending reminders every 10s (override via `REMINDER_POLL_INTERVAL_MS`), shows an Electron `Notification`, clears `reminder_at`, then emits `reminder:fired`; clicking focuses the window and sends `reminder:clicked`.

## Key Directories

| Path | Purpose |
|---|---|
| `src/main/` | Main process: `main.ts` (lifecycle), `window.ts` (BrowserWindow factory), `preload.ts` |
| `src/main/ipc/handlers/` | Per-domain `ipcMain.handle` wiring: `tasks.ts`, `lists.ts`, `theme.ts`, `importExport.ts` |
| `src/main/db/` | `connection.ts`, `migrations.ts`, `repositories/` (`taskRepository`, `taskQueries`, `taskValidation`, `taskRecurrence`, `listRepository`), `migrations/*.sql` |
| `src/main/services/` | `theme.ts`, `reminderScheduler.ts`, `importExport.ts` + `importExportImport.ts` / `importExportHelpers.ts` |
| `src/renderer/` | React app: `App.tsx`, `main.tsx`, `components/`, `hooks/`, `services/theme.ts`, `types/global.d.ts` |
| `src/shared/` | Code imported by both processes: `ipc.ts` (contracts), `utils/dateValidator.ts` |
| `src/__tests__/` | All tests, mirrored by domain: `components/ db/ services/ main/ types/ perf/ renderer/ e2e/` |
| `scripts/` | Packaged-app verification: `smoke-test.js`, `perf-report.js`, `verify-mac-dmg.sh`, `verify-win-exe.sh` |
| `out/` | electron-vite build output — gitignored, never edit |
| `dist/` | electron-builder installers (DMG/NSIS) |

## Development Commands

npm only; Node 22 (CI pins it; no `engines` field in package.json).

| Command | Purpose |
|---|---|
| `npm run dev` | Dev mode with Vite HMR renderer |
| `npm run typecheck` | `tsc --noEmit` for main + renderer projects |
| `npm run lint` / `lint:fix` | ESLint (flat config, recommended rules only) |
| `npm run format` / `format:check` | Prettier (no semicolons, single quotes) |
| `npm test` | `npm rebuild better-sqlite3 && vitest run` — unit/component suite |
| `npm run test:ui` | Interactive Vitest UI |
| `npm run test:e2e` | `build` + `electron-rebuild --force` + Playwright |
| `npm run build` | electron-vite build → `out/` |
| `npm run build:mac` / `build:win` / `dist` | electron-builder packaging (DMG / NSIS x64 / both) |

CI (`release.yml`, on `v*` tags or `workflow_dispatch`) runs typecheck + lint + build + package only — **not** the test suites; run `npm test` locally before pushing. Release job attaches `dist/*` to a GitHub Release (signing optional via `CSC_LINK`, `APPLE_ID`, `WIN_CSC_LINK` secrets).

## Code Conventions & Common Patterns

- **TypeScript strict** everywhere. Composite project references: `tsconfig.main.json` (node types, no DOM) / `tsconfig.renderer.json` (DOM + `vite/client`), both excluding `src/__tests__` and each other. Alias: `@shared/*` → `src/shared/*` (tsconfig); Vitest also defines `@` → `./src`. Keep main code free of DOM globals and renderer code free of node-only APIs.
- **Naming:** files camelCase; IPC channels `domain:action` (`tasks:create`, `lists:getAll`, `import-export:exportJson`); SQL columns snake_case, IPC/DTO fields camelCase — `src/__tests__/types/taskContracts.test.ts` asserts the mapping compiles, so keep the two in sync.
- **Errors:** repositories/services `throw new Error('descriptive message')`; `ipcMain.handle` propagates as a rejected promise to the renderer, where hooks/components catch and display. No centralized error mapper. Validate in main (`taskValidation.validateTitle` — empty/>200 chars; `validateTaskDates` — ISO dates + order; `listRepository` rejects duplicate names), catch in renderer.
- **Async pattern:** `better-sqlite3` calls are synchronous inside repositories; the IPC handler wraps them in an async boundary. Use prepared statements and `db.transaction()` for multi-row writes (sort-order updates, recurring completion, import).
- **State:** hook-local `useState` only. `useTasks`/`useLists` expose CRUD + `refresh()`; always refetch after mutation. `useSearchAndFilter` debounces IPC search 200ms and falls back to the in-memory list when no filters are active. `useSortableTasks` (dnd-kit) reorders locally then persists via `tasks:updateSortOrder`.
- **Perf:** `TaskItem` and `SortableTaskItem` are `memo()`-wrapped — preserve that for long lists. Search is server-side over IPC, not a renderer filter.
- **Security:** `BrowserWindow` has `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; preload exposes only whitelisted `invoke`/`on` channels. Do not weaken any of this.
- **Test hooks in prod code:** DB path honors `TODO_USER_DATA_DIR` env; `E2E_TEST=1` (set by `playwright.config.ts`) disables the single-instance lock; import-export handlers support a test-only `globalThis.__dialogMock`. These are intentional — keep them.

## Important Files

- `src/shared/ipc.ts` — IPC channel constants, `IpcHandlers`, `ElectronAPI` type; start here for any new IPC surface
- `src/main/main.ts` — lifecycle: lazy DB init inside `whenReady`, single-instance lock (skipped under `E2E_TEST`), menu, scheduler start/stop, IPC registration
- `src/main/preload.ts` — the entire renderer-visible API surface
- `src/main/db/connection.ts` — `getDb()`/`closeDb()`; DB path order: `TODO_USER_DATA_DIR/todo.db` → `app.getPath('userData')/todo.db` → tmp fallback
- `src/main/db/migrations.ts` + `migrations/*.sql` — numeric-prefixed SQL migrations (currently 001–004) applied in order inside a transaction
- `src/main/db/repositories/` — `taskRepository.ts`, `taskQueries.ts` (dynamic filtered queries), `taskValidation.ts`, `taskRecurrence.ts`, `listRepository.ts`
- `src/main/services/reminderScheduler.ts`, `theme.ts`, `importExport*.ts`
- `src/renderer/App.tsx` — root orchestration: auto-selects first list, listens for `reminder:clicked` to switch list, toggles list/quadrant view
- `src/renderer/hooks/useTasks.ts`, `useLists.ts`, `useSearchAndFilter.ts` — renderer data layer
- `src/renderer/styles.css` — design-token CSS variables (theme via `data-theme`)
- `electron.vite.config.ts` — three targets (main/preload/renderer); `better-sqlite3` is external; plugin copies migrations SQL into `out/main/chunks/migrations`
- `electron-builder.yml` — `appId: com.example.todolist`, asar with `better-sqlite3` unpacked, DMG/NSIS-x64 targets

## Runtime/Tooling Preferences

- **npm with lockfile v3** — never pnpm/yarn. `npm ci` in CI.
- **Native module care:** `better-sqlite3` must match Electron's ABI. `postinstall` runs `electron-rebuild`; `npm test` rebuilds it first; after changing native deps or Electron versions run `npm rebuild better-sqlite3`. The module stays external to the Vite bundle and is `asarUnpack`ed at package time.
- Stack versions: Electron ^37.2, React ^18.3, TypeScript ^5.9, Vite ^5 via `electron-vite` ^2. ESM (`"type": "module"`); the preload build is forced to CJS.
- ESLint = `@eslint/js` + `typescript-eslint` recommended only, with per-directory globals (node for `src/main`/configs, browser for renderer, node+browser for tests). No custom rules. Prettier: `semi: false`, `singleQuote: true`. No lint-staged/husky.
- No coverage tooling or thresholds configured.

## Testing & QA

**Unit/component (Vitest):** `vitest.config.ts` — `globals: true`, `fileParallelism: false` (native DB state conflicts), jsdom only for `src/__tests__/components/**` via `environmentMatchGlobs`; everything else runs in node. Files: `src/__tests__/**/*.test.{ts,tsx}`, `@testing-library/react` + `user-event`.

- **Shared fixtures:** `src/__tests__/main/ipc.harness.ts` — `createTempUserDataDir(prefix)`, `createIpcHarness()` (in-memory handle/invoke map), `assertMigrationVersionTableExists()`.
- **DB test pattern:** copy the per-file dance — `mkdtemp` temp dir → set `process.env.TODO_USER_DATA_DIR` → `runMigrations()` in `beforeEach`; `closeDb()` + `rmSync` + unset env in `afterEach`. No global setup file exists.
- **Mocking:** `vi.mock('electron', ...)` for ipcMain/window tests; renderer tests stub `window.electronAPI` via `Object.defineProperty`; time via `vi.useFakeTimers({ toFake: ['setInterval', 'Date'] })` (reminder scheduler).
- **Component fixtures:** factory helpers (`createMockTask`, `makeTask`) spreading over a default `TaskRow`.

**E2E (Playwright, Electron app):** `src/__tests__/e2e/**/*.spec.ts`; `workers: 1`, `fullyParallel: false`, test timeout 30s, expect 5s. Launch is handled inside spec code (no `webServer`). Select via `data-testid` (e.g. `app-shell`, `task-item`); avoid class-name selectors. `pretest:e2e` rebuilds native modules first.

**Coverage expectations:** no coverage thresholds. `src/__tests__/perf/` encodes the perf contract: 1000-task create < 5s, search/count < 100ms, import < 5s — treat those as guarded invariants.

**Known quirks (don't chase ghosts):**

- Screenshot specs (`task3`–`task12`, `f3-*`) write evidence PNGs to `.omo/evidence/` / `.sisyphus/evidence/` with no pixel-diff assertions — human-review artifacts, not pass/fail.
- `f3-ui-redesign-verification.spec.ts` asserts exact design-token values (`#1456f0`, 8px multiples) and will break on any CSS refactor.
- `integration.spec.ts` mounts a DMG and self-skips when `dist/*.dmg` is missing — usually a no-op in dev.
- `task6-quadrant-screenshots.spec.ts` deliberately skips list-scoping: there is a documented pre-existing bug where the board view shows tasks from multiple lists.
- Several specs use hard `waitForTimeout(300–500ms)`; `reminder.spec.ts` polls up to 30s — can be flaky, rerun before blaming your change.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in this repo; use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles map 1:1 to labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.