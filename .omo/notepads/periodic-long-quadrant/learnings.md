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