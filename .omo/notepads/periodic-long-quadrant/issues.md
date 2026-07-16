# Issues

# T12: Unit and integration tests for new features

- No product code bugs were revealed by the new tests.
- Test-only issues encountered and fixed:
  - `App.test.tsx` used `getByText('Test List')` which matched both the sidebar item and the header; switched to `getByRole('heading', { level: 1, name: 'Test List' })`.
  - `TaskForm.test.tsx` initially tried to enter an invalid date into a `type="date"` input, which browsers reject; replaced with a UI-testable edge case (start_date > end_date with recurrence set).
  - Added `vi.clearAllMocks()` in the new TaskForm describe block to prevent cross-test mock leakage.

