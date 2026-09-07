import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// Supply a Playwright Browser and the URL of a running Vite development server.
export async function runRecoveryChecks(browser, baseURL, report = () => {}) {
  const checks = []
  async function scenario(name, test) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    try {
      await page.goto(new URL('/tests/live2d-recovery.html', baseURL).href)
      await test(page, context)
      assert.deepEqual(errors, [], 'No uncaught errors during recovery')
      checks.push(name)
      report(name)
    } finally { await context.close() }
  }
  const mount = (page) => page.getByRole('button', { name: 'Toggle mount', exact: true }).click()
  const ready = (page) => page.locator('canvas.is-ready').waitFor({ timeout: 35000 })
  const status = (page, value) => page.locator(`[data-load-status="${value}"]`).waitFor({ timeout: 35000 })

  await scenario('Core failure retries once connectivity is restored', async (page) => {
    let requests = 0
    await page.route('https://cubism.live2d.com/**', (route) => ++requests === 1 ? route.abort('failed') : route.continue())
    await mount(page)
    await ready(page)
    assert.equal(requests, 2)
  })

  for (const file of ['model.model3.json', 'textures/texture_00.webp']) {
    await scenario(`${file}: 404 stops automatically and a manual retry succeeds`, async (page) => {
      let requests = 0
      let fail = true
      await page.route(`**/live2d/vampire/${file}`, (route) => {
        requests++
        return fail ? route.fulfill({ status: 404, body: '' }) : route.continue()
      })
      await mount(page)
      await status(page, 'error')
      assert.equal(requests, 1)
      assert.match(await page.locator('.live2d-placeholder').innerText(), /角色资源暂时不可用/)
      fail = false
      await page.getByRole('button', { name: '再试一次' }).press('Enter')
      await ready(page)
      await page.waitForFunction(() => document.activeElement?.classList.contains('live2d-canvas-wrap'))
      assert.equal(requests, 2)
      assert.equal(await page.locator('canvas').count(), 1)
    })
  }

  await scenario('A corrupted texture is rejected without uncaught factory errors', async (page) => {
    await page.route('**/textures/texture_00.webp', (route) => route.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid texture' }))
    await mount(page)
    await status(page, 'error')
    assert.match(await page.locator('.live2d-placeholder').innerText(), /角色资源暂时不可用/)
  })

  await scenario('Offline loading resumes once, while an already loaded model survives offline', async (page, context) => {
    let interrupted = false
    await page.route('**/model.model3.json', async (route) => {
      if (interrupted) return route.continue()
      interrupted = true
      await context.setOffline(true)
      await route.abort('internetdisconnected')
    })
    await mount(page)
    await status(page, 'offline')
    await context.setOffline(false)
    await ready(page)
    await page.evaluate(() => { window.originalCanvas = document.querySelector('canvas') })
    await context.setOffline(true)
    assert.equal(await page.locator('[data-load-status="ready"]').count(), 1)
    assert.equal(await page.evaluate(() => document.querySelector('canvas') === window.originalCanvas), true)
  })

  await scenario('Suspension defers automatic retries until the companion becomes visible', async (page) => {
    let requests = 0
    await page.route('**/model.model3.json', (route) => ++requests === 1 ? route.fulfill({ status: 503, body: '' }) : route.continue())
    await page.getByRole('button', { name: 'Toggle suspension' }).click()
    await mount(page)
    await page.waitForFunction(() => document.querySelector('[data-load-status="recovering"]'))
    await page.clock.install()
    await page.clock.fastForward(6000)
    assert.equal(requests, 1)
    await page.getByRole('button', { name: 'Toggle suspension' }).click()
    await ready(page)
    assert.equal(requests, 2)
  })

  await scenario('A stalled request times out; collapse aborts it and prevents late remounting', async (page) => {
    await page.clock.install()
    let release
    const held = new Promise((resolve) => { release = resolve })
    let requested = false
    let requestStarted
    const request = new Promise((resolve) => { requestStarted = resolve })
    await page.route('**/model.model3.json', async (route) => { requested = true; requestStarted(); await held; await route.abort().catch(() => {}) })
    await mount(page)
    await request
    await page.waitForFunction(() => document.querySelector('[data-load-stage="assets"]'))
    assert.equal(requested, true)
    await page.clock.fastForward(5001)
    assert.match(await page.locator('.live2d-placeholder').innerText(), /这次有点慢/)
    await page.clock.fastForward(25000)
    await status(page, 'recovering')
    await page.getByRole('button', { name: '收起看板娘' }).click()
    release()
    await page.clock.fastForward(60000)
    assert.equal(await page.locator('.live2d-launcher').count(), 1)
    assert.equal(await page.locator('canvas').count(), 0)
  })

  await scenario('Failed motion reloads after online, preserving the same canvas', async (page) => {
    let requests = 0
    await page.route('**/motions/touch_body.motion3.json', (route) => ++requests === 1 ? route.abort('failed') : route.continue())
    await mount(page); await ready(page)
    await page.evaluate(() => { window.originalCanvas = document.querySelector('canvas') })
    const character = page.locator('.live2d-canvas-wrap')
    await character.press('Enter')
    await page.locator('[data-phase="responding"]').waitFor()
    await page.locator('[data-phase="idle"]').waitFor()
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await character.press('Enter')
    await page.locator('[data-phase="responding"]').waitFor()
    assert.equal(requests, 2)
    assert.equal(await page.evaluate(() => document.querySelector('canvas') === window.originalCanvas), true)
  })

  await scenario('WebGL restores twice and stops rebuilding after repeated losses', async (page) => {
    await mount(page); await ready(page)
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas')
        window.originalCanvas = canvas
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
        window.loss = gl.getExtension('WEBGL_lose_context')
        if (!window.loss) throw new Error('Context loss extension unavailable')
        window.loss.loseContext()
      })
      if (i === 2) { await status(page, 'error'); break }
      await status(page, 'recovering')
      await page.evaluate(() => window.loss.restoreContext())
      await ready(page)
      assert.equal(await page.evaluate(() => document.querySelector('canvas') !== window.originalCanvas), true)
      assert.equal(await page.locator('canvas').count(), 1)
      assert.equal(await page.locator('.live2d-dialogue').innerText(), '')
      assert.equal(await page.locator('.live2d-stage').getAttribute('data-phase'), 'idle')
    }
    assert.match(await page.locator('.live2d-placeholder').innerText(), /暂时无法显示动画/)
  })

  await scenario('WebGL unavailability exposes a usable fallback', async (page) => {
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type.includes('webgl') ? null : original.call(this, type, ...args)
      }
    })
    await mount(page); await status(page, 'error')
    assert.match(await page.locator('.live2d-placeholder').innerText(), /暂时无法显示动画/)
    await page.getByRole('button', { name: '收起看板娘' }).click()
    assert.equal(await page.locator('canvas').count(), 0)
  })

  await scenario('WebGL restoration timeout rebuilds without stealing page focus', async (page) => {
    await page.clock.install()
    await mount(page); await ready(page)
    await page.getByRole('button', { name: 'Toggle suspension' }).focus()
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      window.originalCanvas = canvas
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      gl.getExtension('WEBGL_lose_context').loseContext()
    })
    await status(page, 'recovering')
    await page.clock.fastForward(10001)
    await ready(page)
    assert.equal(await page.evaluate(() => document.querySelector('canvas') !== window.originalCanvas), true)
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Toggle suspension')
  })
  return checks
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.COMPANION_BROWSER_EXECUTABLE
    ? { executablePath: process.env.COMPANION_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.COMPANION_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runRecoveryChecks(browser, process.env.COMPANION_TEST_URL || 'http://127.0.0.1:5173/', (name) => console.log(`PASS: ${name}`))
    console.log(`${checks.length} recovery scenarios passed`)
  } finally { await browser.close() }
}
