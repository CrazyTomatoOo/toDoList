// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ElectronAPI, ResolvedTheme, ThemeMode } from '../../shared/ipc'
import {
  getSystemTheme,
  getSavedMode,
  saveMode,
  resolveTheme,
  applyTheme,
  cycleTheme,
  initTheme
} from '../../renderer/services/theme'

describe('theme service', () => {
  let savedMode: ThemeMode | string
  let systemTheme: ResolvedTheme

  beforeEach(() => {
    savedMode = 'system'
    systemTheme = 'light'
    document.documentElement.removeAttribute('data-theme')

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        theme: {
          getSystemTheme: vi.fn(async () => systemTheme),
          getMode: vi.fn(async () => savedMode),
          setMode: vi.fn(async (mode: ThemeMode) => {
            savedMode = mode
          })
        }
      } as unknown as ElectronAPI
    })
  })

  describe('getSystemTheme', () => {
    it('returns light when the main process reports light', async () => {
      systemTheme = 'light'
      await expect(getSystemTheme()).resolves.toBe('light')
    })

    it('returns dark when the main process reports dark', async () => {
      systemTheme = 'dark'
      await expect(getSystemTheme()).resolves.toBe('dark')
    })
  })

  describe('getSavedMode', () => {
    it('returns system when nothing saved', async () => {
      await expect(getSavedMode()).resolves.toBe('system')
    })

    it('returns saved mode from IPC', async () => {
      savedMode = 'dark'
      await expect(getSavedMode()).resolves.toBe('dark')
    })

    it('returns system for invalid values', async () => {
      savedMode = 'invalid'
      await expect(getSavedMode()).resolves.toBe('system')
    })
  })

  describe('saveMode', () => {
    it('persists mode through IPC', async () => {
      await saveMode('dark')
      expect(window.electronAPI.theme.setMode).toHaveBeenCalledWith('dark')
      expect(savedMode).toBe('dark')
    })
  })

  describe('resolveTheme', () => {
    it('returns light for light mode', async () => {
      await expect(resolveTheme('light')).resolves.toBe('light')
    })

    it('returns dark for dark mode', async () => {
      await expect(resolveTheme('dark')).resolves.toBe('dark')
    })

    it('resolves system to current system preference', async () => {
      systemTheme = 'dark'
      await expect(resolveTheme('system')).resolves.toBe('dark')

      systemTheme = 'light'
      await expect(resolveTheme('system')).resolves.toBe('light')
    })
  })

  describe('applyTheme', () => {
    it('sets data-theme attribute on documentElement', async () => {
      await applyTheme('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')
    })

    it('resolves system mode before applying', async () => {
      systemTheme = 'dark'
      await applyTheme('system')
      expect(document.documentElement.dataset.theme).toBe('dark')
    })
  })

  describe('cycleTheme', () => {
    it('cycles system → light', () => {
      expect(cycleTheme('system')).toBe('light')
    })

    it('cycles light → dark', () => {
      expect(cycleTheme('light')).toBe('dark')
    })

    it('cycles dark → system', () => {
      expect(cycleTheme('dark')).toBe('system')
    })
  })

  describe('initTheme', () => {
    it('applies saved mode and returns it', async () => {
      savedMode = 'dark'
      const mode = await initTheme()
      expect(mode).toBe('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')
    })

    it('defaults to system and applies system preference', async () => {
      systemTheme = 'light'
      const mode = await initTheme()
      expect(mode).toBe('system')
      expect(document.documentElement.dataset.theme).toBe('light')
    })
  })
})
