# ToDoList 跨平台桌面 APP 开发计划

## TL;DR

> **Quick Summary**: 从零构建一个基于 Electron + React + TypeScript 的本地 ToDoList 桌面应用，使用 SQLite 做持久化，支持 macOS 和 Windows 独立安装包（DMG / EXE）分发。
>
> **Deliverables**:
> - Electron 桌面应用（macOS 11+ / Windows 10 1903+）
> - React + TypeScript 前端界面
> - better-sqlite3 本地数据库与迁移机制
> - 任务 CRUD、清单管理、优先级、截止日期、系统通知提醒、清单内拖拽排序、搜索/筛选、深色模式
> - JSON / CSV 导入导出
> - 完整 TDD 测试覆盖（单元 + 集成）
> - macOS DMG 与 Windows EXE 安装包
>
> **Estimated Effort**: Large（4-6 周单人全职，或 8-10 周兼职）
> **Parallel Execution**: YES - 4 个主要波次，每波内任务高度并行
> **Critical Path**: T1 → T5 → T6/T7/T8 → T9-15 → T16/T17 → F1-F4 → 用户确认

---

## Context

### Original Request
用户希望开发一个 ToDoList 桌面 APP，支持 macOS 和 Windows 多端部署，具备业界同类 APP 的相同功能。

### Interview Summary
**Key Discussions**:
- **技术栈**: 选择 Electron + React + TypeScript，因为生态成熟、开发体验一致、易于打包跨平台。
- **存储**: 选择 SQLite（better-sqlite3），本地文件存储，适合任务清单、搜索筛选等关系型操作。
- **测试**: 选择 TDD（测试驱动开发），每个功能模块先写测试后实现。
- **分发**: 独立安装包（DMG / EXE），无代码签名，接受安装警告（MVP 阶段）。
- **系统版本**: macOS 11+ / Windows 10 1903+。
- **功能范围**: v1.0 全部包含 8 项核心功能：任务 CRUD、清单管理、优先级、截止日期、系统通知提醒、清单内拖拽排序、搜索/筛选、深色模式、导入导出（JSON + CSV）。
- **范围边界**: 不包含用户登录、云端同步、Web/移动版本、协作分享、重复任务、子任务、自动更新器。

### Research Findings
- 已委托 librarian 调研 Electron 技术栈与行业功能清单，但该后台调研任务超时未完成。
- 由于用户已明确确认技术栈（Electron + React + TypeScript + better-sqlite3）、核心功能与分发策略，本计划基于用户确认和通用工程知识完成，未依赖外部调研结果。
- 工作目录为空，无现有代码可复用，属于纯绿场项目。

### Grill-with-Docs Decisions
- **规范术语**: Task / 任务，List / 清单。
- **Task 字段约束**: 标题必填，最多 200 字符；描述可选，最多 2000 字符。
- **默认优先级**: 新建 Task 的默认 Priority 为 `medium`。
- **新建位置**: 新 Task 默认添加到 List 末尾（最大 `sortOrder + 1`）。
- **完成状态**: 已完成 Task 保持在当前位置，不自动移动到底部。
- **删除策略**: Task 硬删除，无回收站；删除 List 级联删除其 Task。
- **导入行为**: 追加（Additive），同名 List 合并，导入的 Task 获得新 ID。
- **导出格式**: JSON 嵌套（`{ lists, tasks }`，Task 通过 `listName` 引用 List）；CSV 扁平（每行一个 Task，含 `listName` 列）。
- **搜索/筛选范围**: 默认只在当前选中的 List 内进行。
- **提醒限制**: 提醒依赖 Electron Notification API，仅在 APP 运行时触发；APP 关闭时不提醒。
- **主题行为**: 默认 `system`，仅在启动时读取系统主题；运行期间不实时跟随系统变化。
- **键盘快捷键**: 不在 v1.0 范围内。

### Metis Review
**Identified Gaps**（已处理）:
- 明确了最低系统版本、分发方式、代码签名策略。
- 确认提醒使用原生系统通知。
- 确认拖拽排序仅在清单内进行。
- 确认数据库位置为 `app.getPath('userData')`。
- 明确排除了重复任务、子任务等常见范围膨胀项。
- 识别风险：native module 打包（better-sqlite3）、数据安全、单实例锁、IPC 安全。

---

## Work Objectives

### Core Objective
构建一个纯本地、离线可用、跨 macOS 和 Windows 的 Electron ToDoList 桌面应用，覆盖 8 项行业常见功能，并以 TDD 方式完成开发与验证。

### Concrete Deliverables
- `package.json` + `electron.vite.config.ts`：Electron + Vite + React + TypeScript 工程配置
- `src/main/`：主进程、IPC、数据库 Repository、系统通知、单实例锁、导入导出逻辑
- `src/renderer/`：React 组件、状态管理、路由、主题、拖拽交互
- `src/shared/`：IPC 类型契约、数据模型类型
- `src/__tests__/`：单元测试、集成测试、E2E 测试
- `electron-builder.yml`：macOS DMG 与 Windows EXE 打包配置
- `.github/workflows/`：CI 构建与打包流水线（可选但推荐）

### Definition of Done
- [ ] 所有 8 项核心功能在打包后的 DMG/EXE 中可用
- [ ] 所有 TDD 测试通过（`npm test` 或 `bun test`）
- [ ] macOS 和 Windows 安装包能成功安装并启动
- [ ] 最终 QA 场景全部通过并生成证据文件
- [ ] 代码质量检查（tsc、lint）无错误

### Must Have
- 任务 CRUD（创建、读取、更新、删除）
- 清单（Lists）增删改与任务归属
- 优先级（高/中/低）与截止日期
- 原生系统通知提醒
- 清单内拖拽排序并持久化
- 任务搜索与清单/优先级/状态筛选
- 深色/浅色模式切换并持久化
- JSON 与 CSV 导入导出
- 本地 SQLite 数据持久化
- macOS DMG 与 Windows EXE 安装包

### Must NOT Have (Guardrails)
- 用户登录、账号体系、云端同步
- Web 版本、移动版本
- 协作、分享、重复任务、子任务
- 自动更新器
- 富文本附件、图片上传
- 关闭 `contextIsolation` 或开启 `nodeIntegration`
- 在 renderer 中直接访问文件系统或执行 SQL
- 任何需要人工干预的验收步骤（所有 QA 由代理自动执行）

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: NO（绿场项目，需从零搭建）
- **Automated tests**: TDD
- **Framework**: Vitest（单元/集成）+ Playwright（E2E 渲染器）+ Node 测试 harness（main process IPC）
- **If TDD**: 每个任务遵循 RED（失败测试）→ GREEN（最小实现）→ REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios (see TODO template below).
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright（playwright skill）- 导航、交互、断言 DOM、截图
- **TUI/CLI**: Use interactive_bash（tmux）- 运行命令、发送按键、验证输出
- **API/Backend**: Use Bash（curl / Node 脚本）- 发送请求、断言状态码和响应字段
- **Library/Module**: Use Bash（bun/node REPL）- 导入、调用函数、比较输出
- **Packaged App**: Use Bash + 安装包命令 - 验证安装包生成与启动

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 项目脚手架与核心架构):
├── T1: Electron + Vite + React + TypeScript 工程初始化
├── T2: 主进程窗口管理、单实例锁、上下文菜单
├── T3: TDD 测试基础设施（Vitest + Playwright + Node harness）
├── T4: 类型安全 IPC 桥接（preload + contextBridge）
└── T5: better-sqlite3 集成、数据库连接、迁移框架

Wave 2 (Data Model - 数据层与 Repository):
├── T6: 数据库 Schema 设计与版本化迁移（tasks, lists）
├── T7: 任务 Repository（CRUD、搜索、筛选、排序）
└── T8: 清单 Repository 与任务关联

Wave 3 (Feature Implementation - 前端功能，MAX PARALLEL):
├── T9: 任务 CRUD 界面
├── T10: 清单管理界面
├── T11: 优先级、截止日期、系统通知提醒
├── T12: 清单内拖拽排序
├── T13: 搜索与筛选
├── T14: 深色/浅色模式
└── T15: JSON / CSV 导入导出

Wave 4 (Packaging & Integration - 打包与最终验证):
├── T16: macOS DMG 打包与安装验证
├── T17: Windows EXE 打包与安装验证
├── T18: 跨平台集成测试与安装包冒烟测试
└── T19: 性能与边界情况检查

Wave FINAL (Review - 4 个并行审查):
├── F1: Plan Compliance Audit（oracle）
├── F2: Code Quality Review（unspecified-high）
├── F3: Real Manual QA（unspecified-high + playwright）
└── F4: Scope Fidelity Check（deep）
-> 汇总结果 -> 获取用户明确 "okay" -> 完成

