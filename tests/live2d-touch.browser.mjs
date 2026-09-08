import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// Exercise native browser taps and gesture cancellation against the shipped model.
export async function runTouchChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const checks = []
  const pass = (name) => { checks.push(name); report(name) }
  try {
    await page.goto(new URL('/tests/live2d-recovery.html', baseURL).href)
    const mount = page.getByRole('button', { name: 'Toggle mount', exact: true })
    const stage = page.locator('.live2d-stage')
    const prepare = async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await mount.click()
      await page.locator('canvas.is-ready').waitFor({ timeout: 35000 })
      return page.evaluate(() => {
        const canvas = document.querySelector('canvas.is-ready')
        const rect = canvas.getBoundingClientRect()
        // Hit testing renders synchronously, making the WebGL buffer readable here.
        document.body.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0,
          clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
        }))
        window.dispatchEvent(new PointerEvent('pointercancel'))
        const copy = document.createElement('canvas')
        copy.width = canvas.width; copy.height = canvas.height
        const ctx = copy.getContext('2d')
        ctx.drawImage(canvas, 0, 0)
        const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data
        const bounds = { left: copy.width, top: copy.height, right: 0, bottom: 0 }
        for (let y = 0; y < copy.height; y++) {
          for (let x = 0; x < copy.width; x++) {
            if (pixels[(y * copy.width + x) * 4 + 3] < 24) continue
            bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x + 1)
            bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y + 1)
          }
        }
        if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) throw new Error('Expected visible model pixels')
        const point = (x, y) => ({
          x: rect.left + (bounds.left + (bounds.right - bounds.left) * x) / copy.width * rect.width,
          y: rect.top + (bounds.top + (bounds.bottom - bounds.top) * y) / copy.height * rect.height,
        })
        return { head: point(0.42, 0.36), special: point(0.4, 0.5), body: point(0.36, 0.64), empty: { x: rect.left + 2, y: rect.top + 2 } }
      })
    }
    for (const part of ['head', 'special', 'body']) {
      const points = await prepare()
      // Start animation immediately before the native tap to keep landmarks stable.
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.touchscreen.tap(points[part].x, points[part].y)
      await page.locator(`[data-phase="responding"][data-reaction="touch_${part}"]`).waitFor({ timeout: 5000 })
      assert.ok(await page.locator('.live2d-dialogue').innerText())
      await page.locator('[data-phase="idle"]').waitFor({ timeout: 15000 })
      pass(`Native mobile tap plays touch_${part} once and returns to idle`)
      await mount.click()
    }

    const points = await prepare()
    const gesture = async (kind) => page.evaluate(({ kind, points }) => {
      const start = points.head
      const pointerType = kind === 'pen' ? 'pen' : 'touch'
      const target = kind === 'control' ? document.body.appendChild(document.createElement('button')) : document.elementFromPoint(start.x, start.y)
      const emit = (type, point = start, extra = {}) => target.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 7, pointerType, isPrimary: kind !== 'secondary',
        button: 0, detail: 1, clientX: point.x, clientY: point.y, ...extra,
      }))
      emit('pointerdown', kind === 'empty' ? points.empty : start)
      if (kind === 'drag') {
        emit('pointermove', { x: start.x + 20, y: start.y })
        emit('pointermove')
      }
      if (kind === 'cancel') emit('pointercancel')
      if (kind === 'scroll') window.dispatchEvent(new Event('scroll'))
      emit('pointerup')
      if (kind === 'legacy') {
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1, clientX: start.x, clientY: start.y }))
      } else {
        emit('click', kind === 'region' ? points.body : start, kind === 'mismatch' ? { pointerId: 8 } : {})
      }
      if (kind === 'control') target.remove()
    }, { kind, points })
    for (const kind of ['drag', 'cancel', 'scroll', 'control', 'secondary', 'empty', 'region', 'mismatch']) {
      await gesture(kind)
      assert.equal(await stage.getAttribute('data-phase'), 'idle', `${kind} must not start a response`)
      pass(`${kind} does not trigger a touch response`)
    }
    for (const kind of ['legacy', 'pen']) {
      await gesture(kind)
      await page.locator('[data-reaction="touch_head"]').waitFor({ timeout: 5000 })
      pass(`${kind} click selects the head response`)
      await page.locator('[data-phase="idle"]').waitFor({ timeout: 15000 })
    }
    assert.deepEqual(errors, [])
    return checks
  } finally { await context.close() }
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.COMPANION_BROWSER_EXECUTABLE
    ? { executablePath: process.env.COMPANION_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.COMPANION_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runTouchChecks(browser, process.env.COMPANION_TEST_URL || 'http://127.0.0.1:5173/', (name) => console.log(`PASS: ${name}`))
    console.log(`${checks.length} touch checks passed`)
  } finally { await browser.close() }
}
