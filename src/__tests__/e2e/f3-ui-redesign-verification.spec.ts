import { test, expect, type ElectronApplication, type Page, _electron as electron } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTempUserDataDir } from '../main/ipc.harness'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EVIDENCE_DIR = path.resolve(__dirname, '../../../.omo/evidence/ui-redesign')

async function waitForDbReady(page: Page) {
  for (let i = 0; i < 20; i++) {
    const ok = await page.evaluate(async () => {
      try {
        await window.electronAPI.lists.getAll()
        return true
      } catch {
        return false
      }
    })
    if (ok) return
    await page.waitForTimeout(500)
  }
  throw new Error('Database did not become ready within 10s')
}

async function ensureLightMode(page: Page) {
  const html = page.locator('html')
  const current = await html.getAttribute('data-theme')
  if (current === 'light') return

  const themeToggle = page.locator('[data-testid="theme-toggle"]')
  for (let i = 0; i < 5; i++) {
    const theme = await html.getAttribute('data-theme')
    if (theme === 'light') break
    await themeToggle.click()
    await page.waitForTimeout(300)
  }
  await expect(html).toHaveAttribute('data-theme', 'light', { timeout: 5000 })
}

async function createAndSelectList(page: Page, name: string) {
  const taskFormCancel = page.locator('[data-testid="task-form-cancel"]')
  if (await taskFormCancel.count() > 0) {
    await taskFormCancel.click()
  }

  const listFormCancel = page.locator('[data-testid="list-form-cancel"]')
  if (await listFormCancel.count() > 0) {
    await listFormCancel.click()
  }

  await page.click('[data-testid="add-list-button"]')
  await page.fill('[data-testid="list-form-input"]', name)
  await page.click('[data-testid="list-form-save"]')

  const newListItem = page.locator('[data-testid="sidebar-item"]').filter({
    has: page.locator('[data-testid="sidebar-item-name"]', { hasText: name })
  })
  await expect(newListItem).toBeVisible({ timeout: 10000 })
  await newListItem.locator('.sidebar-item-button').click()

  await expect(page.locator('.main-header h1')).toHaveText(name, { timeout: 10000 })

  const listToggle = page.locator('[data-testid="view-toggle-list"]')
  if (await listToggle.count() > 0) {
    await listToggle.click()
  }

  await expect(page.locator('[data-testid="task-list-empty"]')).toBeVisible({ timeout: 10000 })
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/)
  if (!match) return rgb.toLowerCase()
  const r = parseInt(match[1], 10).toString(16).padStart(2, '0')
  const g = parseInt(match[2], 10).toString(16).padStart(2, '0')
  const b = parseInt(match[3], 10).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

function isCloseTo(actual: string, expected: string): boolean {
  return rgbToHex(actual).toLowerCase() === expected.toLowerCase()
}

function isNeutralNScale(color: string): boolean {
  const neutrals = [
    '#f7f8fa',
    '#f2f3f5',
    '#e5e6eb',
    '#c9cdd4',
    '#a9aeb8',
    '#86909c',
    '#6b7785',
    '#4e5969',
    '#272e3b',
    '#1d2129',
    '#ffffff'
  ]
  return neutrals.includes(rgbToHex(color).toLowerCase())
}

function isMultipleOf8(value: string): boolean {
  const num = parseFloat(value)
  return Number.isFinite(num) && num % 8 === 0
}

