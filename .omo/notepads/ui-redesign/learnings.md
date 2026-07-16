# UI Redesign Learnings

## [2026-07-16 19:06:28] Task: T2 - Lucide Icon Integration

**Icon replacements completed:**
- App.tsx: ☾/☀/◐ → Moon/Sun/Monitor (size={20})
- TaskItem.tsx: ⠿ → GripVertical (size={16}), ✎ → Edit2 (size={16}), × → Trash2 (size={16})
- ListSidebar.tsx: + → Plus (size={20}), ✎ → Edit2 (size={16}), × → Trash2 (size={16})
- SearchBar.tsx: × → X (size={16})
- TaskForm.tsx: × → X (size={20})
- ListForm.tsx: No text icons present (skipped)

**Decisions:**
- ListSidebar.tsx line 70: "Click + to create one." — kept as prose (not an icon usage)
- All icon-only buttons preserved existing aria-labels (theme-toggle, task-edit-button, task-delete-button, task-drag-handle, add-list-button, sidebar-item-edit, sidebar-item-delete, search-clear, task-form-close)
- No test changes required — tests use data-testid selectors, not text content

**Verification:**
- typecheck: exit 0
- lint: exit 0
- tests: 217/217 passed
- Zero text-icon characters remain in src/renderer (verified via grep)
# UI Redesign — Learnings

## 2026-07-16T12:00:00Z Task: T1 — Design tokens & CSS system

### Token decisions
- **Neutral scale (N50–N900)**: Used Feishu/Lark reference palette with subtle blue tint. N50=#f7f8fa through N900=#1d2129 for light mode; inverted for dark mode (N50=#17171a through N900=#f5f5f7).
- **Brand**: #1456F0 (Feishu blue) with hover=#0e42c7, pressed=#0a35a8, light=#e8eefd. Dark mode uses lighter #3c7eff for contrast.
- **Typography scale**: 11/12/13/14/16/18/20/24px mapped to --font-size-xxs/xs/sm/base/md/lg/xl/2xl. Added --font-size-xxs (11px) as new token; remapped existing sizes to match Feishu scale.
- **Spacing**: Kept existing 4px-based scale (space-1=4px through space-12=48px). Primary rhythm is 8px multiples; 4px half-step retained for tight spacing.
- **Interaction opacities**: Added --interaction-opacity-hover (0.08) and --interaction-opacity-press (0.12). Surface hover/active use N900 at these opacities via rgba().
- **Shadows**: N900-based rgba for light mode; pure black rgba for dark mode. Three tiers: sm/md/lg.
- **Radii**: 4/6/8/12px (sm/md/lg/xl). Unchanged from original.

### Surprises / gotchas
1. **--color-surface-secondary was used but never defined** in the original CSS (line 414, `.view-toggle`). Added it to both :root and [data-theme='dark'].
2. **Hardcoded colors found**: `#ff950020` (warning-light) at lines 522 and 822, `#34c75920` (success-light) at line 527. Replaced with `var(--color-warning-light)` and `var(--color-success-light)` tokens.
3. **Dark mode completeness**: Task required EVERY var(--x) to be defined in BOTH :root and [data-theme='dark']. Added full token definitions to dark mode block (typography, spacing, radii, transitions, interaction opacities) even though they don't change — ensures explicit definition and prevents cascade surprises.
4. **Fallback strategy**: Added fallback values to critical tokens in base element styles (body, input, textarea, select, button) and key semantic colors throughout. Pattern: `var(--token-name, #fallback-hex)`.
5. **Button :active states**: Original CSS had no :active states for buttons. Added them using --color-accent-pressed, --color-danger-pressed, and --color-surface-active for Feishu-style press feedback.
6. **N-scale tokens as building blocks**: Defined --color-n50 through --color-n900 explicitly, then used them in semantic token definitions (e.g., `--color-text-primary: var(--color-n900)`). Makes the system more maintainable — change N900 once, all text updates.

