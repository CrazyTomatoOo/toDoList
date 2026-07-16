- Chose a standalone evidence capture script in .sisyphus/ over modifying E2E test files to keep production and test code untouched. Deleted the script after use.

## 2026-07-15 - F2 lint rejection fix
- Removed unused variables/imports and replaced `any` casts with narrow window extension types instead of adding ESLint disables.
- Kept database startup non-blocking in `src/main/main.ts` by removing the stray `console.error` and documenting that DB failures surface through IPC handlers.
