#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import http from 'node:http'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const evidenceDir = path.join(projectRoot, '.sisyphus', 'evidence')
const reportPath = path.join(evidenceDir, 'task-19-perf-test.txt')
const memoryReportPath = path.join(evidenceDir, 'task-19-memory-leak.txt')
const DEBUG_PORT = 9231
const APP_NAME = 'ToDoList'
const APP_BUNDLE = `${APP_NAME}.app`
const EXECUTABLE_NAME = 'ToDoList'

function log(lines, message) {
  lines.push(message)
  console.log(`[perf-report] ${message}`)
}

function findDmg() {
  const distDir = path.join(projectRoot, 'dist')
  if (!fs.existsSync(distDir)) return undefined
  return fs.readdirSync(distDir).find((file) => file.endsWith('.dmg'))
}

function mountDmg(dmgPath) {
  const result = spawnSync('hdiutil', ['attach', dmgPath, '-nobrowse', '-readonly'], { encoding: 'utf-8' })
  if (result.status !== 0) throw new Error(`hdiutil attach failed: ${result.stderr}`)
  const last = result.stdout.trim().split('\n').at(-1)
  const mountPoint = last?.split('\t')[2]
  if (!mountPoint || !fs.existsSync(mountPoint)) throw new Error('Failed to parse DMG mount point')
  return mountPoint
}

function detachDmg(mountPoint) {
  spawnSync('hdiutil', ['detach', mountPoint, '-force'], { encoding: 'utf-8' })
}

function resolvePackagedApp() {
  const unpacked = path.join(projectRoot, 'dist/mac-arm64/ToDoList.app/Contents/MacOS/ToDoList')
  if (fs.existsSync(unpacked)) return { executablePath: unpacked, cleanup: () => {} }

  const dmgName = findDmg()
  if (!dmgName) throw new Error('No packaged macOS app or DMG found in dist/')

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-perf-app-'))
  const mountPoint = mountDmg(path.join(projectRoot, 'dist', dmgName))
  try {
    fs.cpSync(path.join(mountPoint, APP_BUNDLE), path.join(tempDir, APP_BUNDLE), { recursive: true })
  } finally {
    detachDmg(mountPoint)
  }

  return {
    executablePath: path.join(tempDir, APP_BUNDLE, 'Contents', 'MacOS', EXECUTABLE_NAME),
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  }
}

function killExistingApp() {
  spawnSync('pkill', ['-x', EXECUTABLE_NAME], { encoding: 'utf-8' })
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (err) {
          reject(err)
        }
      })
    }).on('error', reject)
  })
}

async function waitForDebugPage(timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const pages = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
      if (Array.isArray(pages) && pages.length > 0) return pages
    } catch {
      // debug server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Timed out waiting for renderer debug page')
}

async function seedDatabaseDirectly(userDataDir) {
  try {
    const { default: Database } = await import('better-sqlite3')
    const dbPath = path.join(userDataDir, 'todo.db')
    fs.mkdirSync(userDataDir, { recursive: true })
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    const migrationDir = path.join(projectRoot, 'src/main/db/migrations')
    const migrations = fs.readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort()
    migrations.forEach((file) => {
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf-8')
      const version = Number(file.match(/^(\d+)/)?.[1])
      db.exec(sql)
      db.prepare('INSERT OR IGNORE INTO migrations (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString())
    })
    db.prepare('DELETE FROM tasks').run()
    db.prepare('DELETE FROM lists').run()
    const now = new Date().toISOString()
    const listId = Number(db.prepare('INSERT INTO lists (name, created_at, updated_at) VALUES (?, ?, ?)').run('Perf Seed', now, now).lastInsertRowid)
    const insertTask = db.prepare(
      `INSERT INTO tasks (list_id, title, description, priority, due_date, reminder_at, completed, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?)`,
    )
    db.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        insertTask.run(listId, `Perf task ${i}`, `Description ${i}`, i % 3 === 0 ? 'high' : 'medium', i, now, now)
      }
    })()
    db.close()
    return 'direct-sqlite'
  } catch (err) {
    return `direct seed unavailable: ${err instanceof Error ? err.message : String(err)}`
  }
}

async function seedThroughRenderer(page) {
  return page.evaluate(async () => {
    const api = globalThis.window.electronAPI
    const existingLists = await api.lists.getAll()
    let list = existingLists.find((item) => item.name === 'Perf Seed')
    if (!list) list = await api.lists.create('Perf Seed')
    const existingTasks = await api.tasks.getByListId(list.id)
    for (const task of existingTasks) await api.tasks.delete(task.id)
    for (let i = 0; i < 1000; i++) {
      await api.tasks.create({ list_id: list.id, title: `Perf task ${i}`, description: `Description ${i}`, priority: i % 3 === 0 ? 'high' : 'medium' })
    }
    return list.id
  })
}

async function measureScroll(page) {
  return page.evaluate(async () => {
    const scroller = globalThis.document.querySelector('[data-testid="task-list-container"]')
    if (!(scroller instanceof globalThis.HTMLElement)) throw new Error('Task list container not found')
    const items = globalThis.document.querySelectorAll('[data-testid="task-item"]').length
    const maxScroll = scroller.scrollHeight - scroller.clientHeight
    const frameTimes = []
    let last = performance.now()
    const start = last
    for (let frame = 0; frame < 90; frame++) {
      await new Promise((resolve) => globalThis.requestAnimationFrame(resolve))
      const now = performance.now()
      frameTimes.push(now - last)
      last = now
      scroller.scrollTop = Math.min(maxScroll, (maxScroll * (frame + 1)) / 90)
    }
    const totalMs = performance.now() - start
    const worstFrameMs = Math.max(...frameTimes)
    const averageFrameMs = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length
    return {
      items,
      maxScroll,
      totalMs,
      worstFrameMs,
      averageFrameMs,
      estimatedFps: 1000 / averageFrameMs,
      smooth: worstFrameMs < 200 && averageFrameMs < 34,
    }
  })
}

