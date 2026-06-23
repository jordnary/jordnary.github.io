export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'jordnary-theme'

const themeColors: Record<Theme, string> = {
  dark: '#020617',
  light: '#f8fafc',
}

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark'
}

export function getStoredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

    return isTheme(storedTheme) ? storedTheme : null
  } catch {
    return null
  }
}

export function getInitialTheme(): Theme {
  const storedTheme = getStoredTheme()

  if (storedTheme) {
    return storedTheme
  }

  if (typeof document !== 'undefined') {
    const currentTheme = document.documentElement.dataset.theme

    if (isTheme(currentTheme)) {
      return currentTheme
    }
  }

  return 'light'
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  const themeColorMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )

  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme

  if (themeColorMeta) {
    themeColorMeta.content = themeColors[theme]
  }
}

export function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Theme switching still works even when storage is unavailable.
  }
}
