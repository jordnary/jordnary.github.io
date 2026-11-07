import assert from 'node:assert/strict'
import { preview } from 'vite'
import { chromium } from 'playwright'

// Run after build:test-preview. Exercise the real document response, including
// resolving its scripts, styles and home link from an unrelated nested URL.
const server = await preview({ logLevel: 'silent', build: { outDir: 'node_modules/.cache/production-preview' },
  preview: { host: '127.0.0.1', port: 0 } })
let browser
try {
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  const missing = `${origin}/missing/nested/document.html?from=test`
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL })
  const page = await browser.newPage({ viewport: { width: 1440, height: 826 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  assert.equal((await page.goto(missing)).status(), 404)
  await page.getByRole('heading', { name: /404.*was not found/ }).waitFor()
  assert.equal(page.url(), missing)
  assert.equal(await page.locator('nav [aria-current="page"]').count(), 0)
  await page.locator('.not-found-counter use[href$="#n1"]').waitFor({ state: 'attached' })
  await page.waitForFunction(() => document.querySelector('.not-found-curtain').hidden)
  const poses = () => page.locator('.not-found-digits path').evaluateAll(digits =>
    digits.map(d => getComputedStyle(d).transform))
  const falling = await poses()
  await page.waitForFunction(() => !document.querySelector('.not-found-digits').getAnimations({ subtree: true }).length)
  const rest = await poses()
  assert.notDeepEqual(falling, rest, 'The pile moves after the counter lifts')
  await page.getByRole('link', { name: 'Go back to the home page' }).click()
  await page.waitForURL(origin + '/')

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  assert.equal((await mobile.goto(missing)).status(), 404)
  await mobile.locator('.not-found').waitFor()
  assert.equal(await mobile.locator('.not-found-curtain').isVisible(), false)
  assert.deepEqual(await mobile.locator('.not-found-digits path').evaluateAll(digits =>
    digits.map(d => getComputedStyle(d).transform)), rest, 'Reduced motion shows the same resting poses immediately')
  assert.ok(await mobile.locator('.not-found').evaluate(el => {
    const { top, bottom, width } = el.getBoundingClientRect()
    return top >= 0 && bottom <= innerHeight + 1 && width <= innerWidth && el.scrollWidth === el.clientWidth
  }), 'The mobile scene fits under the navigation')
  assert.deepEqual(errors, [])
  console.log('Passed: nested 404 response, shared navigation, drop, home link and reduced-motion mobile layout')
} finally {
  await browser?.close()
  await server.close()
}
