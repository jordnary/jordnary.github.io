(() => {
  const storageKey = 'jordnary-theme'
  const root = document.documentElement
  const themeColorMeta = document.querySelector('meta[name="theme-color"]')

  const getStoredTheme = () => {
    try {
      const storedTheme = window.localStorage.getItem(storageKey)

      return storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : null
    } catch {
      return null
    }
  }

  const theme = getStoredTheme() ?? 'light'

  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme

  if (themeColorMeta) {
    themeColorMeta.content = theme === 'light' ? '#f8fafc' : '#020617'
  }
})()
