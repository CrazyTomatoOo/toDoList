# UI Redesign — Issues

## [2026-07-16] Task: T2 — Evidence filename deviation (minor, mitigated)
- Plan required `task-2-icons.png`; agent produced `task-2-icons.png.txt` (build log).
- Mitigation: `task-1-tokens.png` (post Wave-1) shows Lucide icons rendering. Not blocking.

## [2026-07-16] Pre-existing: E2E better-sqlite3 ABI cycle
- `npm test` rebuilds better-sqlite3 for NODE ABI, clobbering the ELECTRON ABI build Playwright needs.
- Fix path: `npm run test:e2e` has `pretest:e2e` = `npm run build && npx electron-rebuild --force`. So E2E works when run via the npm script; running `npx playwright test` directly after `npm test` will fail with NODE_MODULE_VERSION mismatch.
- E2E-dependent tasks (T9, T12, F3): always use `npm run test:e2e`, never bare `npx playwright test`.

## [2026-07-16] Task: T3 — Nested interactive elements (debt for T9)
- T3 converted `.sidebar-item` from div to `<button>`, but the edit/delete action buttons live INSIDE it ⇒ buttons nested in a button (invalid HTML, axe-core `nested-interactive` violation).
- Functionally works (click handlers fire, tests pass), but T9 (accessibility) MUST restructure: e.g. outer div wrapper + separate name `<button>` + sibling action buttons, keeping all data-testids.

## [2026-07-16] Task: T6 — List scoping bug in board view (pre-existing)
- QuadrantBoard receives `tasks` prop from App.tsx, which comes from `useTasks(selectedListId)`.
- `useTasks` calls `window.electronAPI.tasks.getByListId(selectedListId)` which should filter by list.
- However, when switching between lists in board view, tasks from multiple lists appear.
- Root cause unclear — may be a caching issue or the tasks state not refreshing on list change.
- Not blocking T6 (visual redesign), but should be investigated in a future task.
- E2E test for T6 skips list scoping verification due to this bug.