Critical Path: T1 → T5 → T6/T7/T8 → T9-15 → T16/T17 → T18/T19 → F1-F4 → 用户确认
Parallel Speedup: 约 60-70% 相比串行开发
Max Concurrent: 7（Wave 3）
```

### Dependency Matrix

| Task | Blocked By | Blocks |
|------|-----------|--------|
| T1 | - | T2, T3, T4, T5 |
| T2 | T1 | T4, T9, T10, T11, T12, T13, T14, T15 |
| T3 | T1 | T6-T19 |
| T4 | T1, T2 | T6-T15 |
| T5 | T1 | T6-T19 |
| T6 | T3, T4, T5 | T7, T8, T9-T15 |
| T7 | T6 | T9, T11, T12, T13, T15, T18 |
| T8 | T6 | T10, T11, T12, T13, T15, T18 |
| T9 | T2, T4, T7 | T18, T19 |
| T10 | T2, T4, T8 | T18, T19 |
| T11 | T2, T4, T7, T8 | T18, T19 |
| T12 | T2, T4, T7 | T18, T19 |
| T13 | T2, T4, T7, T8 | T18, T19 |
| T14 | T2 | T18, T19 |
| T15 | T4, T7, T8 | T18, T19 |
| T16 | T1-T15 | - |
| T17 | T1-T15 | - |
| T18 | T9-T17 | F1-F4 |
| T19 | T9-T17 | F1-F4 |
| F1-F4 | T1-T19 | - |

### Agent Dispatch Summary

- **Wave 1**: `quick` / `unspecified-high`（T1 脚手架、T2 主进程、T3 测试、T4 IPC、T5 SQLite）
- **Wave 2**: `deep` / `unspecified-high`（T6 Schema、T7 任务 Repository、T8 清单 Repository）
- **Wave 3**: `visual-engineering` / `quick` / `unspecified-high`（T9-T15 界面功能）
- **Wave 4**: `unspecified-high` / `quick`（T16-T19 打包与集成）
- **FINAL**: `oracle`, `unspecified-high`, `deep`（F1-F4 审查）

---

## TODOs

- [x] 1. Electron + Vite + React + TypeScript 工程初始化

  **What to do**:
  - 初始化 npm/bun 项目，配置 `package.json` scripts
  - 安装 Electron + Vite + React + TypeScript 依赖
  - 创建 `electron.vite.config.ts` 或 `vite.config.ts` 区分 main 与 renderer 构建
  - 创建目录结构：`src/main/`, `src/renderer/`, `src/shared/`, `src/__tests__/`
  - 配置 TypeScript（`tsconfig.json` 分 main/renderer/shared）
  - 配置 ESLint + Prettier
  - 添加 `.gitignore` 和 `.nvmrc`（或 bun.lockb）
  - 编写 README 快速启动说明
  - 实现最小可运行版本：启动后显示空白 Electron 窗口，标题为 "ToDoList"

  **Must NOT do**:
  - 不要引入未使用的 UI 库或状态管理库
  - 不要直接开启 `nodeIntegration` 或关闭 `contextIsolation`
  - 不要在此任务中实现业务功能

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 脚手架任务以配置和依赖安装为主，适合快速执行
  - **Skills**: [`frontend-design`]
    - `frontend-design`: 协助确定 React 项目的基础目录与组件组织约定
  - **Skills Evaluated but Omitted**:
    - `tdd`: 测试基础设施在 T3 单独处理，不在脚手架阶段引入

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（与 T2-T5 并行）
  - **Blocks**: T2, T3, T4, T5, T6-T19, F1-F4
  - **Blocked By**: None

  **References**:
  - **External References**:
    - `https://www.electronjs.org/docs/latest/tutorial/quick-start` - Electron 官方快速开始
    - `https://electron-vite.org/` - electron-vite 官方文档（推荐）
  - **WHY Each Reference Matters**: 官方文档提供 Electron 主进程/渲染进程分离的基础模式；electron-vite 提供推荐的 Vite 集成方案，避免手动配置多入口构建。

  **Acceptance Criteria**:
  - [ ] `npm install` 成功无错误
  - [ ] `npm run dev` 启动 Electron 并显示窗口
  - [ ] `npm run build` 生成 `out/` 或 `dist/` 目录包含 main 与 renderer 产物
  - [ ] `npm run typecheck` 无错误
  - [ ] `.gitignore` 已忽略 `node_modules/`, `out/`, `dist/`, `*.log`

  **QA Scenarios**:
  ```
  Scenario: 开发模式启动成功
    Tool: Bash
    Preconditions: 项目已初始化，依赖已安装
    Steps:
      1. 运行 `npm run dev`
      2. 等待 10 秒
      3. 检查进程列表中是否存在 Electron 进程
    Expected Result: Electron 窗口打开，窗口标题包含 "ToDoList"
    Failure Indicators: 命令退出码非 0、窗口未打开、标题错误
    Evidence: .sisyphus/evidence/task-1-dev-start.png

  Scenario: 生产构建成功
    Tool: Bash
    Preconditions: 项目已初始化
    Steps:
      1. 运行 `npm run build`
      2. 检查 `out/` 或 `dist/` 目录是否存在 `main.js` 与 `index.html`
    Expected Result: 构建命令退出码 0，产物文件存在
    Failure Indicators: 构建失败、产物缺失
    Evidence: .sisyphus/evidence/task-1-build-output.txt
  ```

  **Evidence to Capture**:
  - [ ] 开发模式窗口截图：`task-1-dev-start.png`
  - [ ] 构建输出目录列表：`task-1-build-output.txt`

  **Commit**: YES
  - Message: `chore: bootstrap Electron + Vite + React + TypeScript project`
  - Files: `package.json`, `tsconfig*.json`, `vite.config.ts`, `src/main/main.ts`, `src/renderer/main.tsx`, `index.html`, `.gitignore`, `README.md`

- [x] 2. 主进程窗口管理、单实例锁、上下文菜单

  **What to do**:
  - 创建 `src/main/main.ts`：窗口创建、加载 renderer、生命周期管理
  - 实现单实例锁：再次启动时聚焦现有窗口，不打开第二个数据库实例
  - 添加窗口菜单和托盘菜单（可选）
  - 处理 macOS `activate` 事件和 Windows 默认行为
  - 配置窗口尺寸、最小尺寸、深色模式适配
  - 添加 `src/main/preload.ts` 初始框架（详细实现见 T4）
  - 编写单元测试：单实例锁逻辑、窗口创建行为

  **Must NOT do**:
  - 不要在此任务中实现 IPC 通道（T4 负责）
  - 不要在此任务中引入业务逻辑
  - 不要禁用 `contextIsolation`
  - 不要保存窗口状态到数据库（可用简单文件）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及 Electron 主进程、进程锁、跨平台事件处理，需要经验
  - **Skills**: []
    - 无特殊技能需求
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 此任务为纯主进程逻辑，不涉及 UI 设计

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（与 T1, T3, T4, T5 并行）
  - **Blocks**: T4, T9-T15
  - **Blocked By**: T1

  **References**:
  - **External References**:
    - `https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelock` - 单实例锁 API
    - `https://www.electronjs.org/docs/latest/api/browser-window` - BrowserWindow 配置
  - **WHY Each Reference Matters**: 单实例锁防止多开导致数据库并发问题；BrowserWindow 配置决定窗口行为与跨平台一致性。

  **Acceptance Criteria**:
  - [ ] `npm run dev` 启动后窗口正常显示
  - [ ] 再次运行启动命令时，原窗口被聚焦，没有第二个窗口
  - [ ] macOS 关闭窗口后点击 Dock 图标可重新打开
  - [ ] 单元测试通过：单实例锁、窗口创建

  **QA Scenarios**:
  ```
  Scenario: 单实例锁防止双开
    Tool: Bash
    Preconditions: APP 已启动
    Steps:
      1. 第一次运行 `npm run dev &`
      2. 等待 5 秒
      3. 再次运行启动命令
      4. 检查进程数量
    Expected Result: 仅有一个 Electron 主进程实例，第二个命令退出或聚焦原窗口
    Failure Indicators: 出现两个 Electron 窗口/进程
    Evidence: .sisyphus/evidence/task-2-single-instance.txt

  Scenario: macOS 重新激活窗口
    Tool: Bash (macOS only)
    Preconditions: APP 在 macOS 运行
    Steps:
      1. 启动 APP
      2. 关闭窗口（Cmd+W 或点击红按钮）
      3. 点击 Dock 图标
    Expected Result: 窗口重新显示
    Failure Indicators: 窗口未恢复
    Evidence: .sisyphus/evidence/task-2-macos-reactivate.png
  ```

  **Evidence to Capture**:
  - [ ] 单实例锁进程检查：`task-2-single-instance.txt`
  - [ ] macOS 重新激活截图：`task-2-macos-reactivate.png`（macOS 环境）

  **Commit**: YES
  - Message: `feat(main): add window management and single-instance lock`
  - Files: `src/main/main.ts`, `src/main/window.ts`, `src/main/preload.ts`, `src/__tests__/main/window.test.ts`

- [x] 3. TDD 测试基础设施（Vitest + Playwright + Node harness）

  **What to do**:
  - 安装并配置 Vitest 用于单元/集成测试
  - 安装并配置 Playwright 用于 E2E 渲染器测试
  - 创建 Node 测试 harness 用于主进程 IPC 测试（无需启动 Electron 窗口）
  - 配置 `npm test`（单元/集成）、`npm run test:e2e`（E2E）脚本
  - 编写第一个 RED 测试示例（例如：数据库迁移版本表存在）
  - 配置测试覆盖率阈值（可选，建议 ≥70%）
  - 确保 CI 环境可以运行测试（无需显示服务器时配置 xvfb）

  **Must NOT do**:
  - 不要在此任务中实现业务代码（只写会失败的测试示例）
  - 不要引入多个测试框架造成冲突
  - 不要在测试中使用真实用户数据目录

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 测试工具配置与脚本编写，适合快速完成
  - **Skills**: [`tdd`]
    - `tdd`: 确保 RED-GREEN-REFACTOR 流程和测试结构正确
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 测试基础设施不依赖 UI 设计

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（与 T1, T2, T4, T5 并行）
  - **Blocks**: T6-T19
  - **Blocked By**: T1

  **References**:
  - **External References**:
    - `https://vitest.dev/guide/` - Vitest 官方指南
    - `https://playwright.dev/docs/intro` - Playwright 官方指南
  - **WHY Each Reference Matters**: Vitest 与 Vite 集成良好，适合 React 组件测试；Playwright 用于真实 Electron 渲染器交互验证。

  **Acceptance Criteria**:
  - [ ] `npm test` 运行 Vitest 并输出测试结果（至少有一个 RED 示例）
  - [ ] `npm run test:e2e` 运行 Playwright 并输出结果（至少有一个 RED 示例）
  - [ ] 测试配置中数据库路径使用临时目录（不污染用户数据）
  - [ ] 存在 `src/__tests__/` 目录结构示例

  **QA Scenarios**:
  ```
  Scenario: 单元测试命令可用
    Tool: Bash
    Preconditions: 依赖已安装
    Steps:
      1. 运行 `npm test`
      2. 检查退出码和输出
    Expected Result: 命令退出码 0 或 1（取决于 RED 测试），能看到测试运行报告
    Failure Indicators: 命令不存在、配置错误
    Evidence: .sisyphus/evidence/task-3-unit-test.txt

  Scenario: E2E 测试命令可用
    Tool: Bash
    Preconditions: 依赖已安装
    Steps:
      1. 运行 `npm run test:e2e`
      2. 检查退出码和输出
    Expected Result: Playwright 能启动并执行测试
    Failure Indicators: Playwright 未安装、浏览器启动失败
    Evidence: .sisyphus/evidence/task-3-e2e-test.txt
  ```

  **Evidence to Capture**:
  - [ ] 单元测试输出：`task-3-unit-test.txt`
  - [ ] E2E 测试输出：`task-3-e2e-test.txt`

  **Commit**: YES
  - Message: `chore(test): setup Vitest, Playwright and TDD harness`
  - Files: `vitest.config.ts`, `playwright.config.ts`, `package.json`, `src/__tests__/example.test.ts`, `src/__tests__/e2e/example.spec.ts`

