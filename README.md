<div align="center">

# ✅ ToDoList

**An offline-first, cross-platform desktop todo app built with Electron, React, and TypeScript.**

Your tasks live **on your machine** — powered by SQLite, no cloud, no account, no tracking.

![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-37.2-gray?logo=electron&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white&style=flat-square)
![SQLite](https://img.shields.io/badge/storage-better--sqlite3-003B57?logo=sqlite&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/bundler-electron--vite-646CFF?logo=vite&logoColor=white&style=flat-square)

![tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-6B21A8?style=flat-square)
![a11y](https://img.shields.io/badge/a11y-axe--core-brightgreen?style=flat-square)
[![MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

</div>

---

## ✨ Features

| | |
|---|---|
| **📋 Task Management** | Create, edit, delete, and toggle tasks across multiple lists. |
| **🗂️ List Organization** | Group tasks into custom lists in a clean, navigable sidebar. |
| **🎯 Quadrant Board** | View tasks in an **Eisenhower matrix** (urgent / important) for priority planning. |
| **🔁 Recurring Tasks** | Set up repeating tasks, with optional end dates. |
| **⏰ Reminders** | Schedule reminders to keep tasks on your radar. |
| **🤏 Drag & Drop** | Reorder tasks with a styled drag handle. |
| **🔍 Search & Filter** | Full-text search and status filtering across all tasks. |
| **💾 Import / Export** | Backup and restore your tasks as JSON. |
| **🌗 Light & Dark Theme** | System-aware theme toggle with persistent storage. |
| **⌨️ Keyboard Accessible** | Full keyboard navigation, focus management, and ARIA support — zero `axe-core` violations. |

> **Privacy first** — all data stays in a local SQLite database on your device. No cloud, no account, no telemetry.

---

## 🧰 Tech Stack

| Layer | Choice |
|-------|--------|
| UI | React 18 + TypeScript |
| Desktop shell | Electron |
| Build tool | Vite via `electron-vite` |
| Database | `better-sqlite3` (SQLite) |
| State management | React hooks + typed Electron IPC |
| Styling | CSS custom properties / design tokens |
| Icons | Lucide React |
| Drag & drop | `@dnd-kit` |
| Unit / component tests | Vitest (`@testing-library/react`, `jsdom`) |
| E2E / a11y tests | Playwright + `@axe-core/playwright` |

---

## 🎨 Design System

The UI follows a **Feishu / Lark**-inspired enterprise aesthetic with a token-driven design system:

- **Primary brand color:** `#1456F0`
- **Neutral scale:** `N50`–`N900`
- **8px grid** spacing system
- Subtle shadows, rounded corners, and consistent hover / press / focus states
- **Dark mode** uses the same token structure with inverted neutral values for contrast

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm

### Install & run

```bash
# Install dependencies (rebuilds better-sqlite3 for your Electron runtime)
npm install

# Launch the app in development mode
npm run dev
```

---

## 📥 安装（Windows）

Windows 提供**两种**获取方式：向导安装器（`ToDoList-<version>-x64.exe`）与便携版压缩包（`ToDoList-<version>-x64.zip`），均为 x64。

### 向导安装（推荐）

双击安装器，按向导完成安装：

- **默认安装目录**：`%LOCALAPPDATA%\Programs\ToDoList`，无需管理员权限。
- 安装向导的目录页可把应用装到任意**当前用户可写**的目录（如 `D:\Apps\ToDoList`）。
- **不支持 `C:\Program Files`**：安装器以 per-user 方式运行、从不提权（UAC），而该目录需要管理员权限才能写入——在里面选它会因拒绝访问而失败。这是有意为之的设计（避免 UAC 与 SmartScreen 的摩擦），并非缺陷。
- 升级时（再次运行安装器）会沿用上次安装的目录，不会弹 UAC。
- 卸载不删除数据：应用数据（数据库等）保留在数据目录里，见下文。

### 静默安装

无需界面即可安装，适合脚本或批量部署：

```bat
ToDoList-<version>-x64.exe /S /D=D:\Apps\ToDoList
```

- `/S` 跳过所有向导页面。
- `/D=<路径>` 指定安装目录。**必须是最后一个参数，且路径不加引号**——即使路径含空格也不加（NSIS 的硬性约定，加了引号会被当成路径的一部分）。`/D=` 安装到**恰好**给出的目录，不会自动追加应用名。
- 省略 `/D=` 时静默安装落到默认目录 `%LOCALAPPDATA%\Programs\ToDoList`。

### 便携版

解压 zip 到任意位置（如 U 盘、第二块硬盘）直接运行 `ToDoList.exe` 即可，无需安装、不写注册表、不自我解压。

在 exe 同目录放一个空的 `portable.txt` 文件，数据就会跟着应用走：数据库等用户数据存放于**exe 旁边的 `data\` 子目录**，整个目录拷走即完成搬家。删除 `portable.txt` 则回到默认数据目录。

### 数据目录

- **默认位置**：`%APPDATA%\todolist-app`（macOS 为 `~/Library/Application Support/todolist-app`）。数据库 `todo.db`（及其 `-wal`/`-shm` 文件）在该目录下。
- **在应用内修改（推荐）**：标题栏齿轮 → 设置 → 数据 → 「更改…」，选好新目录后选择「迁移现有数据（推荐）」或「从空目录开始」，点「迁移并重启」。迁移会复制 `todo.db` 及其 `-wal`/`-shm`、校验新库、写入引导配置，然后重启；旧目录改名为 `todo-data-backup-<时间戳>` 留在新目录旁，设置页的备份表格会列出它的大小与创建时间，可手动删除（应用不会自动清理）。
- **修改方式**：引导配置文件 `%APPDATA%\ToDoList\config.json`（注意 `ToDoList` 与 `todolist-app` 是两个不同目录），内容形如：

  ```json
  { "version": 1, "dataDir": "D:\\MyData\\ToDoList" }
  ```

  `dataDir` 必须是绝对路径，`~` 不展开、相对路径会被拒绝。文件可手工编辑；应用保存配置时原子写入（先写临时文件再改名），且只保留 `version` 与 `dataDir` 两个键。

- **命令行**：`ToDoList.exe --data-dir=D:\MyData\ToDoList` 临时指定数据目录（必须用等号形式，空格分隔不生效）。启动优先级从高到低：`--data-dir=` → `config.json` → `portable.txt` → 默认目录。
- 配置了不可用目录（如已拔出的移动硬盘）时应用进入安全模式，不会在错误位置悄悄新建数据库。
- 引导配置本身有问题（JSON 写坏、`version` 来自更新版本、`dataDir` 缺失或不是绝对路径）时，应用照常用默认目录启动，并在标题栏下方显示一条提示，写明原因与配置文件路径；同一份坏配置只提示一次，点「知道了」后不再打扰，可点「打开设置」直接到数据页。
- 数据目录路径要求：绝对路径、本地磁盘（UNC/网络路径会被拒绝——SQLite 的 WAL 锁在网络文件系统上不可靠）、可写。
- **卸载保留数据**：卸载程序不删除数据目录，`%APPDATA%\todolist-app` 里的数据库原样保留；`%APPDATA%\ToDoList` 下的引导配置也不会被动。若确要清理引导配置，可运行卸载器并加 `--delete-app-data` 参数（只清 `%APPDATA%\ToDoList`，数据库需手动删除）。

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the app in development mode |
| `npm run build` | Build the renderer and main processes |
| `npm run preview` | Preview the production build |
| `npm test` | Run unit/component tests (rebuilds `better-sqlite3` first) |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run typecheck` | Type-check both main and renderer |
| `npm run lint` / `npm run lint:fix` | Lint with ESLint (and auto-fix) |
| `npm run format` / `format:check` | Format with Prettier (and check) |
| `npm run build:mac` | Build the macOS DMG |
| `npm run build:win` | Build the Windows installer and portable zip |
| `npm run dist` | Build macOS and Windows artifacts |

---

## 🧪 Testing

- **Unit / Component** — Vitest with `@testing-library/react` and `jsdom`.
- **E2E** — Playwright launches the real Electron app and covers CRUD, keyboard navigation, dark mode, visual consistency, and accessibility.
- **Accessibility** — `@axe-core/playwright` scans plus keyboard-traversal tests assert **zero** axe violations and visible focus states.

---

## 📁 Project Structure

```
src/
├── main/               # Electron main process
│   ├── db/             # Connection, migrations, repositories
│   ├── ipc/            # Typed IPC handlers
│   ├── services/       # Business logic (import/export, theme, reminders)
│   ├── main.ts         # Entry point
│   ├── preload.ts      # Preload script
│   └── window.ts       # Window management
├── renderer/           # React app
│   ├── components/     # UI components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # Renderer-side services
│   ├── App.tsx         # Root component
│   ├── main.tsx        # Renderer entry
│   └── styles.css      # Design tokens & component styles
├── shared/             # Shared types and utilities
└── __tests__/          # Unit/component & E2E tests
    ├── components/
    ├── e2e/
    └── main/
```

---

## 🏗️ Architecture

- **Offline-first** — The SQLite database lives in the user's data directory; no server is required.
- **Typed IPC bridge** — The main process exposes database and theme operations to the renderer through a typed preload script.
- **Design tokens** — Colors, spacing, typography, and shadows are CSS custom properties in `src/renderer/styles.css`, with explicit dark-mode overrides.
- **Performance** — Task rows and sortable wrappers are memoized with `React.memo`; filter state is stabilized to avoid unnecessary re-renders.

---

## 📦 Packaging

The app is packaged with [`electron-builder`](/electron-builder.yml). Platform-specific builds:

```bash
npm run build:mac   # macOS DMG
npm run build:win   # Windows installer (.exe) + portable zip
npm run dist        # Both platforms
```

`better-sqlite3`'s native module is unpacked from the ASAR archive so it loads correctly at runtime.
For what each Windows artifact means to end users (installer vs portable zip, silent install, where data lives), see [📥 安装（Windows）](#-安装windows).

---

## 📄 License

[MIT](LICENSE) © 2026 ToDoList