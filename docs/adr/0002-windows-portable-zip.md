# Windows distribution — one-click installer plus portable zip

The Windows NSIS installer shipped with default electron-builder settings: `oneClick: true`, per-user, installed to `%LOCALAPPDATA%\Programs\ToDoList` with no directory choice — users cannot pick the install path. We decided this is deliberate, not a defect: for a single-user offline app, a one-click per-user install avoids UAC, elevation and SmartScreen friction. To serve users who want the app elsewhere, we ship an additional **portable zip** artifact instead of adding an installation-directory wizard.

- **One-click NSIS stays** (`oneClick: true`, `perMachine: false`); the silent contract (`/S` → `%LOCALAPPDATA%\Programs\ToDoList`) keeps `scripts/verify-win-exe.sh` and CI unchanged.
- **Portable zip** (`win.target` includes `zip`): extracted anywhere (e.g. `D:\`, USB) and run directly; no self-extraction, no registry changes.
- **Optional beside-app data:** when a `portable.txt` marker file sits next to the executable, the app redirects its data directory to `<exe dir>/data` so the database travels with the zip; without the marker the data stays in `%APPDATA%`. Resolution order: `TODO_USER_DATA_DIR` env var → `portable.txt` marker → `app.getPath('userData')`.
- `release.yml` attaches `dist/*`, so the added zip needs no workflow change.

**Status:** accepted

**Considered options:**

- **Assisted installer with directory choice** (`oneClick: false` + `allowToChangeInstallationDirectory`) — rejected: every install gets an extra wizard step for a benefit the zip already covers; per-machine mode would need elevation and clashes with signing-optional builds.
- **Portable self-extracting `.exe`** — rejected: extracts to a temp dir on every launch (slow start, leftover cleanup risk) and isn't a real portable layout.
- **Portable data always in `%APPDATA%`** — rejected: that would make the zip "install-free" but not portable; the opt-in marker keeps default behavior unchanged.