- [x] 4. 类型安全 IPC 桥接（preload + contextBridge）

  **What to do**:
  - 设计 `src/shared/ipc.ts` 类型契约：定义所有 IPC 通道名称、请求/响应类型
  - 实现 `src/main/preload.ts`：通过 `contextBridge.exposeInMainWorld` 暴露安全 API
  - 实现 `src/main/ipc/index.ts`：主进程 IPC 处理器注册与转发
  - 确保 renderer 只能调用白名单函数，不能直接访问 Node API
  - 使用 TypeScript 类型让 renderer 自动获得类型提示
  - 编写测试：验证 IPC 类型契约与处理器注册

  **Must NOT do**:
  - 不要启用 `nodeIntegration`
  - 不要关闭 `contextIsolation`
  - 不要暴露 `require` 或 `process` 给 renderer
  - 不要暴露原始事件对象或数据库连接给 renderer

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: IPC 安全是 Electron 应用的关键，需要严谨实现
  - **Skills**: []
    - 无特殊技能需求
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: IPC 属于主进程安全架构，不依赖 UI 设计

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（与 T1, T2, T3, T5 并行）
  - **Blocks**: T6-T15
  - **Blocked By**: T1, T2

  **References**:
  - **External References**:
    - `https://www.electronjs.org/docs/latest/tutorial/context-isolation` - contextIsolation 安全说明
    - `https://www.electronjs.org/docs/latest/api/context-bridge` - contextBridge API
  - **WHY Each Reference Matters**: 防止 renderer 被 XSS 攻击后获得完整 Node 权限，这是 Electron 安全的基础。

  **Acceptance Criteria**:
  - [ ] `contextIsolation` 为 true
  - [ ] `nodeIntegration` 为 false
  - [ ] renderer 通过 `window.electronAPI` 访问类型化 API
  - [ ] 所有 IPC 通道在 `src/shared/ipc.ts` 中有类型定义
  - [ ] 测试通过：IPC 类型契约与处理器注册

  **QA Scenarios**:
  ```
  Scenario: Renderer 无法访问 Node API
    Tool: Playwright
    Preconditions: APP 已启动，preload 已加载
    Steps:
      1. 在 renderer 控制台执行 `typeof window.require`
      2. 断言结果为 `"undefined"`
    Expected Result: `window.require` 不存在
    Failure Indicators: 可以访问 require
    Evidence: .sisyphus/evidence/task-4-context-isolation.png

  Scenario: Renderer 通过类型化 API 调用主进程
    Tool: Playwright
    Preconditions: IPC 已注册
    Steps:
      1. 在 renderer 调用 `window.electronAPI.ping('hello')`
      2. 断言返回值为 `"pong: hello"`
    Expected Result: 返回正确的字符串
    Failure Indicators: 调用失败或返回错误
    Evidence: .sisyphus/evidence/task-4-ipc-ping.txt
  ```

  **Evidence to Capture**:
  - [ ] 安全隔离截图：`task-4-context-isolation.png`
  - [ ] IPC 调用日志：`task-4-ipc-ping.txt`

  **Commit**: YES
  - Message: `feat(ipc): add typed contextBridge IPC channel`
  - Files: `src/shared/ipc.ts`, `src/main/preload.ts`, `src/main/ipc/index.ts`, `src/__tests__/main/ipc.test.ts`

- [x] 5. better-sqlite3 集成、数据库连接、迁移框架

  **What to do**:
  - 安装 `better-sqlite3` 和类型定义
  - 配置 Electron 原生模块重建（`electron-rebuild` 或 `electron-vite` 的 postinstall）
  - 创建 `src/main/db/connection.ts`：数据库连接单例，数据库路径为 `app.getPath('userData')/todo.db`
  - 启用 WAL 模式，配置外键约束
  - 创建 `src/main/db/migrations.ts`：迁移版本表 + 执行迁移函数
  - 编写第一个迁移脚本（例如创建 `migrations` 版本表）
  - 编写测试：验证数据库创建、连接、迁移执行

  **Must NOT do**:
  - 不要把数据库文件放在应用安装目录
  - 不要在 renderer 中直接引用 better-sqlite3
  - 不要写死数据库路径
  - 不要忽略迁移失败

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 原生模块集成、数据库路径与迁移是 Electron 应用的高风险点
  - **Skills**: []
    - 无特殊技能需求
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 数据库集成与 UI 无关

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（与 T1-T4 并行）
  - **Blocks**: T6-T19
  - **Blocked By**: T1

  **References**:
  - **External References**:
    - `https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md` - better-sqlite3 API
    - `https://www.electronjs.org/docs/latest/api/app#appgetpathname` - app.getPath 说明
  - **WHY Each Reference Matters**: 数据库路径必须使用 userData 保证跨平台一致性和权限；better-sqlite3 是同步 API，需正确管理连接和事务。

  **Acceptance Criteria**:
  - [ ] `better-sqlite3` 在开发模式和打包后都能正常加载
  - [ ] 数据库文件在 `app.getPath('userData')/todo.db` 创建
  - [ ] 迁移版本表存在，并能按顺序执行迁移脚本
  - [ ] 单元测试通过：数据库连接、迁移执行

  **QA Scenarios**:
  ```
  Scenario: 数据库文件在正确位置创建
    Tool: Bash
    Preconditions: APP 首次启动
    Steps:
      1. 启动 APP 后关闭
      2. 检查用户数据目录下的 `todo.db` 文件是否存在
    Expected Result: 在对应平台用户数据目录中找到 `todo.db`
    Failure Indicators: 文件不存在或位置错误
    Evidence: .sisyphus/evidence/task-5-db-location.txt

  Scenario: 迁移框架正常工作
    Tool: Bash
    Preconditions: 数据库已初始化
    Steps:
      1. 运行测试 `npm test src/__tests__/db/migrations.test.ts`
      2. 检查迁移版本表是否记录最新版本
    Expected Result: 测试通过，migrations 表存在并记录版本号
    Failure Indicators: 迁移失败或版本表缺失
    Evidence: .sisyphus/evidence/task-5-migrations.txt
  ```

  **Evidence to Capture**:
  - [ ] 数据库路径验证：`task-5-db-location.txt`
  - [ ] 迁移测试输出：`task-5-migrations.txt`

  **Commit**: YES
  - Message: `feat(db): integrate better-sqlite3 with connection and migrations`
  - Files: `src/main/db/connection.ts`, `src/main/db/migrations.ts`, `src/__tests__/db/migrations.test.ts`, `package.json`

- [x] 6. 数据库 Schema 设计与版本化迁移（tasks, lists）

  **What to do**:
  - 设计 `lists` 表：`id`（主键）、`name`（唯一）、`createdAt`、`updatedAt`
  - 设计 `tasks` 表：`id`（主键）、`listId`（外键）、`title`、`description`、`priority`（high/medium/low）、`dueDate`、`reminderAt`、`completed`、`sortOrder`、`createdAt`、`updatedAt`
  - 设计 `task_tags` / `tags` 表（可选，不在 v1.0 实现，但预留扩展）—— **v1.0 不包含此表**
  - 创建迁移脚本文件 `src/main/db/migrations/001_initial.sql` 或 `001_initial.ts`
  - 编写迁移回滚机制（如果适用）或至少记录版本
  - 编写 RED 测试：数据库初始化后表结构正确

  **Must NOT do**:
  - 不要在此阶段添加 tags、attachments、recurrence 等 v1.0 范围外字段
  - 不要使用无约束的 TEXT 类型存储结构化数据（如 priority 用 ENUM/TEXT CHECK）
  - 不要忽略索引（为 `listId`、`completed`、`dueDate` 添加索引）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Schema 设计影响后续所有功能与查询性能，需要深思熟虑
  - **Skills**: []
    - 无特殊技能需求
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: Schema 设计不依赖 UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2（与 T7、T8 并行）
  - **Blocks**: T7, T8, T9-T15, T18, T19
  - **Blocked By**: T3, T4, T5

  **References**:
  - **Pattern References**:
    - 本项目无现有代码，参考行业常见 ToDo 数据模型
  - **External References**:
    - `https://www.sqlite.org/lang_createtable.html` - SQLite 建表语法
  - **WHY Each Reference Matters**: 合理的索引和外键约束是保证后续搜索、筛选、排序性能的基础。

  **Acceptance Criteria**:
  - [ ] `lists` 和 `tasks` 表存在，列定义与规格一致
  - [ ] 迁移脚本编号为 001，迁移版本表记录当前版本为 1
  - [ ] 外键约束和索引已启用
  - [ ] RED 测试失败，说明测试基础设施能捕获缺失实现

  **QA Scenarios**:
  ```
  Scenario: Schema 表结构正确
    Tool: Bash (better-sqlite3 CLI 或 Node 脚本)
    Preconditions: 数据库已执行迁移
    Steps:
      1. 打开数据库
      2. 查询 `PRAGMA table_info(tasks)`
      3. 检查列名与类型
    Expected Result: tasks 表包含 title, listId, priority, dueDate, reminderAt, completed, sortOrder 等列
    Failure Indicators: 列缺失或类型错误
    Evidence: .sisyphus/evidence/task-6-schema.txt

  Scenario: 外键约束启用
    Tool: Bash
    Preconditions: 数据库已连接
    Steps:
      1. 执行 `PRAGMA foreign_keys`
      2. 检查返回值为 1
    Expected Result: 外键约束启用
    Failure Indicators: 返回 0
    Evidence: .sisyphus/evidence/task-6-foreign-keys.txt
  ```

  **Evidence to Capture**:
  - [ ] Schema 验证：`task-6-schema.txt`
  - [ ] 外键约束验证：`task-6-foreign-keys.txt`

  **Commit**: YES
  - Message: `feat(db): design tasks and lists schema with versioned migrations`
  - Files: `src/main/db/migrations/001_initial.sql`, `src/main/db/schema.ts`, `src/__tests__/db/schema.test.ts`

