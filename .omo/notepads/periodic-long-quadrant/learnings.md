# T1: Schema migration learnings

- SQLite CHECK constraints pass when the expression evaluates to NULL, so a date CHECK must
  explicitly return FALSE for invalid values. Used a strict YYYY-MM-DD CHECK combining
  `LIKE '____-__-__'`, `date(x) IS NOT NULL`, and `strftime('%Y-%m-%d', x) = x` to enforce
  both format and date validity.
- `ALTER TABLE ADD COLUMN` supports per-column CHECK constraints and NOT NULL DEFAULT values,
  keeping the migration forward-only and non-destructive.
- Existing schema tests use `PRAGMA table_info` and `sqlite_master.sql`; extending them is
  straightforward once column order and dflt_value formats are aligned with SQLite's output.
# T2: Shared IPC type updates

- Added `Recurrence`, `Quadrant`, and `DurationFilter` shared union types, exported from both
  `src/shared/ipc.ts` and `src/main/db/schema.ts`.
- `TaskRow` uses the existing snake_case convention (`recurrence_end_date`, `start_date`, etc.) and
  represents the new boolean flags as `0 | 1` to match the existing `completed` field, matching the
  SQLite INTEGER(0/1) storage from migration 004.
- `CreateTaskInput` adds the new date/recurrence fields as `?: string | null` / `?: Recurrence | null`
  and the boolean flags as `?: boolean`, keeping every new input field optional.
- `UpdateTaskInput` adds the new date/recurrence fields as nullable and the boolean flags as `boolean`;
  the IPC handler already wraps the input in `Partial<UpdateTaskInput>`, so all update fields are
  effectively optional at call sites.
- `TaskListOptions` gained `quadrant?: Quadrant`; `TaskSearchFilters` gained `recurrence?: Recurrence`,
  `durationFilter?: DurationFilter`, and `quadrant?: Quadrant`.
- A compile-only type test in `src/__tests__/types/taskContracts.test.ts` asserts that the IPC and
  DB schema contracts stay in sync, that `Recurrence` is assignable to `TaskRow['recurrence']`, and
  that `CreateTaskInput` / `UpdateTaskInput` accept the new fields with the intended optionality.
- `npm run typecheck` passes with no errors.

# T3: Task repository updates for new fields and filters
- Placed the strict `YYYY-MM-DD` validator in `src/shared/utils/dateValidator.ts` so it can be imported by both the main process (DB repository, import/export) and the renderer (task form validation) without dragging in main-only dependencies like better-sqlite3.
- `createTask` and `updateTask` validate the `recurrence` enum, run `validateDateOnly` for `recurrence_end_date`, `start_date`, and `end_date`, and enforce `start_date <= end_date` when both are present. When `recurrence` is set, `due_date` is also validated as date-only so recurrence math has a clean base date.
- Boolean inputs `is_urgent` / `is_important` are normalized to `0` / `1` via a shared helper before insert/update, matching the existing `completed` pattern.
- `searchTasks` supports `recurrence` exact match, `durationFilter` (`all`, `hasDateRange`, `noDateRange`), and `quadrant` filters using bound parameters only. `getTasksByListId` also exposes the `quadrant` option from `TaskListOptions` so T6 can reuse it.
- Added an `eslint-disable @typescript-eslint/no-unused-vars` comment to `src/__tests__/types/taskContracts.test.ts` (T2 artifact) because the compile-time type aliases are intentionally unused at runtime. This keeps `npm run lint` green for the feature branch.

# T3 refactor note
- Split the repository to keep each file under the 250 pure-LOC ceiling: `taskValidation.ts` holds validation helpers and `taskQueries.ts` holds `getTasksByListId` / `searchTasks`. `taskRepository.ts` now implements the core CRUD operations and re-exports the query functions so existing imports continue to work.
- All repository tests (18 total) and `npm run typecheck` / `npm run lint` remain green after the split.

# T6: Quadrant classification and query helpers
- `parseQuadrant` in `taskValidation.ts` already maps each `Quadrant` string to `{ isUrgent: 0 | 1; isImportant: 0 | 1 }`; no new mapping logic was needed.
- Added a dedicated `getTasksByQuadrant(listId, quadrant)` in `taskQueries.ts` that delegates to `getTasksByListId(listId, { quadrant })`, reusing the existing SQL filter and bound parameters.
- Re-exported `getTasksByQuadrant` from `taskRepository.ts` so downstream tasks (T10, T12, T13) can import it from the repository barrel.
- New `src/__tests__/db/quadrantTasks.test.ts` covers all four quadrants, list-boundary isolation, and invalid quadrant rejection.
# T4: Import/export JSON/CSV support for new fields