async function measureMemoryLeak(page) {
  const client = await page.context().newCDPSession(page)
  await client.send('Performance.enable')
  await client.send('HeapProfiler.enable')

  async function usedHeapBytes() {
    await client.send('HeapProfiler.collectGarbage')
    const result = await client.send('Performance.getMetrics')
    const metric = result.metrics.find((item) => item.name === 'JSHeapUsedSize')
    if (!metric) throw new Error('JSHeapUsedSize metric unavailable')
    return metric.value
  }

  const beforeHeapBytes = await usedHeapBytes()
  let lastScroll = null
  for (let i = 0; i < 3; i++) {
    lastScroll = await measureScroll(page)
  }
  const afterHeapBytes = await usedHeapBytes()
  await client.detach()

  const growthBytes = afterHeapBytes - beforeHeapBytes
  const growthPercent = beforeHeapBytes > 0 ? (growthBytes / beforeHeapBytes) * 100 : 0
  return {
    beforeHeapBytes,
    afterHeapBytes,
    growthBytes,
    growthPercent,
    passed: growthPercent < 20,
    lastScroll,
  }
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const lines = ['T19 packaged app performance report', `Date: ${new Date().toISOString()}`]
  if (process.platform !== 'darwin') {
    log(lines, 'Skipped packaged macOS run: current platform is not darwin.')
    fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
    return 0
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-perf-run-'))
  const userDataDir = path.join(tempDir, 'userData')
  let appProcess = null
  let appCleanup = () => {}
  let browser = null

  try {
    const seedMethod = await seedDatabaseDirectly(userDataDir)
    log(lines, `Seed method before launch: ${seedMethod}`)

    const { executablePath, cleanup } = resolvePackagedApp()
    appCleanup = cleanup
    log(lines, `Executable: ${executablePath}`)
    killExistingApp()
    await new Promise((resolve) => setTimeout(resolve, 500))

    const launchStart = Date.now()
    appProcess = spawn(executablePath, [`--remote-debugging-port=${DEBUG_PORT}`], {
      env: { ...process.env, TODO_USER_DATA_DIR: userDataDir },
      stdio: 'ignore',
    })
    await waitForDebugPage()
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`)
    const context = browser.contexts()[0]
    const page = context.pages()[0]
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 20000 })

    let itemCount = await page.locator('[data-testid="task-item"]').count()
    if (itemCount < 1000) {
      log(lines, `Renderer saw ${itemCount} seeded tasks; falling back to renderer IPC seed.`)
      await seedThroughRenderer(page)
      await page.reload()
      await page.waitForSelector('[data-testid="app-shell"]', { timeout: 20000 })
    }
    await page.waitForFunction(() => globalThis.document.querySelectorAll('[data-testid="task-item"]').length >= 1000, null, { timeout: 30000 })
    itemCount = await page.locator('[data-testid="task-item"]').count()
    const loadMs = Date.now() - launchStart
    const memory = await measureMemoryLeak(page)
    const scroll = memory.lastScroll
    if (!scroll) throw new Error('Scroll measurement unavailable')

    const memoryLines = [
      'T19 memory leak evidence',
      `Date: ${new Date().toISOString()}`,
      `Before JS heap: ${memory.beforeHeapBytes.toFixed(0)} bytes`,
      `After JS heap: ${memory.afterHeapBytes.toFixed(0)} bytes`,
      `Heap growth: ${memory.growthBytes.toFixed(0)} bytes (${memory.growthPercent.toFixed(2)}%)`,
      `Repeated scrolls: 3`,
      `Leak threshold passed (<20% growth): ${memory.passed ? 'yes' : 'no'}`,
    ]
    fs.writeFileSync(memoryReportPath, `${memoryLines.join('\n')}\n`)

    log(lines, `Renderer load to 1000 tasks: ${loadMs}ms`)
    log(lines, `Rendered task items: ${itemCount}`)
    log(lines, `Scroll total: ${scroll.totalMs.toFixed(1)}ms`)
    log(lines, `Average frame: ${scroll.averageFrameMs.toFixed(1)}ms (${scroll.estimatedFps.toFixed(1)} FPS)`)
    log(lines, `Worst frame: ${scroll.worstFrameMs.toFixed(1)}ms`)
    log(lines, `Smooth threshold passed: ${scroll.smooth ? 'yes' : 'no'}`)
    log(lines, `Heap growth after repeated scrolls: ${memory.growthPercent.toFixed(2)}%`)
    log(lines, `Memory leak threshold passed: ${memory.passed ? 'yes' : 'no'}`)
    log(lines, scroll.smooth ? 'Virtualization not required by this run.' : 'Virtualization should be considered: scroll exceeded smoothness threshold.')
    fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
    return scroll.smooth && memory.passed ? 0 : 1
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log(lines, `FAILED: ${message}`)
    fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
    fs.writeFileSync(memoryReportPath, `T19 memory leak evidence\nDate: ${new Date().toISOString()}\nFAILED: ${message}\n`)
    return 1
  } finally {
    if (browser) await browser.close().catch(() => {})
    if (appProcess && !appProcess.killed) appProcess.kill('SIGTERM')
    await new Promise((resolve) => setTimeout(resolve, 500))
    killExistingApp()
    appCleanup()
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

process.exit(await main())
