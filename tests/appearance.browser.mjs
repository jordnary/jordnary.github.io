import assert from 'node:assert/strict'

const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
const browser = await chromium.launch({ channel: process.env.APPEARANCE_BROWSER_CHANNEL || 'msedge', headless: true })
const baseURL = process.env.APPEARANCE_TEST_URL || 'http://127.0.0.1:5173/'

try {
  for (const colorScheme of ['dark', 'light']) {
    const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
    await context.addInitScript(() => {
      sessionStorage.setItem('jordnary-theme', 'dark')
      sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
      sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
      const getItem = Storage.prototype.getItem
      window.legacyThemeReads = 0
      Storage.prototype.getItem = function (key) {
        if (key === 'jordnary-theme') window.legacyThemeReads++
        return getItem.call(this, key)
      }
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    for (const route of ['', 'home/', 'about/', 'learning/', 'projects/', 'contact/', 'projects/briefing-atlas/']) {
      await page.goto(new URL(route, baseURL).href)
      await page.locator('main').waitFor({ state: 'attached' })
      const appearance = await page.evaluate(() => ({
        scheme: getComputedStyle(document.documentElement).colorScheme,
        background: getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim(),
        meta: document.querySelector('meta[name="color-scheme"]')?.content,
        legacyReads: window.legacyThemeReads,
        themeScripts: document.querySelectorAll('script[src*="theme-init"]').length,
      }))
      assert.deepEqual(appearance, { scheme: 'light', background: '#ffffff', meta: 'light', legacyReads: 0, themeScripts: 0 }, `${route || '/'} ignores the old preference and the ${colorScheme} system setting`)
      assert.equal(await page.getByRole('button', { name: /切换到.*主题|深色模式|浅色模式/ }).count(), 0)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(new URL('about/', baseURL).href)
    await page.getByRole('button', { name: '打开导航菜单' }).click()
    const menu = page.getByRole('dialog', { name: '全站导航' })
    await menu.waitFor()
    assert.equal(await menu.getByRole('button', { name: /主题|深色模式|浅色模式/ }).count(), 0)
    assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme), 'light')
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`PASS: Seven routes and mobile navigation remain light with ${colorScheme} system settings and a saved dark preference`)
  }
} finally {
  await browser.close()
}