- [x] 7. 任务 Repository（CRUD、搜索、筛选、排序）

  **What to do**:
  - 创建 `src/main/db/repositories/taskRepository.ts`
  - 实现：创建任务、读取任务（支持按 listId、状态、优先级、日期筛选）、更新任务、删除任务
  - 实现 `searchTasks(query, filters)`：支持标题/描述子串搜索，支持清单、优先级、完成状态筛选
  - 实现 `updateTaskSortOrder(taskIds)`：批量更新 sortOrder 字段，支持事务
  - 通过 IPC 暴露 API 给 renderer（注册在 T4 的 IPC 框架中）
  - 编写完整测试：CRUD、搜索、筛选、排序、边界情况（空标题、无效日期、不存在的 listId）

  **Must NOT do**:
  - 不要在 Repository 中混合 UI 逻辑
  - 不要在 SQL 中直接拼接用户输入（使用参数化查询）
  - 不要在事务中执行无关联操作
  - 不要在此任务中实现 UI 组件

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 任务 Repository 是应用核心，涉及复杂查询与事务
  - **Skills**: []
    - 无特殊技能需求
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 数据层与 UI 分离

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2（与 T6、T8 并行）
  - **Blocks**: T9, T11, T12, T13, T15, T18
  - **Blocked By**: T6

  **References**:
  - **Pattern References**:
    - `src/main/db/connection.ts` - 数据库连接单例（T5）
    - `src/shared/ipc.ts` - IPC 类型契约（T4）
  - **External References**:
    - `https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md` - better-sqlite3 API
  - **WHY Each Reference Matters**: Repository 模式将 SQL 集中在主进程，renderer 通过类型化 IPC 调用，保持安全边界。

  **Acceptance Criteria**:
  - [ ] 所有 Repository 方法有对应测试并通过
  - [ ] 搜索支持标题/描述子串（不区分大小写）
  - [ ] 筛选支持 listId、priority、completed 组合
  - [ ] 排序更新在事务中完成，失败时回滚
  - [ ] 通过 IPC 暴露的 API 类型与 `src/shared/ipc.ts` 一致

  **QA Scenarios**:
  ```
  Scenario: 创建并查询任务
    Tool: Bash (npm test)
    Preconditions: 数据库已初始化
    Steps:
      1. 调用 `createTask({ title: '买牛奶', listId: 1 })`
      2. 查询返回的任务
    Expected Result: 任务 title 为 '买牛奶'，completed 为 false，sortOrder 为 0
    Failure Indicators: 创建失败或字段错误
    Evidence: .sisyphus/evidence/task-7-crud-test.txt

  Scenario: 搜索任务
    Tool: Bash (npm test)
    Preconditions: 存在多个任务
    Steps:
      1. 调用 `searchTasks('牛奶')`
      2. 断言结果包含标题含 "牛奶" 的任务
    Expected Result: 搜索返回匹配任务
    Failure Indicators: 返回空或不匹配
    Evidence: .sisyphus/evidence/task-7-search-test.txt

  Scenario: 空标题被拒绝
    Tool: Bash (npm test)
    Preconditions: 数据库已初始化
    Steps:
      1. 调用 `createTask({ title: '', listId: 1 })`
    Expected Result: 抛出错误，标题为空
    Failure Indicators: 创建成功
    Evidence: .sisyphus/evidence/task-7-empty-title-test.txt
  ```

  **Evidence to Capture**:
  - [ ] CRUD 测试输出：`task-7-crud-test.txt`
  - [ ] 搜索测试输出：`task-7-search-test.txt`
  - [ ] 空标题错误测试输出：`task-7-empty-title-test.txt`

  **Commit**: YES
  - Message: `feat(db): add task repository with CRUD, search, filter and sort`
  - Files: `src/main/db/repositories/taskRepository.ts`, `src/main/ipc/handlers/tasks.ts`, `src/__tests__/db/taskRepository.test.ts`

- [x] 8. 清单 Repository 与任务关联

  **What to do**:
  - 创建 `src/main/db/repositories/listRepository.ts`
  - 实现：创建清单、读取清单、更新清单名称、删除清单（同时处理关联任务：级联删除或禁止删除非空清单）
  - 实现 `getListsWithTaskCount()`：返回清单及任务数量
  - 通过 IPC 暴露 API 给 renderer
  - 编写测试：CRUD、重复名称检查、删除非空清单行为、任务计数正确性

  **Must NOT do**:
  - 不要允许两个同名清单（业务规则，用户确认）
  - 不要级联删除时不提示（业务规则：删除清单时级联删除其任务，无需二次确认）
  - 不要在此任务中实现 UI 组件

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及外键约束、删除策略和聚合查询
  - **Skills**: []
    - 无特殊技能需求
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 数据层与 UI 分离

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2（与 T6、T7 并行）
  - **Blocks**: T10, T11, T12, T13, T15, T18
  - **Blocked By**: T6

  **References**:
  - **Pattern References**:
    - `src/main/db/repositories/taskRepository.ts` - 参考 Repository 结构（T7）
  - **External References**:
    - `https://www.sqlite.org/foreignkeys.html` - SQLite 外键行为
  - **WHY Each Reference Matters**: 删除清单时需明确任务的处理策略（级联删除），避免孤儿数据或意外约束错误。

  **Acceptance Criteria**:
  - [ ] 清单 CRUD 测试全部通过
  - [ ] 重复清单名创建被阻止
  - [ ] 删除清单时关联任务被级联删除（或按业务规则处理）
  - [ ] 任务计数正确（包含已完成/未完成）
  - [ ] 通过 IPC 暴露的 API 类型与 `src/shared/ipc.ts` 一致

  **QA Scenarios**:
  ```
  Scenario: 创建清单并计数
    Tool: Bash (npm test)
    Preconditions: 数据库已初始化
    Steps:
      1. 创建清单 "工作"
      2. 在该清单下创建 2 个任务
      3. 调用 `getListsWithTaskCount()`
    Expected Result: 返回清单 "工作" 及任务数 2
    Failure Indicators: 计数错误
    Evidence: .sisyphus/evidence/task-8-list-count.txt

  Scenario: 重复清单名被拒绝
    Tool: Bash (npm test)
    Preconditions: 已存在清单 "工作"
    Steps:
      1. 再次创建名为 "工作" 的清单
    Expected Result: 抛出重复名称错误
    Failure Indicators: 创建成功
    Evidence: .sisyphus/evidence/task-8-duplicate-list.txt

  Scenario: 删除清单级联任务
    Tool: Bash (npm test)
    Preconditions: 清单 "工作" 下有任务
    Steps:
      1. 删除清单 "工作"
      2. 查询该清单下任务
    Expected Result: 任务数量为空
    Failure Indicators: 任务仍存在
    Evidence: .sisyphus/evidence/task-8-cascade-delete.txt
  ```

  **Evidence to Capture**:
  - [ ] 清单计数验证：`task-8-list-count.txt`
  - [ ] 重复名称验证：`task-8-duplicate-list.txt`
  - [ ] 级联删除验证：`task-8-cascade-delete.txt`

  **Commit**: YES
  - Message: `feat(db): add list repository with task association and counts`
  - Files: `src/main/db/repositories/listRepository.ts`, `src/main/ipc/handlers/lists.ts`, `src/__tests__/db/listRepository.test.ts`