### Audit results
- 62 unique var(--x) references in styles.css
- All 62 defined in :root ✅
- All 62 defined in [data-theme='dark'] ✅
- 15 tokens defined but not directly referenced via var() in stylesheet (used internally by other token definitions or reserved for future tasks): --color-n400, --color-n600, --color-n800, --font-size-2xl, --font-size-xxs, --font-weight-normal, --interaction-opacity-hover, --interaction-opacity-press, --line-height-relaxed, --line-height-tight, --shadow-md, --shadow-sm, --space-10, --space-12, --transition-normal

### Verification
- `npm run typecheck` → EXIT 0
- `npm run lint` → EXIT 0
- `npm run build` → EXIT 0
- Screenshot evidence: `.omo/evidence/ui-redesign/task-1-tokens.png` (app shell with new tokens)
- Fallback evidence: `.omo/evidence/ui-redesign/task-1-tokens-failure.png` (app with --color-bg commented out, fallback #ffffff renders)

## [2026-07-16 19:30:00] Task: T3 - Sidebar & Main Shell Redesign

**Semantic HTML improvements:**
- Changed sidebar items from `<div role="button">` to semantic `<button>` elements
- Added `aria-current="page"` for active list item (screen readers announce it)
- Removed manual `tabIndex={0}` and `onKeyDown` handlers (buttons are natively focusable and handle Enter/Space)
- Added `:focus-visible` ring for keyboard navigation (2px solid accent, 2px offset)
- Added `:active` state for press feedback using `--color-surface-active` token

**Visual refinements:**
- Removed sidebar `border-right` (replaced with 1px gap in app-layout)
- App-layout now has `gap: 1px` and `background: var(--color-border-light)` for subtle separator
- Empty/loading states use card treatment: `.sidebar-card` class with surface bg, border-light border, radius-lg, shadow-sm, 8px margin
- Sidebar item button reset: added `width: 100%`, `text-align: left`, `font-family/size/color: inherit`, `border: none`, `background: transparent`

**Token usage:**
- All interaction states use semantic tokens: hover=`--color-surface-hover`, press=`--color-surface-active`, selected=`--color-accent-light` + `--color-accent`
- Card treatment uses: `--color-surface`, `--color-border-light`, `--border-radius-lg`, `--shadow-sm`
- Typography uses existing tokens: `--font-size-base`, `--font-size-sm`, `--font-size-lg`

**Test changes:**
- Zero test changes required — all 217 tests pass
- Tests use `data-testid` selectors which were preserved
- `aria-current` attribute is additive, doesn't break existing assertions

**Verification:**
- typecheck: exit 0
- lint: exit 0
- tests: 217/217 passed
- E2E screenshot test: passed (created task3-sidebar-screenshots.spec.ts)
- Evidence: `.omo/evidence/ui-redesign/task-3-sidebar.png` (sidebar with 3 lists, second selected)
- Evidence: `.omo/evidence/ui-redesign/task-3-sidebar-failure.png` (verifies wrong list NOT active)

## [2026-07-16 19:45:00] Task: T4 - View Toggle & Header Redesign

**Segmented control design:**
- View toggle container: `border: 1px solid var(--color-border)`, `border-radius: var(--border-radius-md)`, `padding: 2px`, transparent background
- Segment buttons: `.view-toggle-btn` class (replaced `btn btn-sm btn-primary/btn-ghost`)
- Active segment: `[aria-pressed="true"]` selector drives `background: var(--color-accent-light)`, `color: var(--color-accent)`, `font-weight: var(--font-weight-semibold)`
- Inactive segment: transparent bg, `color: var(--color-text-secondary)`
- Hover: `var(--color-surface-hover)`, Press: `var(--color-surface-active)` — consistent with sidebar and button patterns

**Header typography:**
- `.main-header h1` changed from `--font-size-xl` (20px) to `--font-size-lg` (18px) per Feishu spec
- Kept `--font-weight-semibold` (600)

**Add Task button:**
- Imported `Plus` from lucide-react
- Replaced text `+` glyph with `<Plus size={16} />`
- Kept `btn btn-primary` class (brand-colored solid button)

**No-list-selected behavior (failure evidence):**
- View toggle is conditionally rendered only when `selectedListId !== null`
- When no list is selected: toggle is hidden, Add Task button is hidden, header shows "No List Selected"
- This is existing behavior — no new disabled state was invented

**Test changes:**
- Zero test changes required — all 217 unit tests pass
- All existing e2e tests pass (55/56; 1 pre-existing failure in integration.spec.ts unrelated to this task)
- Tests use `data-testid` selectors which were preserved
- `aria-pressed` attribute was already present and continues to work

**Verification:**
- typecheck: exit 0
- lint: exit 0
- tests: 217/217 passed
- e2e: 55/56 passed (1 pre-existing packaged-app failure)
- Evidence: `.omo/evidence/ui-redesign/task-4-header.png` (segmented toggle with List active)
- Evidence: `.omo/evidence/ui-redesign/task-4-header-failure.png` (no list selected, toggle hidden)

## [2026-07-16 20:00:00] Task: T5 - Task List & Item Redesign

**CSS changes:**
- Task item: changed `align-items: center` to `align-items: flex-start` for baseline alignment
- Added `margin-top: 2px` to `.task-checkbox`, `.task-drag-handle`, and `.task-actions` to align with title text baseline
- Added `.task-item:focus-within .task-actions { opacity: 1 }` for keyboard accessibility
- Added `.task-item:focus-within .task-drag-handle { opacity: 1 }` for keyboard accessibility
- Added `:focus-visible` styles for checkbox, drag handle, and action buttons (2px solid accent, 2px offset)
- Added `line-height: var(--line-height, 1.5)` to `.task-title` for consistent text alignment
- Added `flex-wrap: wrap` to `.task-meta` to prevent overflow on narrow screens

**Card treatment for empty/loading/error states:**
- Created `.tasklist-card` class with surface bg, border-light border, radius-lg, shadow-sm, 8px-multiple padding
- Created `.tasklist-card-text` for centered text with proper spacing
- Created `.tasklist-card-error` variant with danger-light bg and danger border/color
- Updated TaskList.tsx to use these classes for empty, loading, and error states

**Search & Filter bar restyling:**
- Added explicit border, background, color, and transition to `.search-input` and `.filter-select`
- Added `::placeholder` styling for search input
- Added `:focus` styles with accent border and accent-light box-shadow ring
- Added `:hover` style for filter selects (accent border)
- Added `:focus-visible` styles with outline for keyboard navigation
- Added explicit button reset styles to `.search-clear` (background, border, cursor)

**Component changes:**
- TaskItem.tsx: No JSX changes needed — CSS handles all visual improvements
- TaskList.tsx: Updated empty/loading/error states to use `.tasklist-card` classes
- SortableTaskItem.tsx: No changes needed — wrapper passes through to TaskItem
- FilterBar.tsx: No JSX changes needed — CSS handles restyling
- SearchBar.tsx: No JSX changes needed — CSS handles restyling

**Test changes:**
- Zero unit test changes required — all 217 tests pass
- Created new e2e spec: `task5-tasklist-screenshots.spec.ts`
  - Creates a list and 3 tasks
  - Verifies task structure (title, meta, actions, drag handle, checkbox)
  - Hovers over first task to show actions, captures screenshot
  - Completes first task, verifies strikethrough class and aria-checked
  - Captures failure screenshot showing completed state
  - Tests search functionality and clear button

**Verification:**
- typecheck: exit 0
- lint: exit 0
- tests: 217/217 passed
- e2e: 1/1 passed (task5-tasklist-screenshots.spec.ts)
- Evidence: `.omo/evidence/ui-redesign/task-5-tasklist.png` (task list with 3 tasks, first hovered showing actions)
- Evidence: `.omo/evidence/ui-redesign/task-5-tasklist-failure.png` (first task completed with strikethrough)
