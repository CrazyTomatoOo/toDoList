import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Shared helpers for driving the settings page (issue #11).
 *
 * The old header theme-toggle button is gone; theme is now chosen in the
 * settings page's 通用 tab via a three-option segmented control.
 */

/** Open the settings page from the header gear button. */
export async function openSettings(page: Page): Promise<void> {
  await page.click('[data-testid="settings-button"]')
  await expect(page.getByTestId('settings-page')).toBeVisible()
}

/** Switch the theme via the settings page's segmented control and close it. */
export async function chooseThemeMode(
  page: Page,
  mode: 'system' | 'light' | 'dark'
): Promise<void> {
  await openSettings(page)
  const option = page.locator(
    `[data-testid="settings-theme-segmented"] button[data-mode="${mode}"]`
  )
  await option.click()
  // Selection applies and persists immediately
  await expect(option).toHaveAttribute('aria-pressed', 'true')
  await page.click('[data-testid="settings-back-button"]')
  await expect(page.getByTestId('settings-page')).toBeHidden()
}

/** Resolve the current theme to an explicit light/dark value. */
export async function currentResolvedTheme(page: Page): Promise<'light' | 'dark'> {
  const attr = await page.evaluate(
    () => document.documentElement.dataset.theme as 'light' | 'dark'
  )
  return attr
}

/**
 * Make sure the resolved theme is `target` by picking it explicitly in
 * settings (unlike the old toggle loop, one click is enough).
 */
export async function ensureResolvedTheme(
  page: Page,
  target: 'light' | 'dark'
): Promise<void> {
  if ((await currentResolvedTheme(page)) === target) return
  await chooseThemeMode(page, target)
  await expect(page.locator('html')).toHaveAttribute('data-theme', target, {
    timeout: 5000,
  })
}