- [x] 9. 任务 CRUD 界面

  **What to do**:
  - 创建任务列表组件 `src/renderer/components/TaskList.tsx`
  - 创建任务项组件 `src/renderer/components/TaskItem.tsx`（显示标题、优先级、截止日期、完成状态）
  - 创建新增/编辑任务表单组件 `src/renderer/components/TaskForm.tsx`
  - 通过 IPC 调用 taskRepository 接口完成 CRUD
  - 实现任务完成状态切换（checkbox）
  - 实现任务删除确认（简单对话框或内联按钮）
  - 编写组件单元测试与 Playwright E2E 测试

  **Must NOT do**:
  - 不要直接调用 better-sqlite3 或文件系统
  - 不要在此任务中实现拖拽排序（T12 负责）
  - 不要在此任务中实现搜索筛选（T13 负责）
  - 不要引入复杂状态管理库（优先用 React useState/useContext）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 涉及 React 组件、UI 交互、状态与渲染
  - **Skills**: [`frontend-design`, `tdd`]
    - `frontend-design`: 确保任务列表和表单的 UI/UX 质量
    - `tdd`: 组件测试与 E2E 测试遵循 TDD
  - **Skills Evaluated but Omitted**:
    - `ui-ux-pro-max`: 项目定位 MVP，无需过度设计

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3（与 T10-T15 并行）
  - **Blocks**: T18, T19
  - **Blocked By**: T2, T4, T7

  **References**:
  - **Pattern References**:
    - `src/shared/ipc.ts` - IPC 类型契约（T4）
    - `src/main/db/repositories/taskRepository.ts` - taskRepository API（T7）
  - **External References**:
    - `https://react.dev/reference/react` - React 官方文档
  - **WHY Each Reference Matters**: UI 通过 IPC 调用主进程数据层，必须对齐类型契约；React 文档用于确定组件结构与 hook 用法。

  **Acceptance Criteria**:
  - [ ] 可以创建任务并显示在列表中
  - [ ] 可以编辑任务标题、描述、优先级、截止日期
  - [ ] 可以切换任务完成状态
  - [ ] 可以删除任务
  - [ ] 空标题任务无法创建
  - [ ] 组件测试与 E2E 测试通过

  **QA Scenarios**:
  ```
  Scenario: 创建任务并显示
    Tool: Playwright
    Preconditions: APP 已启动，至少有一个清单
    Steps:
      1. 点击 `[data-testid="add-task-button"]`
      2. 在 `[data-testid="task-title-input"]` 输入 "买牛奶"
      3. 选择 `[data-testid="priority-select"]` 为 "high"
      4. 点击 `[data-testid="task-save-button"]`
    Expected Result: 任务列表中出现 "买牛奶"，且优先级标识为 high
    Failure Indicators: 任务未出现、保存失败
    Evidence: .sisyphus/evidence/task-9-create-task.png

  Scenario: 空标题无法保存
    Tool: Playwright
    Preconditions: APP 已启动
    Steps:
      1. 点击 `[data-testid="add-task-button"]`
      2. 不输入标题，直接点击保存
    Expected Result: 保存按钮禁用或显示错误提示
    Failure Indicators: 空任务被创建
    Evidence: .sisyphus/evidence/task-9-empty-title-error.png
  ```

  **Evidence to Capture**:
  - [ ] 创建任务截图：`task-9-create-task.png`
  - [ ] 空标题错误截图：`task-9-empty-title-error.png`

  **Commit**: YES
  - Message: `feat(ui): add task CRUD components and E2E tests`
  - Files: `src/renderer/components/TaskList.tsx`, `src/renderer/components/TaskItem.tsx`, `src/renderer/components/TaskForm.tsx`, `src/renderer/hooks/useTasks.ts`, `src/__tests__/components/TaskList.test.tsx`, `src/__tests__/e2e/task-crud.spec.ts`

- [x] 10. 清单管理界面

  **What to do**:
  - 创建清单列表组件 `src/renderer/components/ListSidebar.tsx`
  - 创建新增/编辑清单表单组件 `src/renderer/components/ListForm.tsx`
  - 通过 IPC 调用 listRepository 接口
  - 实现清单切换（点击清单显示该清单任务）
  - 实现清单删除（级联删除其任务）
  - 显示每个清单的任务数量
  - 编写组件测试与 E2E 测试

  **Must NOT do**:
  - 不要允许空名称清单
  - 不要允许重复名称清单（调用 Repository 抛错时显示错误）
  - 不要在此任务中实现搜索筛选（T13 负责）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 侧边栏导航是桌面 ToDo 应用的核心 UI
  - **Skills**: [`frontend-design`, `tdd`]
    - `frontend-design`: 确保侧边栏布局与交互符合桌面习惯
    - `tdd`: 组件测试与 E2E 测试遵循 TDD
  - **Skills Evaluated but Omitted**:
    - `ui-ux-pro-max`: MVP 阶段不需要高级 UX 研究

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3（与 T9, T11-T15 并行）
  - **Blocks**: T18, T19
  - **Blocked By**: T2, T4, T8

  **References**:
  - **Pattern References**:
    - `src/shared/ipc.ts` - IPC 类型契约（T4）
    - `src/main/db/repositories/listRepository.ts` - listRepository API（T8）
  - **WHY Each Reference Matters**: UI 必须与数据层 API 对齐，确保调用参数和返回类型正确。

  **Acceptance Criteria**:
  - [ ] 可以创建清单
  - [ ] 可以切换当前清单并显示对应任务
  - [ ] 可以删除清单并级联删除其任务
  - [ ] 重复清单名显示错误
  - [ ] 每个清单显示任务数量
  - [ ] 组件测试与 E2E 测试通过

  **QA Scenarios**:
  ```
  Scenario: 创建清单并切换
    Tool: Playwright
    Preconditions: APP 已启动
    Steps:
      1. 点击 `[data-testid="add-list-button"]`
      2. 输入 "工作" 并保存
      3. 点击新创建的清单
    Expected Result: 清单被选中，任务列表显示该清单下任务（初始为空）
    Failure Indicators: 清单未创建、切换无效
    Evidence: .sisyphus/evidence/task-10-create-list.png

  Scenario: 删除清单级联删除任务
    Tool: Playwright
    Preconditions: 清单 "工作" 下有 1 个任务
    Steps:
      1. 右键点击/点击删除按钮 "工作"
      2. 确认删除
    Expected Result: 清单和任务都被删除，侧边栏不再显示该清单
    Failure Indicators: 清单仍存在、任务残留
    Evidence: .sisyphus/evidence/task-10-delete-list.png
  ```

  **Evidence to Capture**:
  - [ ] 创建清单截图：`task-10-create-list.png`
  - [ ] 删除清单截图：`task-10-delete-list.png`

  **Commit**: YES
  - Message: `feat(ui): add list sidebar and management components`
  - Files: `src/renderer/components/ListSidebar.tsx`, `src/renderer/components/ListForm.tsx`, `src/renderer/hooks/useLists.ts`, `src/__tests__/components/ListSidebar.test.tsx`, `src/__tests__/e2e/list-management.spec.ts`

- [x] 11. 优先级、截止日期、系统通知提醒

  **What to do**:
  - 在任务表单中添加优先级选择（高/中/低）和日期时间选择器
  - 在任务项中显示优先级标识和截止日期
  - 实现提醒设置：任务有 `reminderAt` 时，通过 Electron `Notification` 发送系统通知
  - 创建提醒调度器：在 main process 中监听时间，触发通知
  - 处理通知点击：打开 APP 并定位到对应任务
  - 支持清除/修改提醒
  - 编写测试：通知触发、提醒时间计算、过期提醒处理

  **Must NOT do**:
  - 不要实现重复提醒（v1.0 范围外）
  - 不要依赖外部通知服务（纯本地）
  - 不要在 renderer 中直接创建 Notification
  - 不要在任务表单中加入过复杂的时间选择 UI

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及日期时间处理、系统通知 API、跨平台通知权限
  - **Skills**: [`tdd`]
    - `tdd`: 提醒调度逻辑需要精确测试
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 时间选择器 UI 较基础，无需单独设计技能

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3（与 T9, T10, T12-T15 并行）
  - **Blocks**: T18, T19
  - **Blocked By**: T2, T4, T7, T8

  **References**:
  - **Pattern References**:
    - `src/main/db/repositories/taskRepository.ts` - 任务数据读写（T7）
  - **External References**:
    - `https://www.electronjs.org/docs/latest/tutorial/notifications` - Electron 通知文档
  - **WHY Each Reference Matters**: 系统通知在不同平台（macOS 通知中心、Windows 通知）有差异，需参考 Electron 文档实现兼容。

  **Acceptance Criteria**:
  - [ ] 可以设置任务优先级和截止日期
  - [ ] 可以设置提醒时间
  - [ ] 到达提醒时间时触发系统通知
  - [ ] 提醒持久化到数据库
  - [ ] 修改提醒时间后通知按新时间触发
  - [ ] 测试覆盖通知触发和过期逻辑

  **QA Scenarios**:
  ```
  Scenario: 设置提醒并触发通知
    Tool: Playwright + Bash 检查通知权限
    Preconditions: APP 已启动，通知权限已授予
    Steps:
      1. 创建任务 "会议"，设置提醒时间为当前时间 + 1 分钟
      2. 等待 1 分钟
      3. 检查系统通知是否出现
    Expected Result: 系统通知中心显示 "会议" 提醒
    Failure Indicators: 通知未出现
    Evidence: .sisyphus/evidence/task-11-notification.png

  Scenario: 修改提醒时间
    Tool: Bash (npm test)
    Preconditions: 任务已设置提醒
    Steps:
      1. 调用 updateTask 修改 reminderAt
      2. 查询任务提醒时间
    Expected Result: 数据库中 reminderAt 更新为新值
    Failure Indicators: 提醒时间未更新
    Evidence: .sisyphus/evidence/task-11-update-reminder.txt
  ```

  **Evidence to Capture**:
  - [ ] 通知触发截图：`task-11-notification.png`
  - [ ] 提醒更新测试输出：`task-11-update-reminder.txt`

  **Commit**: YES
  - Message: `feat(reminder): add priority, due date and native notification reminders`
  - Files: `src/main/services/reminderScheduler.ts`, `src/renderer/components/PrioritySelect.tsx`, `src/renderer/components/DateTimePicker.tsx`, `src/__tests__/services/reminderScheduler.test.ts`, `src/__tests__/e2e/reminder.spec.ts`

