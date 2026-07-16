import { test, expect, type ElectronApplication, type Page, _electron as electron } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTempUserDataDir } from '../main/ipc.harness'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

async function setupListAndTasks(page: Page) {
  // Create a list
  await page.click('[data-testid="add-list-button"]')
  await page.fill('[data-testid="list-form-input"]', 'A11y Test List')
  await page.click('[data-testid="list-form-save"]')
  await page.waitForTimeout(500)

  // Create a task
  await page.click('[data-testid="add-task-button"]')
  await page.fill('[data-testid="task-form-title"]', 'Test task for a11y')
  await page.click('[data-testid="task-form-save"]')
  await page.waitForTimeout(500)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runAxeCore(page: Page): Promise<{ violations: any[]; passes: any[]; incomplete: any[] }> {
  // Inject axe-core from node_modules
  const axeSource = fs.readFileSync(
    path.resolve(__dirname, '../../../node_modules/axe-core/axe.min.js'),
    'utf-8'
  )
  await page.addScriptTag({ content: axeSource })

  // Run axe-core analysis
  const results = await page.evaluate(async () => {
    // @ts-expect-error - axe is injected at runtime
    return await window.axe.run(document.documentElement, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
      }
    })
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results as { violations: any[]; passes: any[]; incomplete: any[] }
}

test.describe('Task 9 - Accessibility fixes', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-task9-a11y-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir
      }
    })
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('axe-core scan and keyboard traversal in light and dark modes', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)
    await setupListAndTasks(page)

    const evidenceLines: string[] = [
      '=== Task 9: Accessibility Evidence ===',
      `Date: ${new Date().toISOString()}`,
      ''
    ]

    // --- Light Mode ---
    // Ensure light mode
    const themeToggle = page.locator('[data-testid="theme-toggle"]')
    let ariaLabel = await themeToggle.getAttribute('aria-label')
    if (ariaLabel?.includes('dark')) {
      await themeToggle.click()
      await page.waitForTimeout(300)
    }

    const lightResults = await runAxeCore(page)
    evidenceLines.push(
      '--- Light Mode Axe-Core Scan ---',
      `Violations: ${lightResults.violations.length}`,
      `Passes: ${lightResults.passes.length}`,
      `Incomplete: ${lightResults.incomplete.length}`,
      ''
    )
    if (lightResults.violations.length > 0) {
      evidenceLines.push('Violations detail:')
      for (const v of lightResults.violations) {
        evidenceLines.push(`  - ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
      }
    } else {
      evidenceLines.push('No violations found in light mode.')
    }
    evidenceLines.push('')

    expect(lightResults.violations).toEqual([])

    // --- Dark Mode ---
    ariaLabel = await themeToggle.getAttribute('aria-label')
    if (ariaLabel?.includes('light')) {
      await themeToggle.click()
      await page.waitForTimeout(300)
    }

    const darkResults = await runAxeCore(page)
    evidenceLines.push(
      '--- Dark Mode Axe-Core Scan ---',
      `Violations: ${darkResults.violations.length}`,
      `Passes: ${darkResults.passes.length}`,
      `Incomplete: ${darkResults.incomplete.length}`,
      ''
    )
    if (darkResults.violations.length > 0) {
      evidenceLines.push('Violations detail:')
      for (const v of darkResults.violations) {
        evidenceLines.push(`  - ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
      }
    } else {
      evidenceLines.push('No violations found in dark mode.')
    }
    evidenceLines.push('')

    expect(darkResults.violations).toEqual([])

    // --- Keyboard Traversal ---
    // Switch back to light mode for consistent testing
    ariaLabel = await themeToggle.getAttribute('aria-label')
    if (ariaLabel?.includes('dark')) {
      await themeToggle.click()
      await page.waitForTimeout(300)
    }

    // Tab through the app and collect focused elements
    const focusedElements: string[] = []
    const maxTabs = 30

    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(50)

      const focused = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return null
        const testid = el.getAttribute('data-testid')
        const tag = el.tagName.toLowerCase()
        const role = el.getAttribute('role')
        const ariaLabel = el.getAttribute('aria-label')
        return { testid, tag, role, ariaLabel }
      })

      if (!focused) break

      const identifier =
        focused.testid ||
        `${focused.tag}${focused.role ? `[role=${focused.role}]` : ''}${focused.ariaLabel ? `[aria="${focused.ariaLabel}"]` : ''}`
      focusedElements.push(identifier)

      // Stop if we've cycled back
      if (focusedElements.length > 2 && focusedElements[0] === identifier) {
        break
      }
    }

    evidenceLines.push(
      '--- Keyboard Traversal Test ---',
      `Tab order (${focusedElements.length} elements):`,
      ...focusedElements.map((el, i) => `  ${i + 1}. ${el}`),
      ''
    )

    // Verify key interactive elements are focusable
    const hasSidebarButton = focusedElements.some((el) => el.includes('sidebar-item'))
    const hasThemeToggle = focusedElements.some((el) => el.includes('theme-toggle'))
    const hasAddTask = focusedElements.some((el) => el.includes('add-task-button'))

    evidenceLines.push(
      'Key checks:',
      `  - Sidebar button focusable: ${hasSidebarButton}`,
      `  - Theme toggle focusable: ${hasThemeToggle}`,
      `  - Add task button focusable: ${hasAddTask}`,
      ''
    )

    expect(focusedElements.length).toBeGreaterThan(3)
    expect(hasSidebarButton).toBe(true)
    expect(hasThemeToggle).toBe(true)
    expect(hasAddTask).toBe(true)

    // --- Contrast Ratios ---
    const contrastResults = await page.evaluate(() => {
      const parseColor = (color: string): [number, number, number] => {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
        return [0, 0, 0]
      }

      const luminance = (r: number, g: number, b: number): number => {
        const [rs, gs, bs] = [r, g, b].map((c) => {
          const s = c / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
      }

      const getContrastRatio = (fg: string, bg: string): number => {
        const [r1, g1, b1] = parseColor(fg)
        const [r2, g2, b2] = parseColor(bg)
        const l1 = luminance(r1, g1, b1)
        const l2 = luminance(r2, g2, b2)
        const lighter = Math.max(l1, l2)
        const darker = Math.min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
      }

      const getComputedColors = (selector: string): { fg: string; bg: string } => {
        const el = document.querySelector(selector)
        if (!el) return { fg: '', bg: '' }
        const style = window.getComputedStyle(el)
        return { fg: style.color, bg: style.backgroundColor }
      }

      const results: { element: string; fg: string; bg: string; ratio: number; passes: boolean }[] = []

      const title = getComputedColors('[data-testid="task-title"]')
      if (title.fg && title.bg) {
        const ratio = getContrastRatio(title.fg, title.bg)
        results.push({
          element: 'task-title on task-item',
          fg: title.fg,
          bg: title.bg,
          ratio: Math.round(ratio * 100) / 100,
          passes: ratio >= 4.5
        })
      }

      const dueDate = getComputedColors('.task-due-date')
      if (dueDate.fg && dueDate.bg) {
        const ratio = getContrastRatio(dueDate.fg, dueDate.bg)
        results.push({
          element: 'task-due-date (tertiary)',
          fg: dueDate.fg,
          bg: dueDate.bg,
          ratio: Math.round(ratio * 100) / 100,
          passes: ratio >= 4.5
        })
      }

      const priorityHigh = getComputedColors('.task-priority.high')
      if (priorityHigh.fg && priorityHigh.bg) {
        const ratio = getContrastRatio(priorityHigh.fg, priorityHigh.bg)
        results.push({
          element: 'priority-high on danger-light',
          fg: priorityHigh.fg,
          bg: priorityHigh.bg,
          ratio: Math.round(ratio * 100) / 100,
          passes: ratio >= 4.5
        })
      }

      const sidebarName = getComputedColors('[data-testid="sidebar-item-name"]')
      if (sidebarName.fg && sidebarName.bg) {
        const ratio = getContrastRatio(sidebarName.fg, sidebarName.bg)
        results.push({
          element: 'sidebar-item-name',
          fg: sidebarName.fg,
          bg: sidebarName.bg,
          ratio: Math.round(ratio * 100) / 100,
          passes: ratio >= 4.5
        })
      }

      return results
    })

    evidenceLines.push(
      '--- Contrast Ratios (Light Mode) ---',
      ...contrastResults.map(
        (r) => `  ${r.element}: ${r.ratio}:1 (${r.passes ? 'PASS' : 'FAIL'}) [fg: ${r.fg}, bg: ${r.bg}]`
      ),
      '',
      `All pass: ${contrastResults.every((r) => r.passes)}`,
      ''
    )

    for (const result of contrastResults) {
      expect(result.passes, `${result.element} contrast ${result.ratio}:1 < 4.5:1`).toBe(true)
    }

    // Write evidence
    const evidencePath = '.omo/evidence/ui-redesign/task-9-a11y.txt'
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true })
    fs.writeFileSync(evidencePath, evidenceLines.join('\n'))
  })

  test('hidden task actions keyboard behavior', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    // Setup data for this test
    await setupListAndTasks(page)

    // Wait for task to be visible
    await page.waitForSelector('[data-testid="task-item"]', { timeout: 5000 })

    // Focus the task checkbox
    const taskCheckbox = page.locator('[data-testid="task-checkbox"]')
    await taskCheckbox.first().focus()

    // Tab to next element - should be edit button (actions visible via focus-within)
    await page.keyboard.press('Tab')
    const focusedAfterFirstTab = await page.evaluate(() => {
      const el = document.activeElement
      return el?.getAttribute('data-testid') || el?.tagName.toLowerCase()
    })

    // Tab again to delete button
    await page.keyboard.press('Tab')
    const focusedAfterSecondTab = await page.evaluate(() => {
      const el = document.activeElement
      return el?.getAttribute('data-testid') || el?.tagName.toLowerCase()
    })

    // Write failure evidence
    const failureEvidencePath = '.omo/evidence/ui-redesign/task-9-a11y-failure.txt'
    const failureContent = [
      '=== Task 9: Hidden Actions Keyboard Test ===',
      `Date: ${new Date().toISOString()}`,
      '',
      'Test: Tab to a hidden action and verify behavior.',
      '',
      'Result: Task actions (edit/delete) are hidden via opacity:0 by default.',
      'They become visible (opacity:1) when the task-item has focus-within.',
      'Keyboard navigation: Tab focuses task-checkbox -> task-edit-button -> task-delete-button.',
      'The actions are reachable via keyboard ONLY when focus is within the task item.',
      '',
      'Focused elements after tabbing to task:',
      `  1. task-checkbox (focused first)`,
      `  2. ${focusedAfterFirstTab} (after first Tab)`,
      `  3. ${focusedAfterSecondTab} (after second Tab)`,
      ''
    ].join('\n')

    fs.mkdirSync(path.dirname(failureEvidencePath), { recursive: true })
    fs.writeFileSync(failureEvidencePath, failureContent)

    expect(focusedAfterFirstTab).toBe('task-edit-button')
    expect(focusedAfterSecondTab).toBe('task-delete-button')
  })
})
