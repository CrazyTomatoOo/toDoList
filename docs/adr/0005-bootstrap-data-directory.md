# Data directory — a bootstrap config file resolved before Electron opens its store

The SQLite database is the user's only copy of their data, and it has always
lived at `app.getPath('userData')/todo.db`, overridable only by the
test-only `TODO_USER_DATA_DIR` (`src/main/db/connection.ts:12-24`). Moving it
required moving the whole Electron profile by hand. We make the data directory
an explicit, user-chosen setting held in a **bootstrap config file** that is read
before any database work, with the resolved directory becoming Electron's
`userData` so the database and the renderer's own state move together.

- **Resolution order, highest first.**
  `TODO_USER_DATA_DIR` → `--data-dir=<path>` → `config.json` → `portable.txt` →
  `app.getPath('userData')` (today's default, unchanged). The environment
  variable stays on top because it is a test hook, not a user preference:
  `scripts/smoke-test.js:193`, `scripts/perf-report.js:241` and the Vitest
  database pattern rely on it never being outranked by a developer's real config
  or by a `portable.txt` shipped in `dist/`.
  `getDbPath()` keeps its `os.tmpdir()` branch for non-Electron test runners
  (Vitest with a mocked `electron`); it is not a user-facing option and never
  wins once a directory has been resolved.
- **The pointer lives outside the data directory.**
  `app.getPath('appData')/ToDoList/config.json` — Windows
  `%APPDATA%\ToDoList\config.json`, macOS
  `~/Library/Application Support/ToDoList/config.json`. Not the `settings`
  table: the table's location is the very thing being decided.
- **Fields and version.** Exactly `{ "version": 1, "dataDir": "<absolute path>" }`.
  `version` is an integer the reader must match exactly: `1` is understood, a
  **higher** version means "written by a newer build" and is treated as unusable
  (fall back to the default and say so — never guess at a future schema).
  `dataDir` must be absolute; `~` is not expanded and relative paths are
  rejected. Hand-edits are supported, so a file that parses is never rewritten
  implicitly; the writer emits exactly these two keys and drops anything else it
  finds on the next explicit save (documented, not silent).
- **Corrupt config degrades to defaults, never to a rewrite.** Unparsable JSON,
  a wrong `version`, or a `dataDir` that is not a string: run on the default
  directory and show a warning naming the problem and the file path. The file
  stays byte-identical — no rebuilding, no renaming it out of the way, no
  writing defaults over it.
- **An unusable configured directory is not a fallback.** A valid `config.json`
  pointing at a missing, unmounted, or unwritable directory (a removed USB disk,
  a disconnected drive) starts the app in a **no-store safe mode**: the window
  opens with an explanation and _重试_ / _选择其他目录_ / _退出_, and **no
  database is opened or created** — running on the default directory instead
  would silently present an empty task list and invite the user to keep working
  in the wrong place. Electron's own scratch state (cache, session) may fall back
  to the default `userData` in this mode; the database never does. Choosing a new
  directory writes the config atomically and relaunches via `app.relaunch()`.
- **Applying the directory.** Create it if missing, then
  `app.setPath('userData', dir)` and `app.setPath('sessionData', dir)` **before
  `app.whenReady()`**, because Electron cannot re-point these later. The
  single-instance lock is requested **before** the override: Electron's
  `App::RequestSingleInstanceLock()` derives its identity from
  `DIR_USER_DATA` (electron#24447), so acquiring the lock first keeps one
  instance app-wide instead of one per data directory.
- **Changing it is a migration, and the default answer is "migrate".** With the
  database checkpointed (`PRAGMA wal_checkpoint(TRUNCATE)`) and closed: copy
  `todo.db`, `todo.db-wal`, `todo.db-shm` to the target; open the copy there and
  require `PRAGMA quick_check` to return `ok`; only then write `config.json`
  atomically (`config.json.tmp` + rename); then rename the old directory to
  `todo-data-backup-<timestamp>` and relaunch. Choosing "start empty" skips the
  copy and leaves the old directory untouched, so it can still be pointed back
  at.
- **Failure leaves the old location authoritative.** Any failure before the
  atomic config write leaves `config.json` byte-identical and the old database
  live (it is reopened, or the app exits with the error); a partially copied
  target is deleted, but only when this operation created the target directory.
  A failed rename of the old directory after a successful config write is a
  warning, not an error — the verified target is already the truth.
- **Backups are never deleted automatically.** The settings dialog lists the
  `todo-data-backup-*` directories with size and a _删除备份_ action; there is no
  expiry, because an offline app's backup may be the only copy of what the user
  lost.
- **Validation, shared by every source:** absolute, local, and writable (probe by
  creating and deleting a file); rejects UNC and network paths (SQLite's WAL
  locking is unreliable over SMB), OS directories (`%WINDIR%`, `Program Files*`,
  `/System`, `/usr`), anything inside the packaged `resources` directory, and
  read-only volumes. Symlinks are resolved before the check, so a link into a
  rejected location is rejected too.
- **Known naming asymmetry, accepted.** The packaged `package.json` carries no
  `productName`, so Electron's `app.name` is `todolist-app` and the default store
  is `%APPDATA%\todolist-app` (observed: `~/Library/Application Support/todolist-app/todo.db`),
  while the installer's `APP_FILENAME` is `ToDoList`. The bootstrap config
  therefore lives in `%APPDATA%\ToDoList` beside — not inside — the default data
  directory. Aligning `app.name` with `productName` would move every existing
  install's data directory, so it stays out of scope.

**Status:** accepted

**Considered options:**

- **Store the choice in the `settings` table** — rejected: chicken and egg; you
  need the directory to open the database that would tell you the directory.
- **Registry, plist, or environment variable only** — rejected: platform-specific
  and invisible to users, who then cannot fix a broken path by hand.
- **Chromium's `--user-data-dir` switch** — rejected: that hands the decision to
  Chromium's own handling, with no place for `portable.txt` or an in-app choice,
  and no validation of what it points at.
- **Symlink or junction the data directory** — rejected: Windows needs
  privileges for directory links, and the indirection is invisible in backup and
  uninstall stories.
- **Align `app.name` with `productName` instead of a separate config folder** —
  deferred: it would relocate the default store for every existing install, which
  needs its own migration.