- [x] 12. 清单内拖拽排序

  **What to do**:
  - 集成拖拽库（推荐 `@dnd-kit`）
  - 实现 `TaskList` 组件内的拖拽排序
  - 拖拽结束后调用 `updateTaskSortOrder` 持久化新顺序
  - 确保 sortOrder 与数据库一致
  - 编写 Playwright E2E 测试：拖拽任务后顺序持久化

  **Must NOT do**:
  - 不要实现跨清单拖拽（v1.0 范围外）
  - 不要改变任务的 `id`，只更新 `sortOrder`
  - 不要依赖 React state 顺序作为持久化顺序

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 拖拽交互是桌面应用的高级 UX
  - **Skills**: [`frontend-design`, `tdd`]
    - `frontend-design`: 确保拖拽视觉反馈和体验
    - `tdd`: 验证排序持久化逻辑
  - **Skills Evaluated but Omitted**:
    - `ui-ux-pro-max`: 基础拖拽用 @dnd-kit 即可

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3（与 T9-T11, T13-T15 并行）
  - **Blocks**: T18, T19
  - **Blocked By**: T2, T4, T7

  **References**:
  - **Pattern References**:
    - `src/main/db/repositories/taskRepository.ts` - `updateTaskSortOrder` API（T7）
  - **External References**:
    - `https://dndkit.com/` - @dnd-kit 文档
  - **WHY Each Reference Matters**: @dnd-kit 是无 headless 拖拽库，与 React 集成良好，适合列表排序。

  **Acceptance Criteria**:
  - [ ] 可以在清单内拖拽任务改变顺序
  - [ ] 拖拽后顺序即时更新并持久化到数据库
  - [ ] 重启 APP 后顺序不变
  - [ ] E2E 测试通过

  **QA Scenarios**:
  ```
  Scenario: 拖拽排序并持久化
    Tool: Playwright
    Preconditions: 清单 "工作" 有 3 个任务：A, B, C
    Steps:
      1. 拖拽任务 A 到任务 C 之后
      2. 关闭并重新启动 APP
      3. 检查任务顺序
    Expected Result: 任务顺序为 B, C, A
    Failure Indicators: 顺序恢复为 A, B, C 或排序失败
    Evidence: .sisyphus/evidence/task-12-drag-sort.png
  ```

  **Evidence to Capture**:
  - [ ] 拖拽排序持久化截图：`task-12-drag-sort.png`

  **Commit**: YES
  - Message: `feat(ui): add drag-and-drop task sorting within list`
  - Files: `src/renderer/components/SortableTaskList.tsx`, `src/renderer/hooks/useSortableTasks.ts`, `src/__tests__/e2e/drag-sort.spec.ts`

- [x] 13. 搜索与筛选

  **What to do**:
  - 创建搜索输入组件 `src/renderer/components/SearchBar.tsx`
  - 创建筛选组件：按清单、优先级、完成状态筛选
  - 实现 `useSearchAndFilter` hook，调用 `searchTasks` IPC 接口
  - 支持实时搜索（标题/描述子串）
  - 支持组合筛选（清单 + 优先级 + 完成状态）
  - 空搜索结果显示提示
  - 编写组件测试与 E2E 测试

  **Must NOT do**:
  - 不要在 renderer 中做全量搜索（利用 SQLite 的查询能力）
  - 不要搜索时破坏当前清单上下文（默认在当前清单内搜索，可选全部清单）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 搜索框、筛选器、结果列表都是 UI 工作
  - **Skills**: [`frontend-design`, `tdd`]
    - `frontend-design`: 确保搜索和筛选体验直观
    - `tdd`: 测试搜索和筛选组合逻辑
  - **Skills Evaluated but Omitted**:
    - `ui-ux-pro-max`: MVP 搜索功能不需要复杂 UX

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3（与 T9-T12, T14, T15 并行）
  - **Blocks**: T18, T19
  - **Blocked By**: T2, T4, T7, T8

  **References**:
  - **Pattern References**:
    - `src/main/db/repositories/taskRepository.ts` - `searchTasks` API（T7）
  - **WHY Each Reference Matters**: 搜索筛选逻辑由主进程 Repository 执行，UI 仅负责收集输入和展示结果。

  **Acceptance Criteria**:
  - [ ] 可以按关键词搜索任务标题和描述
  - [ ] 可以按清单、优先级、完成状态筛选
  - [ ] 支持组合筛选
  - [ ] 空搜索结果有明确提示
  - [ ] 测试通过

  **QA Scenarios**:
  ```
  Scenario: 关键词搜索
    Tool: Playwright
    Preconditions: 清单中有 "买牛奶" 和 "买面包" 两个任务
    Steps:
      1. 在 `[data-testid="search-input"]` 输入 "牛奶"
    Expected Result: 列表只显示 "买牛奶"
    Failure Indicators: 显示不匹配任务或结果为空
    Evidence: .sisyphus/evidence/task-13-search.png

  Scenario: 组合筛选
    Tool: Playwright
    Preconditions: 有多个不同优先级和状态的任务
    Steps:
      1. 选择优先级 "high"
      2. 选择状态 "未完成"
    Expected Result: 列表只显示高优先级且未完成的任务
    Failure Indicators: 筛选结果错误
    Evidence: .sisyphus/evidence/task-13-filter.png
  ```

  **Evidence to Capture**:
  - [ ] 搜索截图：`task-13-search.png`
  - [ ] 筛选截图：`task-13-filter.png`

  **Commit**: YES
  - Message: `feat(ui): add search and filter functionality`
  - Files: `src/renderer/components/SearchBar.tsx`, `src/renderer/components/FilterBar.tsx`, `src/renderer/hooks/useSearchAndFilter.ts`, `src/__tests__/e2e/search-filter.spec.ts`

- [x] 14. 深色/浅色模式

  **What to do**:
  - 检测系统主题偏好（`nativeTheme.shouldUseDarkColors`）
  - 实现主题切换开关（系统默认 / 深色 / 浅色）
  - 持久化主题选择（使用 electron-store 或 SQLite settings 表）
  - 使用 CSS 变量或 Tailwind dark mode 实现主题切换
  - 确保所有组件在深色和浅色模式下可读
  - 编写测试：主题切换、持久化、系统偏好同步

  **Must NOT do**:
  - 不要实现多个主题（如蓝色/红色主题），只支持深色/浅色
  - 不要只依赖 CSS 媒体查询而忽略用户手动选择
  - 不要把主题状态放在会丢失的地方

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 主题切换涉及全局样式和 UI 一致性
  - **Skills**: [`frontend-design`, `tdd`]
    - `frontend-design`: 确保深色模式色彩对比度符合规范
    - `tdd`: 验证主题持久化和切换
  - **Skills Evaluated but Omitted**:
    - `ui-ux-pro-max`: 基础主题切换无需高级 UX

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3（与 T9-T13, T15 并行）
  - **Blocks**: T18, T19
  - **Blocked By**: T2

  **References**:
  - **External References**:
    - `https://www.electronjs.org/docs/latest/api/native-theme` - nativeTheme API
  - **WHY Each Reference Matters**: 需要检测系统主题并让用户手动覆盖，持久化选择。

  **Acceptance Criteria**:
  - [ ] APP 启动时跟随系统主题或上次选择
  - [ ] 可以手动切换深色/浅色/系统默认
  - [ ] 切换即时生效，无需重启
  - [ ] 主题选择在重启后保持
  - [ ] 测试通过

  **QA Scenarios**:
  ```
  Scenario: 切换深色模式并持久化
    Tool: Playwright
    Preconditions: APP 当前为浅色模式
    Steps:
      1. 点击 `[data-testid="theme-toggle"]` 选择 "dark"
      2. 检查 `[data-testid="app-root"]` 的 class 或背景色
      3. 关闭并重启 APP
    Expected Result: APP 保持深色模式
    Failure Indicators: 重启后恢复浅色或切换无效
    Evidence: .sisyphus/evidence/task-14-dark-mode.png
  ```

  **Evidence to Capture**:
  - [ ] 深色模式截图：`task-14-dark-mode.png`

  **Commit**: YES
  - Message: `feat(ui): add dark and light mode with persistence`
  - Files: `src/renderer/styles/theme.css`, `src/renderer/hooks/useTheme.ts`, `src/renderer/components/ThemeToggle.tsx`, `src/main/services/theme.ts`, `src/__tests__/e2e/theme.spec.ts`

- [x] 15. JSON / CSV 导入导出

  **What to do**:
  - 创建 `src/main/services/importExport.ts`：实现 JSON 导入导出、CSV 导入导出
  - 导出：将任务和清单数据导出为 JSON 或 CSV 文件
  - 导入：从 JSON 或 CSV 文件读取数据并写入数据库（可配置为覆盖或追加）
  - 使用 Electron `dialog.showOpenDialog` / `showSaveDialog` 处理文件选择
  - 处理导入错误：文件格式错误、缺少字段、数据库约束冲突
  - 编写测试：导入导出 roundtrip、错误文件处理

  **Must NOT do**:
  - 不要导入 v1.0 范围外的字段（如 tags、attachments）
  - 不要导出内部数据库字段（如 `id` 可以保留，但需文档说明）
  - 不要直接写文件路径到数据库（通过 IPC 传递文件内容）
  - 不要忽略导入事务失败时的数据回滚

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及文件对话框、数据格式转换、错误处理和事务
  - **Skills**: [`tdd`]
    - `tdd`: 导入导出的 roundtrip 和错误场景需要精确测试
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 导入导出 UI 简单，无需单独设计技能

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3（与 T9-T14 并行）
  - **Blocks**: T18, T19
  - **Blocked By**: T4, T7, T8

  **References**:
  - **Pattern References**:
    - `src/main/db/repositories/taskRepository.ts` - 任务数据（T7）
    - `src/main/db/repositories/listRepository.ts` - 清单数据（T8）
  - **External References**:
    - `https://www.electronjs.org/docs/latest/api/dialog` - Electron dialog API
  - **WHY Each Reference Matters**: 文件选择必须使用 Electron 原生 dialog，不能绕过沙箱让 renderer 直接访问文件系统。

  **Acceptance Criteria**:
  - [ ] 可以导出 JSON 文件
  - [ ] 可以导出 CSV 文件
  - [ ] 可以导入 JSON 文件并恢复数据
  - [ ] 可以导入 CSV 文件并恢复数据
  - [ ] 导入错误文件时给出明确错误提示
  - [ ] 导入导出 roundtrip 测试通过

  **QA Scenarios**:
  ```
  Scenario: JSON 导出导入 roundtrip
    Tool: Bash (Node 脚本 / npm test)
    Preconditions: 数据库有 1 个清单和 2 个任务
    Steps:
      1. 调用导出服务生成 JSON 字符串
      2. 清空数据库
      3. 调用导入服务导入 JSON
      4. 查询清单和任务数量
    Expected Result: 清单和任务数量与导出前一致
    Failure Indicators: 数据丢失或数量不一致
    Evidence: .sisyphus/evidence/task-15-json-roundtrip.txt

  Scenario: 错误文件导入
    Tool: Bash (npm test)
    Preconditions: 数据库已初始化
    Steps:
      1. 导入一个格式错误的 JSON（缺少必要字段）
    Expected Result: 抛出明确错误，数据库状态不变
    Failure Indicators: 崩溃或数据被污染
    Evidence: .sisyphus/evidence/task-15-import-error.txt
  ```

  **Evidence to Capture**:
  - [ ] JSON roundtrip 测试输出：`task-15-json-roundtrip.txt`
  - [ ] 导入错误测试输出：`task-15-import-error.txt`

  **Commit**: YES
  - Message: `feat(io): add JSON and CSV import/export`
  - Files: `src/main/services/importExport.ts`, `src/renderer/components/ImportExportButtons.tsx`, `src/__tests__/services/importExport.test.ts`, `src/__tests__/e2e/import-export.spec.ts`

