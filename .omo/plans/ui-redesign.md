# ui-redesign - Work Plan

## TL;DR (For humans)

**What you'll get:** A complete visual redesign of the todo app to match the Feishu/Lark modern enterprise aesthetic. The app gets a neutral gray palette with subtle blue accents (#1456F0), an 8px spacing grid, clearer typography hierarchy, card-based surfaces, precise text/UI alignment, and Lucide icons. All renderer screens (sidebar, task list, task form, quadrant board, import/export, theme toggle) are restyled. Dark mode is preserved.

**Why this approach:** We replace the current ad-hoc CSS with a token-driven design system derived from Feishu/Lark specs. We keep the existing sidebar + main-area layout for lower risk, restyle every component, and use Lucide icons for consistency. Performance and accessibility are preserved or improved.

**What it will NOT do:** It will not change backend logic, DB schema, or IPC contracts. It will not add new features, animations, or a custom font. It will not switch to a top-nav workspace layout. It will not introduce list virtualization.

**Effort:** High

**Risk:** High - touches every renderer file and CSS; the main risks are visual regression, maintaining keyboard/accessibility parity, and keeping dark mode consistent.

**Decisions to sanity-check:** Feishu/Lark style (#1456F0, N50-N900, 8px grid), Lucide React icons, keep sidebar layout, refactor all renderer UI, memoize task rows and stabilize filter state.

Your next move: approve the plan, or ask for adjustments. Execution is done in a separate worker session.

---

> TL;DR (machine): High effort / High risk - full renderer UI redesign to Feishu/Lark style; replace CSS tokens, restyle all components, integrate Lucide icons, preserve dark mode and accessibility, memoize task rows and stabilize filter state; no backend changes; no virtualization.

## Scope

### Must have

1. Replace CSS design tokens with a Feishu/Lark-derived palette (#1456F0 brand, N50-N900 neutral structure with blue tint, 8px grid), typography scale, shadows, and border radii in `src/renderer/styles.css`. Adjust neutral hex values for dark-mode contrast as needed. Ensure every `var(--x)` used in the stylesheet is defined in both `:root` and `[data-theme='dark']`.
2. Integrate Lucide React icons and replace all text icons (☾, ☀, ◐, ✎, ×, +, ⠿) in `src/renderer/App.tsx`, `src/renderer/components/TaskItem.tsx`, `src/renderer/components/ListSidebar.tsx`, `src/renderer/components/SearchBar.tsx`, `src/renderer/components/TaskForm.tsx`, `src/renderer/components/ListForm.tsx`.
3. Redesign sidebar (`src/renderer/components/ListSidebar.tsx`) with cleaner active/hover states, better spacing, semantic buttons, and redesigned empty/loading states.
4. Redesign main header and view toggle (`src/renderer/App.tsx`) with Feishu-style buttons and layout.
5. Redesign task list and task item (`src/renderer/components/TaskList.tsx`, `TaskItem.tsx`, `SortableTaskItem.tsx`) with baseline-aligned text, better metadata hierarchy, improved drag handle, hover/focus action visibility, and redesigned empty/loading/error states.
6. Redesign quadrant board (`src/renderer/components/QuadrantBoard.tsx`) with consistent quadrant cards, headers, task density, and redesigned empty states.
7. Redesign forms (`src/renderer/components/TaskForm.tsx`, `ListForm.tsx`) with new spacing, validation presentation, modal behavior, and restyled reminder field.
8. Redesign buttons, inputs, selects, badges, and modals in `src/renderer/styles.css` and component files.
9. Redesign theme toggle and import/export buttons to match the new design.
10. Preserve and improve accessibility: keyboard navigation, focus management, ARIA, contrast, and screen-reader support.
11. Add React.memo to `TaskItem` and `SortableTaskItem`; stabilize callbacks in `TaskList`; memoize `taskIds` in `useSortableTasks`; stabilize `listeners` pass-through in `SortableTaskItem`; fix `useSearchAndFilter` derived-state churn.
12. Update component tests and E2E tests to assert the new design and behavior, including a re-render count test proving memoization works.
13. All existing unit, integration, and E2E tests must pass.

### Must NOT have (guardrails, anti-slop, scope boundaries)

- No backend/DB/IPC changes.
- No new features (no new views, no animations, no undo system, no toast notifications).
- No custom font files; keep system font stack.
- Dark mode uses the same token structure with adjusted neutral hex values for contrast.
- No external UI component libraries (no shadcn, Material, Ant Design).
- No changes to business logic or data flow beyond UI presentation.
- Preserve existing `data-testid` attributes unless a component's structure fundamentally changes; update E2E tests only when necessary.
- No list virtualization.
- New dependencies allowed only: `lucide-react`, `@axe-core/playwright`.

## Verification strategy

> Zero human intervention - all verification is agent-executed.

- **Test decision:** Tests-after for visual redesign; update existing component tests to assert new class names/structures/ARIA, and add E2E tests for visual consistency and keyboard navigation. Agent-executed QA for every todo.
- **Frameworks:** Vitest for unit/component, Playwright for E2E, `@testing-library/react` for component tests.
- **Evidence path:** `.omo/evidence/ui-redesign/task-<N>-<scenario>.<ext>` for each todo scenario.
- **Failure policy:** Any failing test, type error, or lint error blocks the todo and the final verification wave.

## Execution strategy

### Parallel execution waves

```
Wave 1 (Foundation):
├── T1: Design tokens & CSS system
└── T2: Lucide icon integration

Wave 2 (Layout):
├── T3: Sidebar & main shell redesign
└── T4: View toggle & header redesign

Wave 3 (Feature views, sequential):
├── T5: Task list & item redesign
├── T6: Quadrant board redesign
└── T7: Form redesign

Wave 4 (Polish, sequential):
├── T8: Theme toggle & import/export polish
├── T9: Accessibility fixes
└── T10: Performance memoization

Wave 5 (Tests, sequential):
├── T11: Component tests
└── T12: E2E tests

Wave 6 (Final verification):
└── T13: Final verification wave (F1-F4)

Critical path: T1 → T3 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13
Max parallel: Wave 1/2 (2 todos)
```
Wave 1 (Foundation):
├── T1: Design tokens & CSS system
└── T2: Lucide icon integration

Wave 2 (Layout):
├── T3: Sidebar & main shell redesign
└── T4: View toggle & header redesign

Wave 3 (Feature views):
├── T5: Task list & item redesign
├── T6: Quadrant board redesign
└── T7: Form redesign

Wave 4 (Polish):
├── T8: Theme toggle & import/export polish
├── T9: Accessibility fixes
└── T10: Performance memoization

Wave 5 (Tests):
├── T11: Component tests
└── T12: E2E tests

Wave 6 (Final verification):
└── T13: Final verification wave (F1-F4)

Critical path: T1 → T3/T4 → T5/T6/T7 → T8/T9/T10 → T11/T12 → T13
Max parallel: Wave 3 (3 todos)
```

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 | - | T3, T4, T5, T6, T7, T8, T9, T10 | T2 |
| T2 | - | T3, T4, T5, T6, T7, T8, T9, T10 | T1 |
| T3 | T1, T2 | T5, T7, T8, T9, T10 | T4 |
| T4 | T1, T2 | T5, T7, T8, T9, T10 | T3 |
| T5 | T1, T2, T3, T4 | T6, T7, T8, T9, T10 | - |
| T6 | T1, T2, T3, T4, T5 | T7, T8, T9, T10 | - |
| T7 | T1, T2, T3, T4, T5, T6 | T8, T9, T10 | - |
| T8 | T1, T2, T3, T4, T5, T6, T7 | T9, T10, T11, T12, T13 | - |
| T9 | T1, T2, T3, T4, T5, T6, T7, T8 | T10, T11, T12, T13 | - |
| T10 | T1, T2, T3, T4, T5, T6, T7, T8, T9 | T11, T12, T13 | - |
| T11 | T1-T10 | T12, T13 | - |
| T12 | T1-T10, T11 | T13 | - |
| T13 | T1-T12 | - | - |
| --- | --- | --- | --- |
| T1 | - | T3, T4, T5, T6, T7, T8, T9, T10 | T2 |
| T2 | - | T3, T4, T5, T6, T7, T8, T9, T10 | T1 |
| T3 | T1, T2 | T5, T7, T8, T9, T10 | T4 |
| T4 | T1, T2 | T5, T7, T8, T9, T10 | T3 |
| T5 | T1, T2, T3, T4 | T8, T9, T10 | T6, T7 |
| T6 | T1, T2, T3, T4 | T8, T9, T10 | T5, T7 |
| T7 | T1, T2, T3, T4 | T8, T9, T10 | T5, T6 |
| T8 | T1, T2, T3, T4, T5, T6, T7 | T11, T12, T13 | T9, T10 |
| T9 | T1, T2, T3, T4, T5, T6, T7 | T11, T12, T13 | T8, T10 |
| T10 | T1, T2, T3, T4, T5, T6, T7 | T11, T12, T13 | T8, T9 |
| T11 | T1-T10 | T12, T13 | - |
| T12 | T1-T10 | T13 | - |
| T13 | T1-T12 | - | - |

## Todos

> Implementation + Test = ONE todo. Never separate.

- [x] 1. Design tokens & CSS system
  What to do / Must NOT do: Replace `src/renderer/styles.css` design tokens with Feishu/Lark-style palette (#1456F0 brand, N50-N900 neutrals with blue tint, 8px grid). Define typography scale (font sizes 11/12/13/14/16/18/20/24, weights 400/500/600, line heights), shadows, border radii, and interaction state opacities (hover N900 8%, press N900 12%). Restyle base elements: buttons, inputs, selects, textareas, checkboxes. Update dark mode tokens. Add fallback values for critical tokens (e.g., `var(--color-bg, #ffffff)`). Ensure every `var(--x)` used in the stylesheet is defined in both `:root` and `[data-theme='dark']`. Must NOT change component logic, only CSS; must NOT remove existing CSS class names used by components or tests.
  Parallelization: Wave 1 | Blocked by: - | Blocks: T3, T4, T5, T6, T7, T8, T9, T10
  References (executor has NO interview context - be exhaustive): `src/renderer/styles.css` (full file), `src/renderer/App.tsx` (class usage), Feishu/Lark color spec (N50-N900, #1456F0), `src/renderer/components/*.tsx` (class usage)
  Acceptance criteria (agent-executable): `npm run typecheck` passes; `npm run lint` passes; CSS variables for N50-N900, brand, spacing, typography, shadows, and radii are defined in `:root` and `[data-theme='dark']`; a script or grep confirms every `var(--x)` used in `styles.css` is defined in both modes; no component file changes are needed for the app to render.
  QA scenarios (name the exact tool + invocation): Happy - run `npm run dev`, take screenshot of the app shell with new tokens; evidence `.omo/evidence/ui-redesign/task-1-tokens.png`. Failure - temporarily remove `--color-bg` and verify the app renders with the defined fallback color; evidence `.omo/evidence/ui-redesign/task-1-tokens-failure.png`.
  Commit: Y | feat(ui): replace CSS tokens with Feishu/Lark design system

- [x] 2. Lucide icon integration
  What to do / Must NOT do: Install `lucide-react`. Replace all text icons with Lucide components in `src/renderer/App.tsx` (theme toggle: Moon/Sun/Monitor), `src/renderer/components/TaskItem.tsx` (edit: Edit2, delete: Trash2, drag handle: GripVertical), `src/renderer/components/ListSidebar.tsx` (add: Plus, edit: Edit2, delete: Trash2), `src/renderer/components/SearchBar.tsx` (clear: X), `src/renderer/components/TaskForm.tsx` (close: X), `src/renderer/components/ListForm.tsx` (close: X if any). Use consistent size (16px for small, 20px for default). Must NOT add other icon libraries; must NOT change component logic.
  Parallelization: Wave 1 | Blocked by: - | Blocks: T3, T4, T5, T6, T7, T8, T9, T10
  References (executor has NO interview context - be exhaustive): `src/renderer/App.tsx:178-186`, `src/renderer/components/TaskItem.tsx:53-61, 106-123`, `src/renderer/components/ListSidebar.tsx:50-124`, `src/renderer/components/SearchBar.tsx:18-27`, `src/renderer/components/TaskForm.tsx:128-130`, `package.json`
  Acceptance criteria (agent-executable): `npm run typecheck` passes; `npm run lint` passes; no text icons remain in the specified files; `lucide-react` is added to `package.json` dependencies; icons render at the specified sizes.
  QA scenarios (name the exact tool + invocation): Happy - run `npm run dev`, verify icons render correctly in light/dark mode; evidence `.omo/evidence/ui-redesign/task-2-icons.png`. Failure - remove `lucide-react` import and verify typecheck fails; evidence `.omo/evidence/ui-redesign/task-2-icons-failure.txt`.
  Commit: Y | feat(icons): integrate Lucide React icons

- [x] 3. Sidebar & main shell redesign
  What to do / Must NOT do: Redesign `src/renderer/components/ListSidebar.tsx` to use semantic `<button>` elements for list items (with `aria-pressed`/`aria-current`), cleaner active/hover states (N900 8% hover, accent light active), better spacing, and Lucide icons. Redesign the sidebar empty/loading states. Update `src/renderer/App.tsx` main shell spacing and background colors to match the new palette. Must NOT change list selection logic, IPC calls, or list CRUD handlers.
  Parallelization: Wave 2 | Blocked by: T1, T2 | Blocks: T5, T7, T8, T9, T10
  References (executor has NO interview context - be exhaustive): `src/renderer/components/ListSidebar.tsx` (full file), `src/renderer/App.tsx:143-152`, `src/renderer/styles.css:175-300`, `src/renderer/hooks/useSelectedList.ts`
  Acceptance criteria (agent-executable): `npm run typecheck` passes; sidebar items are `<button>` elements; active state is announced to screen readers; empty/loading states use the new card treatment; visual spacing matches Feishu/Lark spec; no regression in list selection E2E tests.
  QA scenarios (name the exact tool + invocation): Happy - run `npm run dev`, navigate sidebar with keyboard and mouse; evidence `.omo/evidence/ui-redesign/task-3-sidebar.png`. Failure - click a sidebar item and verify the wrong list does not become active; evidence `.omo/evidence/ui-redesign/task-3-sidebar-failure.png`.
  Commit: Y | feat(ui): redesign sidebar and main shell

- [x] 4. View toggle & header redesign
  What to do / Must NOT do: Redesign the view toggle in `src/renderer/App.tsx` to use the new button styles (segmented control look with N300 border and accent active state). Restyle the main header with Feishu-style typography (font-size-lg/semibold), spacing, and action buttons. Replace the Add Task button with a primary button using Lucide Plus icon. Must NOT change view mode state logic or list selection.
  Parallelization: Wave 2 | Blocked by: T1, T2 | Blocks: T5, T7, T8, T9, T10
  References (executor has NO interview context - be exhaustive): `src/renderer/App.tsx:154-201`, `src/renderer/styles.css:310-331, 409-416`, `src/renderer/components/ImportExportButtons.tsx`
  Acceptance criteria (agent-executable): `npm run typecheck` passes; view toggle has correct active/pressed states; header uses new typography and spacing; Add Task button uses Lucide Plus; E2E view-toggle tests pass.
  QA scenarios (name the exact tool + invocation): Happy - run `npm run dev`, toggle between list and board views; evidence `.omo/evidence/ui-redesign/task-4-header.png`. Failure - verify view toggle does not switch when clicking disabled state; evidence `.omo/evidence/ui-redesign/task-4-header-failure.png`.
  Commit: Y | feat(ui): redesign view toggle and main header

- [x] 5. Task list & item redesign
  What to do / Must NOT do: Redesign `src/renderer/components/TaskItem.tsx` with baseline-aligned text, better metadata hierarchy (title → meta row), improved completed state, and Lucide icons for actions. Redesign `src/renderer/components/TaskList.tsx` and `SortableTaskItem.tsx` to match the new row layout. Add hover/focus visibility for actions (opacity 0 → 1 on hover/focus-within). Redesign the task-list empty/loading/error states. Restyle FilterBar and SearchBar to match the new design. Update styles in `src/renderer/styles.css`. Must NOT change task data flow, reorder logic, or filtering logic.
  Parallelization: Wave 3 | Blocked by: T1, T2, T3, T4 | Blocks: T6, T7, T8, T9, T10
  References (executor has NO interview context - be exhaustive): `src/renderer/components/TaskItem.tsx` (full file), `src/renderer/components/TaskList.tsx` (full file), `src/renderer/components/SortableTaskItem.tsx` (full file), `src/renderer/components/FilterBar.tsx`, `src/renderer/components/SearchBar.tsx`, `src/renderer/styles.css:418-570, 665-754`
  Acceptance criteria (agent-executable): `npm run typecheck` passes; task items render with new layout and icons; actions are visible on hover and focus-within; empty/loading/error states use the new card treatment; drag handle is present and styled; existing E2E task-crud tests pass.
  QA scenarios (name the exact tool + invocation): Happy - run `npm run dev`, create/edit/delete/toggle tasks; evidence `.omo/evidence/ui-redesign/task-5-tasklist.png`. Failure - complete a task and verify the title does not incorrectly lose strikethrough; evidence `.omo/evidence/ui-redesign/task-5-tasklist-failure.png`.
  Commit: Y | feat(ui): redesign task list and task item

- [x] 6. Quadrant board redesign
  What to do / Must NOT do: Redesign `src/renderer/components/QuadrantBoard.tsx` with consistent quadrant cards (N300 borders, subtle shadows, rounded corners), clear headers, task density, and redesigned empty states. Ensure task items within quadrants use the new `TaskItem` styles. Must NOT change quadrant grouping logic, list scoping, or task edit/toggle handlers.
  Parallelization: Wave 3 | Blocked by: T1, T2, T3, T4, T5 | Blocks: T7, T8, T9, T10
  References (executor has NO interview context - be exhaustive): `src/renderer/components/QuadrantBoard.tsx` (full file), `src/renderer/styles.css:780-871`, `src/renderer/components/TaskItem.tsx`
  Acceptance criteria (agent-executable): `npm run typecheck` passes; quadrants render as cards with headers; empty quadrants use the new card treatment; tasks within quadrants use new styles; existing E2E quadrant tests pass.
  QA scenarios (name the exact tool + invocation): Happy - run `npm run dev`, switch to board view and verify task placement; evidence `.omo/evidence/ui-redesign/task-6-quadrant.png`. Failure - verify tasks from other lists do not appear in the board; evidence `.omo/evidence/ui-redesign/task-6-quadrant-failure.png`.
  Commit: Y | feat(ui): redesign quadrant board

- [x] 7. Form redesign
  What to do / Must NOT do: Redesign `src/renderer/components/TaskForm.tsx` and `ListForm.tsx` with new spacing, validation presentation (field-level errors with `aria-live`), and modal behavior (dialog semantics, focus trap, Escape-to-close, focus restoration). Replace text close buttons with Lucide X. Restyle the reminder `datetime-local` field. Update styles in `src/renderer/styles.css`. Must NOT change form submission logic, validation rules, or IPC calls.
  Parallelization: Wave 3 | Blocked by: T1, T2, T3, T4, T5, T6 | Blocks: T8, T9, T10
  References (executor has NO interview context - be exhaustive): `src/renderer/components/TaskForm.tsx` (full file), `src/renderer/components/ListForm.tsx` (full file), `src/renderer/styles.css:570-648`, `src/renderer/components/RecurrenceFields.tsx`, `src/renderer/components/DurationFields.tsx`, `src/renderer/components/QuadrantFlags.tsx`
  Acceptance criteria (agent-executable): `npm run typecheck` passes; modal has `role="dialog"` and `aria-modal="true"`; focus is trapped and restored; Escape closes the modal; field-level errors are announced; reminder field is restyled; existing E2E form tests pass.
  QA scenarios (name the exact tool + invocation): Happy - run `npm run dev`, open/close task form with keyboard and mouse; evidence `.omo/evidence/ui-redesign/task-7-form.png`. Failure - submit invalid dates and verify field-level error is shown; evidence `.omo/evidence/ui-redesign/task-7-form-failure.png`.
  Commit: Y | feat(ui): redesign task and list forms

- [x] 8. Theme toggle & import/export polish
  What to do / Must NOT do: Restyle `src/renderer/App.tsx` theme toggle to use Lucide icons (Moon/Sun/Monitor) and new button styles. Restyle `src/renderer/components/ImportExportButtons.tsx` to match the new design. Must NOT change import/export logic or theme persistence.
  Parallelization: Wave 4 | Blocked by: T1, T2, T3, T4, T5, T6, T7 | Blocks: T9, T10, T11, T12, T13
  References (executor has NO interview context - be exhaustive): `src/renderer/App.tsx:178-186`, `src/renderer/components/ImportExportButtons.tsx` (full file), `src/renderer/services/theme.ts`, `src/main/services/theme.ts`
  Acceptance criteria (agent-executable): `npm run typecheck` passes; theme toggle uses Lucide icons; import/export buttons match new styles; E2E theme tests pass.
  QA scenarios (name the exact tool + invocation): Happy - run `npm run dev`, toggle theme and export data; evidence `.omo/evidence/ui-redesign/task-8-polish.png`. Failure - verify theme does not switch on import/export click; evidence `.omo/evidence/ui-redesign/task-8-polish-failure.png`.
  Commit: Y | feat(ui): polish theme toggle and import/export buttons

- [x] 9. Accessibility fixes
  What to do / Must NOT do: Fix all accessibility issues identified in the audit: add `role="dialog"`, `aria-modal`, `aria-labelledby` to `TaskForm`; implement focus trap, Escape-to-close, and focus restoration; add accessible name to `TaskItem` checkbox (e.g., `aria-label="Mark {title} complete"`); make `TaskItem` body click keyboard-accessible or remove it; add `aria-pressed`/`aria-current` to `ListSidebar` buttons; ensure all hover-only actions are also revealed on focus-within; add `role="status"`/`aria-live="polite"` to loading and `role="alert"` to errors; ensure color contrast meets WCAG 2.1 AA. Verification is scripted: use Playwright keyboard-traversal and `@axe-core/playwright` accessibility scans. Must NOT change visual design beyond accessibility requirements; must NOT use manual audits.
  Parallelization: Wave 4 | Blocked by: T1, T2, T3, T4, T5, T6, T7, T8 | Blocks: T10, T11, T12, T13
  References (executor has NO interview context - be exhaustive): `src/renderer/components/TaskForm.tsx:124-268`, `src/renderer/components/TaskItem.tsx:63-78, 106-123`, `src/renderer/components/ListSidebar.tsx:84-125`, `src/renderer/components/TaskList.tsx:97-115`, `src/renderer/styles.css:245-256, 559-568, 742-749`, `package.json`
  Acceptance criteria (agent-executable): `npm run typecheck` passes; Playwright keyboard-traversal test asserts correct focus order; `@axe-core/playwright` scan returns zero violations; all interactive elements have accessible names; focus is visible on all controls; contrast ratios are documented in evidence.
  QA scenarios (name the exact tool + invocation): Happy - run `npm run test:e2e -- accessibility.spec.ts` (create if needed) with keyboard traversal and axe-core; evidence `.omo/evidence/ui-redesign/task-9-a11y.txt`. Failure - tab to a hidden action and verify it is not reachable; evidence `.omo/evidence/ui-redesign/task-9-a11y-failure.txt`.
  Commit: Y | feat(a11y): fix accessibility issues in redesigned UI

- [x] 10. Performance memoization
  What to do / Must NOT do: Add `React.memo` to `TaskItem` and `SortableTaskItem`. Stabilize `handleEditClick` in `TaskList` with `useCallback`. Memoize `taskIds` in `useSortableTasks` with `useMemo`. Stabilize `listeners` pass-through in `SortableTaskItem` (or restructure to avoid fresh object identity). Fix `useSearchAndFilter` derived-state churn by removing the `filteredTasks` mirror when not filtering. Must NOT change drag-and-drop behavior, list ordering, or filtering logic; must NOT introduce virtualization.
  Parallelization: Wave 4 | Blocked by: T1, T2, T3, T4, T5, T6, T7, T8, T9 | Blocks: T11, T12, T13
  References (executor has NO interview context - be exhaustive): `src/renderer/components/TaskItem.tsx`, `src/renderer/components/SortableTaskItem.tsx`, `src/renderer/components/TaskList.tsx:38-45, 83-85, 116-141`, `src/renderer/hooks/useSearchAndFilter.ts:39-67, 69-126`, `src/renderer/hooks/useSortableTasks.tsx:24-92`, `package.json`
  Acceptance criteria (agent-executable): `npm run typecheck` passes; `TaskItem` and `SortableTaskItem` are memoized; `taskIds` is memoized; no derived-state churn in `useSearchAndFilter`; a re-render count test asserts only the toggled row re-renders; existing E2E drag-sort tests pass.
  QA scenarios (name the exact tool + invocation): Happy - run `npm test` with a re-render count test proving memoization; evidence `.omo/evidence/ui-redesign/task-10-perf.txt`. Failure - remove `React.memo` from `TaskItem` and verify the re-render count test fails; evidence `.omo/evidence/ui-redesign/task-10-perf-failure.txt`.
  Commit: Y | perf(ui): memoize task rows and stabilize filter state

- [x] 11. Component tests
  What to do / Must NOT do: Update existing component tests in `src/__tests__/components/` to assert new class names, icon components, and ARIA attributes. Add tests for focus trap, Escape-to-close, and keyboard navigation in `TaskForm`. Add tests for `ListSidebar` semantic buttons. Add tests for `TaskItem` accessibility labels. Update `FilterBar.test.tsx` for the restyled FilterBar. Add a re-render count test proving memoization works. Must NOT break existing test infrastructure.
  Parallelization: Wave 5 | Blocked by: T1-T10 | Blocks: T12, T13
  References (executor has NO interview context - be exhaustive): `src/__tests__/components/App.test.tsx`, `src/__tests__/components/TaskItem.test.tsx`, `src/__tests__/components/TaskList.test.tsx`, `src/__tests__/components/TaskForm.test.tsx`, `src/__tests__/components/ListSidebar.test.tsx`, `src/__tests__/components/QuadrantBoard.test.tsx`, `src/__tests__/components/FilterBar.test.tsx`
  Acceptance criteria (agent-executable): `npm test src/__tests__/components/` passes with no failures; new ARIA/focus/re-render tests are included.
  QA scenarios (name the exact tool + invocation): Happy - run `npm test src/__tests__/components/`; evidence `.omo/evidence/ui-redesign/task-11-components.txt`. Failure - temporarily change an ARIA attribute and verify the test fails; evidence `.omo/evidence/ui-redesign/task-11-components-failure.txt`.
  Commit: Y | test(components): update component tests for redesigned UI

- [x] 12. E2E tests
  What to do / Must NOT do: Update all E2E tests in `src/__tests__/e2e/` to work with the new UI (new class names, icons, layout). Add E2E tests for visual consistency (screenshots saved as evidence, no baseline management), keyboard navigation, and dark mode parity. Must NOT remove existing test coverage.
  Parallelization: Wave 5 | Blocked by: T1-T10, T11 | Blocks: T13
  References (executor has NO interview context - be exhaustive): all specs in `src/__tests__/e2e/`, especially `task-crud.spec.ts`, `search-filter.spec.ts`, `quadrant.spec.ts`, `theme.spec.ts`, `list-management.spec.ts`, `drag-sort.spec.ts`, `import-export.spec.ts`, `reminder.spec.ts`, `recurring.spec.ts`, `integration.spec.ts`, `playwright.config.ts`
  Acceptance criteria (agent-executable): `npm run test:e2e` passes with no failures; new visual/keyboard/dark-mode tests are included.
  QA scenarios (name the exact tool + invocation): Happy - run `npm run test:e2e`; evidence `.omo/evidence/ui-redesign/task-12-e2e.txt`. Failure - temporarily change a selector and verify the test fails; evidence `.omo/evidence/ui-redesign/task-12-e2e-failure.txt`.
  Commit: Y | test(e2e): update E2E tests for redesigned UI

- [x] 13. Final verification wave (F1-F4)
  What to do / Must NOT do: Run the four final reviews: F1 plan compliance audit, F2 code quality review, F3 automated E2E scenario execution, F4 scope fidelity. Must NOT skip any review; must NOT declare complete if any review fails. F3 must be performed by Playwright with exact selectors and assertions, not by a human.
  Parallelization: Wave 6 | Blocked by: T1-T12 | Blocks: -
  References (executor has NO interview context - be exhaustive): `.omo/plans/ui-redesign.md` (this plan), `src/__tests__/` (all tests), `package.json` (scripts)
  Acceptance criteria (agent-executable): All four reviews return APPROVE with receipts recorded in `.omo/evidence/ui-redesign/final-review.txt`.
  QA scenarios (name the exact tool + invocation): Happy - F1-F4 all APPROVE; evidence `.omo/evidence/ui-redesign/task-13-final-review.txt`. Failure - if any review fails, record the issue, fix it, and re-run the review; evidence `.omo/evidence/ui-redesign/task-13-fix-<n>.txt`.
  Commit: N | -

## Final verification wave

> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.

- [x] F1. Plan compliance audit: Verify every Must Have is implemented, every Must NOT Have is absent, and evidence files exist for each todo.
- [x] F2. Code quality review: Run `npm run typecheck`, `npm run lint`, and `npm test`; inspect for `as any`, empty catches, `console.log` in production, and AI slop.
- [x] F3. Automated E2E scenario execution: Execute every E2E scenario from the todo list with Playwright, test edge cases (empty state, invalid dates, rapid toggles), and capture screenshots. Assert computed styles for brand color #1456F0, N-scale neutrals, and 8px-multiple paddings on key surfaces.
- [x] F4. Scope fidelity: Compare actual diffs against the plan; flag any unaccounted changes or scope creep.

## Commit strategy

- Use atomic commits, one per todo.
- Commit message format: `type(scope): description` (e.g., `feat(ui): ...`, `feat(icons): ...`, `test(e2e): ...`).
- Before each commit, run `npm run typecheck` and the relevant tests.
- Keep the feature branch focused on the UI redesign; do not mix unrelated refactors.

## Success criteria

- `npm run typecheck` passes with no errors.
- `npm run lint` passes with no errors.
- `npm test` passes (all unit and integration tests).
- `npm run test:e2e` passes (all E2E tests, including new ones).
- Primary buttons use brand color #1456F0; surfaces use N50-N200 neutrals; paddings are 8px multiples on key containers.
- Dark mode is consistent with the new palette.
- All accessibility issues from the audit are resolved (zero axe-core violations).
- Re-render count test proves memoization isolates row re-renders.
- Final verification wave (F1-F4) all approve.
