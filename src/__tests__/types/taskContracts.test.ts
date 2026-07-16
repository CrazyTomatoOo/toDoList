import { describe, it, expect } from 'vitest'
import type {
  Recurrence,
  TaskRow,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListOptions,
  TaskSearchFilters,
} from '../../shared/ipc.js'
import type {
  Recurrence as SchemaRecurrence,
  TaskRow as SchemaTaskRow,
  CreateTaskInput as SchemaCreateTaskInput,
  UpdateTaskInput as SchemaUpdateTaskInput,
} from '../../main/db/schema.js'

type Expect<T extends true> = T
type Extends<Child, Parent> = Child extends Parent ? true : false
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
  ? true
  : false
type Optional<T, K extends keyof T> = undefined extends T[K] ? true : false
type Nullable<T, K extends keyof T> = null extends T[K] ? true : false

// Shared type definitions are identical between IPC and DB schema contracts.
type _RecurrenceSync = Expect<Equal<Recurrence, SchemaRecurrence>>
type _TaskRowSync = Expect<Equal<TaskRow, SchemaTaskRow>>
type _CreateTaskInputSync = Expect<Equal<CreateTaskInput, SchemaCreateTaskInput>>
type _UpdateTaskInputSync = Expect<Equal<UpdateTaskInput, SchemaUpdateTaskInput>>

// Recurrence is assignable to TaskRow['recurrence'] (which is Recurrence | null).
type _RecurrenceAssignable = Expect<Extends<Recurrence, TaskRow['recurrence']>>

// New fields are optional on CreateTaskInput.
type _CreateTaskInputRecurrence = Expect<Optional<CreateTaskInput, 'recurrence'>>
type _CreateTaskInputRecurrenceEndDate = Expect<Optional<CreateTaskInput, 'recurrence_end_date'>>
type _CreateTaskInputStartDate = Expect<Optional<CreateTaskInput, 'start_date'>>
type _CreateTaskInputEndDate = Expect<Optional<CreateTaskInput, 'end_date'>>
type _CreateTaskInputIsUrgent = Expect<Optional<CreateTaskInput, 'is_urgent'>>
type _CreateTaskInputIsImportant = Expect<Optional<CreateTaskInput, 'is_important'>>

// New date/recurrence fields are nullable on UpdateTaskInput; boolean fields are boolean
// (the IPC handler uses Partial<UpdateTaskInput>, so every field is optional at call sites).
type _UpdateTaskInputRecurrence = Expect<Nullable<UpdateTaskInput, 'recurrence'>>
type _UpdateTaskInputRecurrenceEndDate = Expect<Nullable<UpdateTaskInput, 'recurrence_end_date'>>
type _UpdateTaskInputStartDate = Expect<Nullable<UpdateTaskInput, 'start_date'>>
type _UpdateTaskInputEndDate = Expect<Nullable<UpdateTaskInput, 'end_date'>>
type _UpdateTaskInputIsUrgent = Expect<Extends<boolean, UpdateTaskInput['is_urgent']>>
type _UpdateTaskInputIsImportant = Expect<Extends<boolean, UpdateTaskInput['is_important']>>

// Filter and list options expose the new quadrant / recurrence / duration fields.
type _TaskListOptionsQuadrant = Expect<Optional<TaskListOptions, 'quadrant'>>
type _TaskSearchFiltersRecurrence = Expect<Optional<TaskSearchFilters, 'recurrence'>>
type _TaskSearchFiltersDurationFilter = Expect<Optional<TaskSearchFilters, 'durationFilter'>>
type _TaskSearchFiltersQuadrant = Expect<Optional<TaskSearchFilters, 'quadrant'>>
describe('task contract types', () => {
  it('compile-time type assertions hold', () => {
    expect(true).toBe(true)
  })
})