- [x] 16. macOS DMG 打包与安装验证

  **What to do**:
  - 配置 `electron-builder` 的 macOS 打包选项（target: dmg）
  - 设置应用图标、应用名称、Bundle ID
  - 配置最低系统版本 `mac.minimumSystemVersion: 11.0`
  - 解决 better-sqlite3 在打包后的 native module 路径问题
  - 运行 `npm run build:mac` 生成 DMG
  - 在 macOS 环境挂载 DMG 并将 APP 拖到 Applications
  - 启动 APP 验证基本功能正常
  - 记录打包体积和依赖情况

  **Must NOT do**:
  - 不要配置 Mac App Store 发布（v1.0 只支持独立 DMG）
  - 不要在此任务中解决代码签名（已确认无证书）
  - 不要生成 .zip 作为默认分发包（DMG 是主要目标）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及原生模块打包、平台特定配置和真实安装验证
  - **Skills**: []
    - 无特殊技能需求
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 打包与 UI 无关

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4（与 T17, T18, T19 并行）
  - **Blocks**: F1-F4
  - **Blocked By**: T1-T15

  **References**:
  - **External References**:
    - `https://www.electron.build/configuration/mac` - electron-builder macOS 配置
  - **WHY Each Reference Matters**: electron-builder 的 macOS 配置项繁多，包括架构、最低版本、签名等，必须参考官方文档。

  **Acceptance Criteria**:
  - [ ] `npm run build:mac` 成功生成 `dist/*.dmg`
  - [ ] DMG 可在 macOS 11+ 挂载并安装
  - [ ] 安装后的 APP 能正常启动并显示界面
  - [ ] 应用数据目录正确生成数据库文件
  - [ ] 打包产物体积被记录

  **QA Scenarios**:
  ```
  Scenario: DMG 安装包生成
    Tool: Bash
    Preconditions: 项目代码已完成
    Steps:
      1. 运行 `npm run build:mac`
      2. 检查 `dist/` 目录是否存在 `.dmg` 文件
    Expected Result: DMG 文件存在，构建命令退出码 0
    Failure Indicators: 构建失败或 DMG 缺失
    Evidence: .sisyphus/evidence/task-16-dmg-build.txt

  Scenario: DMG 挂载并启动
    Tool: Bash (macOS only)
    Preconditions: DMG 已生成
    Steps:
      1. 挂载 DMG：`open dist/ToDoList-*.dmg`
      2. 将 APP 复制到 /Applications
      3. 启动 APP
    Expected Result: APP 正常打开，无崩溃
    Failure Indicators: 无法挂载或启动失败
    Evidence: .sisyphus/evidence/task-16-dmg-launch.png
  ```

  **Evidence to Capture**:
  - [ ] 构建输出：`task-16-dmg-build.txt`
  - [ ] 安装启动截图：`task-16-dmg-launch.png`（macOS 环境）

  **Commit**: YES
  - Message: `build: add macOS DMG packaging and installer verification`
  - Files: `electron-builder.yml`, `build/icon.icns`, `package.json`, `scripts/verify-mac-dmg.sh`

- [x] 17. Windows EXE 打包与安装验证

  **What to do**:
  - 配置 `electron-builder` 的 Windows 打包选项（target: nsis）
  - 设置应用图标、应用名称、安装路径
  - 配置 Windows 最低版本（target: win, arch: x64）
  - 解决 better-sqlite3 在 Windows 打包后的 native module 路径问题
  - 运行 `npm run build:win` 生成 EXE 安装包
  - 在 Windows 环境运行安装程序并验证
  - 启动 APP 验证基本功能正常
  - 记录打包体积和依赖情况

  **Must NOT do**:
  - 不要配置 Windows Store 发布（v1.0 只支持独立 EXE）
  - 不要在此任务中解决代码签名（已确认无证书）
  - 不要生成 portable 版本作为默认分发包（NSIS 安装包是主要目标）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及 Windows 原生模块打包、NSIS 配置和安装验证
  - **Skills**: []
    - 无特殊技能需求
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 打包与 UI 无关

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4（与 T16, T18, T19 并行）
  - **Blocks**: F1-F4
  - **Blocked By**: T1-T15

  **References**:
  - **External References**:
    - `https://www.electron.build/configuration/win` - electron-builder Windows 配置
  - **WHY Each Reference Matters**: Windows 安装包配置包括架构、安装路径、卸载程序等，需参考官方文档。

  **Acceptance Criteria**:
  - [ ] `npm run build:win` 成功生成 `dist/*.exe`
  - [ ] EXE 可在 Windows 10 1903+ 运行安装
  - [ ] 安装后的 APP 能正常启动并显示界面
  - [ ] 应用数据目录正确生成数据库文件
  - [ ] 打包产物体积被记录

  **QA Scenarios**:
  ```
  Scenario: EXE 安装包生成
    Tool: Bash
    Preconditions: 项目代码已完成
    Steps:
      1. 运行 `npm run build:win`
      2. 检查 `dist/` 目录是否存在 `.exe` 文件
    Expected Result: EXE 文件存在，构建命令退出码 0
    Failure Indicators: 构建失败或 EXE 缺失
    Evidence: .sisyphus/evidence/task-17-exe-build.txt

  Scenario: EXE 安装并启动
    Tool: Bash (Windows 环境，可用 Wine 或 CI Windows runner)
    Preconditions: EXE 已生成
    Steps:
      1. 静默安装：`./dist/ToDoList-*.exe /S`
      2. 启动 APP
    Expected Result: APP 正常打开，无崩溃
    Failure Indicators: 安装失败或启动失败
    Evidence: .sisyphus/evidence/task-17-exe-launch.png
  ```

  **Evidence to Capture**:
  - [ ] 构建输出：`task-17-exe-build.txt`
  - [ ] 安装启动截图：`task-17-exe-launch.png`（Windows 环境）

  **Commit**: YES
  - Message: `build: add Windows NSIS packaging and installer verification`
  - Files: `electron-builder.yml`, `build/icon.ico`, `package.json`, `scripts/verify-win-exe.sh`

- [x] 18. 跨平台集成测试与安装包冒烟测试

  **What to do**:
  - 编写端到端集成测试：任务 CRUD + 清单 + 搜索 + 主题切换的完整流程
  - 编写安装包冒烟测试：验证打包后的 APP 能启动、数据库初始化、基本功能可用
  - 在 macOS 和 Windows 环境分别运行冒烟测试
  - 使用 Playwright 或独立脚本驱动打包后的 APP
  - 生成集成测试报告

  **Must NOT do**:
  - 不要只测试开发模式（必须测试打包后的产物）
  - 不要跳过 native module 加载验证
  - 不要忽略跨平台路径差异

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 涉及打包产物与真实环境交互
  - **Skills**: [`tdd`]
    - `tdd`: 确保集成测试覆盖关键用户路径
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 集成测试不关注 UI 设计细节

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4（与 T16, T17, T19 并行）
  - **Blocks**: F1-F4
  - **Blocked By**: T9-T17

  **References**:
  - **Pattern References**:
    - 所有 Wave 3 任务的 QA 场景
  - **External References**:
    - `https://playwright.dev/docs/electron` - Playwright Electron 支持
  - **WHY Each Reference Matters**: Playwright 可以直接启动 Electron 应用，适合对打包产物做 E2E。

  **Acceptance Criteria**:
  - [ ] 集成测试覆盖：创建任务→切换清单→搜索→切换主题→导入导出
  - [ ] 打包后的 macOS APP 通过冒烟测试
  - [ ] 打包后的 Windows APP 通过冒烟测试
  - [ ] 测试报告保存到 `.sisyphus/evidence/`

  **QA Scenarios**:
  ```
  Scenario: 打包后 APP 核心流程冒烟
    Tool: Playwright
    Preconditions: DMG/EXE 已安装
    Steps:
      1. 启动已安装 APP
      2. 创建清单 "测试"
      3. 创建任务 "冒烟测试任务"
      4. 搜索 "冒烟"
      5. 切换主题为深色
    Expected Result: 每个步骤都能成功，无崩溃或白屏
    Failure Indicators: 任何步骤失败
    Evidence: .sisyphus/evidence/task-18-smoke-test.png
  ```

  **Evidence to Capture**:
  - [ ] 冒烟测试截图：`task-18-smoke-test.png`
  - [ ] 集成测试报告：`task-18-integration-report.txt`

  **Commit**: YES
  - Message: `test: add cross-platform integration and packaged app smoke tests`
  - Files: `src/__tests__/e2e/integration.spec.ts`, `scripts/smoke-test.js`, `playwright.config.ts`

