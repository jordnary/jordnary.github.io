import assert from 'node:assert/strict'

const { chromium } = await import('playwright')
const browser = await chromium.launch({ channel: process.env.COMPANION_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
try {
  for (const [fixture, viewport] of [['live2d-regression', { width: 1280, height: 900 }], ['live2d-mobile-regression', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport })
    try {
      await page.goto(new URL(`/tests/${fixture}.html`, process.env.COMPANION_TEST_URL || 'http://127.0.0.1:5173/').href)
      await page.waitForFunction(() => /checks passed|Failed:/.test(document.querySelector('#result')?.textContent || ''), undefined, { timeout: 180000 })
      const result = await page.locator('#result').innerText()
      assert.match(result, /^\d+ checks passed$/, `${fixture}: ${result}; last check: ${await page.locator('#checks li').last().textContent()}`)
      console.log(`${fixture}: ${result}`)
    } finally { await page.close() }
  }
} finally { await browser.close() }
