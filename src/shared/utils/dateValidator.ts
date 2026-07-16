const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validates that a value is a strict, well-formed `YYYY-MM-DD` date string.
 *
 * - `undefined`, `null`, and empty strings are treated as "no value" and pass.
 * - Rejects malformed strings, non-dates, and invalid calendar dates
 *   (e.g. `2023-02-29`, `2024-13-01`).
 *
 * Keep this function in `src/shared` so both the main process (import/export, DB
 * repository) and the renderer process (task form validation) can import it without
 * pulling in main-only dependencies like better-sqlite3.
 */
export function validateDateOnly(value: string | null | undefined, field: string): void {
  if (value === undefined || value === null || value === '') {
    return
  }

  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date`)
  }

  const [yearStr, monthStr, dayStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date`)
  }
}