- [x] 19. 性能与边界情况检查

  **What to do**:
  - 测试大量任务（1000+）时的列表渲染和数据库查询性能
  - 检查内存泄漏（使用 heap snapshot 或任务管理器）
  - 验证数据库 WAL 模式、事务和大批量导入性能
  - 检查边界情况：空数据库、超长任务标题、特殊字符、无效日期
  - 生成性能报告和边界情况检查报告
  - 修复发现的性能或稳定性问题

  **Must NOT do**:
  - 不要进行过度优化导致代码复杂化（遵循 simplicity first）
  - 不要引入未验证的缓存层
  - 不要忽略明显的问题（如未处理的 Promise rejection）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 性能分析和边界问题需要深入排查
  - **Skills**: [`diagnose`]
    - `diagnose`: 使用系统化方法诊断性能和边界问题
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: 性能优化不是 UI 设计任务

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4（与 T16-T18 并行）
  - **Blocks**: F1-F4
  - **Blocked By**: T9-T17

  **References**:
  - **External References**:
    - `https://www.electronjs.org/docs/latest/tutorial/performance` - Electron 性能指南
  - **WHY Each Reference Matters**: 大量任务列表需要虚拟化或分页，避免一次性渲染过多 DOM 节点。

  **Acceptance Criteria**:
  - [ ] 1000 个任务时列表滚动流畅
  - [ ] 大批量导入（1000 任务）在合理时间内完成（< 5 秒）
  - [ ] 无未处理的 Promise rejection 或异常
  - [ ] 空数据库和边界输入处理正确
  - [ ] 性能报告保存到 `.sisyphus/evidence/`

  **QA Scenarios**:
  ```
  Scenario: 大量任务列表性能
    Tool: Playwright
    Preconditions: 数据库有 1000 个任务
    Steps:
      1. 启动 APP
      2. 滚动任务列表到底部
      3. 记录 FPS 和响应时间
    Expected Result: 列表能流畅滚动，无明显卡顿
    Failure Indicators: 滚动卡顿、内存激增
    Evidence: .sisyphus/evidence/task-19-perf-test.txt

  Scenario: 边界输入处理
    Tool: Bash (npm test)
    Preconditions: 数据库已初始化
    Steps:
      1. 创建标题为 1000 个字符的任务
      2. 创建截止日期为无效日期的任务
    Expected Result: 超长标题被截断或限制，无效日期被拒绝
    Failure Indicators: 崩溃或数据异常
    Evidence: .sisyphus/evidence/task-19-edge-cases.txt
  ```

  **Evidence to Capture**:
  - [ ] 性能测试报告：`task-19-perf-test.txt`
  - [ ] 边界情况测试输出：`task-19-edge-cases.txt`

  **Commit**: YES
  - Message: `perf: add performance and edge case validation`
  - Files: `src/renderer/components/VirtualizedTaskList.tsx`（如需要）, `src/__tests__/perf/performance.test.ts`, `scripts/perf-report.js`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 个审查代理并行运行，全部通过后由 orchestrator 汇总结果并向用户展示。用户最终确认 "okay" 是关闭工作项（boulder）的流程步骤，不是自动 QA 验收条件，也不属于 Must Have 的一部分。

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | Evidence [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- 采用 **atomic commits**，每个任务对应一个或一组小提交
- 提交消息格式：`type(scope): description`
- 示例：
  - `feat(db): add tasks and lists schema with migrations`
  - `feat(ui): add task CRUD components with TDD tests`
  - `feat(packaging): add electron-builder DMG and EXE configs`
  - `test(e2e): add packaged app smoke tests for macOS and Windows`
- 每个提交前运行：`npm run lint` + `npm run test`（或对应命令）

## Success Criteria

### Verification Commands
```bash
# 类型检查
npm run typecheck
# 或 tsc --noEmit
# 预期：无错误

# 单元与集成测试
npm run test
# 预期：全部通过

# E2E 测试（渲染器）
npm run test:e2e
# 预期：全部通过

# 打包 macOS
npm run build:mac
# 预期：dist/*.dmg 生成

# 打包 Windows
npm run build:win
# 预期：dist/*.exe 生成

# 安装包冒烟（macOS）
open dist/*.dmg
# 预期：挂载成功，APP 可启动

# 安装包冒烟（Windows，通过 CI 或测试脚本）
./dist/*.exe /S
# 预期：安装成功，APP 可启动
```

### Final Checklist
- [ ] 所有 "Must Have" 已实现并验证
- [ ] 所有 "Must NOT Have" 未出现
- [ ] 所有测试通过（单元 + 集成 + E2E）
- [ ] macOS DMG 和 Windows EXE 安装包生成并验证
- [ ] 最终 QA 证据文件保存至 `.sisyphus/evidence/`
- [ ] 所有 "Must Have" 已实现并验证
- [ ] 所有 "Must NOT Have" 未出现
- [ ] 所有测试通过（单元 + 集成 + E2E）
- [ ] macOS DMG 和 Windows EXE 安装包生成并验证
- [ ] 最终 QA 证据文件保存至 `.sisyphus/evidence/`
- [ ] 用户明确确认 "okay"

## Domain Glossary

> 本术语表由 `/grill-with-docs` 会话规范化，用于统一项目语言，避免实现和测试中的歧义。

### Task / 任务
- **Definition**: 用户需要在 APP 中记录、跟踪并最终完成的最小工作单元。
- **Includes**: 标题（必填，最多 200 字符）、描述（可选，最多 2000 字符）、优先级、截止日期、提醒时间、完成状态、排序位置。
- **Excludes**: 重复任务、子任务、附件（v1.0 范围外）。
- **Example**: "买牛奶" 是一个 Task；"工作会议" 也是一个 Task。
- **Synonyms to avoid**: 待办、事项、条目、Todo、Item、Entry。

### List / 清单
- **Definition**: 一组 Task 的集合，用于按主题或场景组织 Task。
- **Includes**: 名称、创建时间、关联的 Task 集合。
- **Excludes**: 标签（Tag）、文件夹（Folder）、项目（Project）概念（v1.0 范围外）。
- **Example**: "工作" 是一个 List，包含 "完成周报"、"回复客户邮件" 等 Task。
- **Synonyms to avoid**: 列表、分类、项目、Project、Category。

### Priority / 优先级
- **Definition**: 表示 Task 相对重要程度的标签。
- **Values**: `high`（高）、`medium`（中）、`low`（低）。
- **Default**: 新建 Task 的默认 Priority 为 `medium`。

### Due Date / 截止日期
- **Definition**: Task 应该完成的日期，精确到天。
- **Format**: 日期（YYYY-MM-DD），不包含具体时间。
- **Notes**: 截止日期可以单独存在，不必须设置提醒。

### Reminder / 提醒
- **Definition**: 在指定时间点触发系统通知，提醒用户关注某个 Task。
- **Format**: 日期时间（ISO 8601 或本地时间），精确到分钟。
- **Relationship to Due Date**: 提醒时间与截止日期相互独立。
- **Limitation**: 依赖 Electron Notification API，仅在 APP 运行时触发；APP 关闭时不会触发提醒。
- **Synonyms to avoid**: 通知（Notification 是提醒触发后的 UI 表现，不是同一个概念）。

### Completed / 完成状态
- **Values**: `true`（已完成）或 `false`（未完成）。
- **Default**: 新建 Task 为 `false`。
- **Position on Complete**: 当 Task 标记为已完成时，它保持在 List 中的当前位置，不会自动移动到底部。

### Sort Order / 排序
- **Definition**: 同一 List 内 Task 的显示顺序，由 `sortOrder` 字段控制。
- **Default**: 新创建的 Task 默认添加到 List 末尾。
- **Manual Ordering**: 用户可通过拖拽调整 Task 顺序，顺序持久化到数据库。
- **Fallback**: 如果未设置 `sortOrder`（如导入的旧数据），按 `createdAt` 升序显示。
- **Scope**: 排序仅在同一 List 内有效。

### Import / Export / 导入导出
- **Import Default Behavior**: **追加（Additive）**。导入的 Task 和 List 追加到现有数据中，不会清空已有数据。
- **Duplicate Handling**: 导入时如遇同名 List，将导入的 Task 合并到该 List 中。导入的 Task 会获得新 ID。
- **JSON Format**: `{ "lists": [...], "tasks": [...] }`，Task 通过 `listName` 引用 List。
- **CSV Format**: 每行一个 Task，包含列：`title`, `description`, `listName`, `priority`, `dueDate`, `reminderAt`, `completed`。

### Search / Filter / 搜索与筛选
- **Search**: 在当前选中的 List 内，按 Task 标题和描述的子串进行不区分大小写的搜索。
- **Filter**: 在当前选中的 List 内，按 Priority、Completed 等条件过滤。
- **Default Scope**: 默认只在当前选中的 List 内进行。跨 List 搜索不在 v1.0 范围内。

### Theme / 主题
- **Options**: `system`（跟随系统）、`dark`（深色）、`light`（浅色）。
- **Default**: `system`。
- **System Behavior**: 当选择 `system` 时，APP 仅在启动时读取系统主题；运行期间系统主题变化不会实时切换。

## Domain Boundaries

- 一个 Task 必须属于且仅属于一个 List。
- 一个 List 可以包含零个或多个 Task。
- 删除 Task 是硬删除（立即彻底删除），无回收站/撤销机制。
- 删除 List 时，其下所有 Task 级联删除。
- 同一 List 内的 Task 可通过拖拽调整顺序。
- 跨 List 的 Task 移动不在 v1.0 范围内。
- 键盘快捷键不在 v1.0 范围内。