- Extended `JsonExportTask` in `src/main/services/importExport.ts` with the exact exported field names: `recurrence`, `recurrenceEndDate`, `startDate`, `endDate`, `isUrgent`, `isImportant`.
- JSON export reads the new DB columns directly from `TaskRow`; CSV export selects them explicitly and emits them in the same header order.
- Added helper parsers `assertOptionalDateOnly`, `assertOptionalRecurrence`, and `parseBoolean` in `importExport.ts` so import can validate unknown input and apply defaults (`recurrence: null`, `isUrgent: false`, `isImportant: false`) when fields are missing.
- Reused `validateDateOnly` from `src/shared/utils/dateValidator.ts` for the new date fields and `validateRecurrence` / `validateDateOrder` from `src/main/db/repositories/taskValidation.ts` to keep validation consistent with the repository.
- The import `INSERT` statement now includes `recurrence`, `recurrence_end_date`, `start_date`, `end_date`, `is_urgent`, and `is_important` with bound parameters; boolean flags are normalized to `0`/`1` via the shared `normalizeBoolean` helper.
- Legacy JSON and CSV files without the new columns still import successfully because the parsers default missing values.
- Invalid recurrence values and malformed date-only strings are rejected, and the DB transaction rolls back so no partial data persists.
- Existing `src/__tests__/services/importExport.test.ts` was updated to expect the new CSV header and still passes.
- New `src/__tests__/services/importExportNewFields.test.ts` covers JSON/CSV round-trip, legacy defaults, invalid recurrence, malformed dates, inverted date ranges, and rollback behavior.
# T5: Recurring task completion - next-instance generation

- Added a dedicated helper `generateNextRecurringInstance` in `src/main/db/repositories/taskRecurrence.ts` that computes the next cycle's due date from the existing task's `due_date` (or `start_date` if no due date) and returns the full insert payload for the new instance.
- Recurrence math is handled in date-only local calendar components: `daily` +1 day, `weekly` +7 days, `monthly` +1 month with clamping to the target month's last day, `yearly` +1 year with Feb 29 clamped to Feb 28 on non-leap years.
- `updateTask` now detects the incomplete-to-completed transition (`existing.completed === 0` && `input.completed === true` && `existing.recurrence !== null`) and wraps the completion update and next-instance insert in a single `better-sqlite3` `db.transaction()` so generation is atomic with completion.
- Generation is skipped when the task is already completed, when toggling back to incomplete, when neither `due_date` nor `start_date` exists, or when the computed next date is strictly after `recurrence_end_date`. Equality with `recurrence_end_date` is allowed.
- The new instance inherits title, description, priority, list, recurrence, recurrence_end_date, is_urgent, and is_important; `due_date` is set to the computed next date; `start_date` and `end_date` are shifted by the same recurrence interval; `completed` is `0`; `sort_order` is `max+1` in the list; `reminder_at` is intentionally not inherited.
- New test file `src/__tests__/db/recurringTasks.test.ts` covers daily/monthly/yearly generation, Jan-31 and Feb-29 clamping, recurrence_end_date boundary behavior, no duplicate generation on toggle/edit, missing base date, and start/end date shifting.
- Evidence saved to `.omo/evidence/periodic-long-quadrant/task-5-recurring.txt` and `.omo/evidence/periodic-long-quadrant/task-5-recurring-end.txt`.
- All new files stay under the 250 pure-LOC ceiling; `npm run lint` is clean; `lsp_diagnostics` reports no errors on the changed files.
# T4 refactor note

- After adding the new fields, `src/main/services/importExport.ts` grew past the 250 pure-LOC ceiling. Split the service into three focused files to keep each under the limit: `importExport.ts` (public types + export functions), `importExportHelpers.ts` (parsers, validators, CSV escape/parse), and `importExportImport.ts` (importFromJson, importFromCsv, importData).
- `importExport.ts` re-exports `importFromJson` and `importFromCsv` from `importExportImport.ts` so existing consumers continue to import from the original module.
- All import/export tests (20 total) and `npm run typecheck` / `npm run lint` remain green after the split.