test.describe('F3 - Final verification (ui-redesign)', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    const userDataDir = createTempUserDataDir('todolist-f3-uiredesign-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir
      }
    })
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('empty state renders with card treatment', async () => {
    const page = await electronApp.firstWindow()
    await createAndSelectList(page, 'F3 Empty State')

    const emptyState = page.locator('[data-testid="task-list-empty"]')
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toHaveClass(/tasklist-card/)
    await expect(emptyState.locator('.tasklist-card-text')).toBeVisible()

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'final-f3-empty-state.png'),
      fullPage: false
    })
  })

  test('invalid dates show field-level error', async () => {
    const page = await electronApp.firstWindow()
    await createAndSelectList(page, 'F3 Invalid Dates')

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Invalid duration')
    await page.fill('[data-testid="task-form-start-date"]', '2026-07-20')
    await page.fill('[data-testid="task-form-end-date"]', '2026-07-10')
    await page.click('[data-testid="task-form-save"]')

    const error = page.locator('[data-testid="task-form-duration-error"]')
    await expect(error).toBeVisible()
    await expect(error).toHaveText('Start date must be before or equal to end date')
    await expect(error).toHaveAttribute('role', 'alert')
    await expect(error).toHaveAttribute('aria-live', 'polite')

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'final-f3-invalid-date.png'),
      fullPage: false
    })

    await page.click('[data-testid="task-form-cancel"]')
  })

  test('rapid toggles keep completion state consistent', async () => {
    const page = await electronApp.firstWindow()
    await createAndSelectList(page, 'F3 Rapid Toggles')

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Rapid toggle task')
    await page.click('[data-testid="task-form-save"]')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })

    const checkbox = page.locator('[data-testid="task-checkbox"]').first()
    const title = page.locator('[data-testid="task-title"]').first()

    // Toggle 5 times rapidly without waiting between clicks
    for (let i = 0; i < 5; i++) {
      await checkbox.click()
    }

    await page.waitForTimeout(1000)

    // After an odd number of toggles, the task should be completed
    await expect(checkbox).toHaveAttribute('aria-checked', 'true')
    await expect(title).toHaveClass(/completed/)

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'final-f3-rapid-toggles.png'),
      fullPage: false
    })
  })

  test('computed styles match design tokens', async () => {
    const page = await electronApp.firstWindow()
    await createAndSelectList(page, 'F3 Computed Styles')
    await ensureLightMode(page)
    await page.waitForTimeout(300)

    // Brand color on primary button (Add Task)
    const brandColor = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="add-task-button"]') as HTMLElement
      return window.getComputedStyle(btn).backgroundColor
    })
    expect(isCloseTo(brandColor, '#1456f0')).toBe(true)

    // Neutral surfaces: tasklist-card, sidebar, main-area, app-shell
    const surfaceBg = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="task-list-empty"]') as HTMLElement
      const sidebar = document.querySelector('[data-testid="list-sidebar"]') as HTMLElement
      const mainArea = document.querySelector('.main-area') as HTMLElement
      const app = document.querySelector('[data-testid="app-shell"]') as HTMLElement
      return {
        card: window.getComputedStyle(card).backgroundColor,
        sidebar: window.getComputedStyle(sidebar).backgroundColor,
        mainArea: window.getComputedStyle(mainArea).backgroundColor,
        app: window.getComputedStyle(app).backgroundColor
      }
    })
    expect(isNeutralNScale(surfaceBg.card)).toBe(true)
    expect(isNeutralNScale(surfaceBg.sidebar)).toBe(true)
    expect(isNeutralNScale(surfaceBg.mainArea)).toBe(true)
    expect(isNeutralNScale(surfaceBg.app)).toBe(true)

    // 8px-multiple padding on key containers
    const paddings = await page.evaluate(() => {
      const main = document.querySelector('[data-testid="task-list-container"]') as HTMLElement
      const card = document.querySelector('[data-testid="task-list-empty"]') as HTMLElement
      const sidebar = document.querySelector('[data-testid="list-sidebar"]') as HTMLElement
      const header = document.querySelector('.main-header') as HTMLElement
      return {
        main: window.getComputedStyle(main).padding,
        card: window.getComputedStyle(card).padding,
        sidebar: window.getComputedStyle(sidebar).padding,
        header: window.getComputedStyle(header).padding
      }
    })

    const allPaddingValues = [
      ...paddings.main.split(' '),
      ...paddings.card.split(' '),
      ...paddings.sidebar.split(' '),
      ...paddings.header.split(' ')
    ]
    for (const val of allPaddingValues) {
      expect(isMultipleOf8(val)).toBe(true)
    }

    // Capture one screenshot per assertion category for the evidence bundle
    const brandBtn = page.locator('[data-testid="add-task-button"]')
    await brandBtn.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'final-f3-brand.png'), fullPage: false })

    const neutralCard = page.locator('[data-testid="task-list-empty"]')
    await neutralCard.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'final-f3-neutral.png'), fullPage: false })

    const mainContainer = page.locator('[data-testid="task-list-container"]')
    await mainContainer.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'final-f3-padding.png'), fullPage: false })
  })
})
