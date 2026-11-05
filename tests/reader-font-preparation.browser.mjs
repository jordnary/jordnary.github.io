import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { connectionState } from './page-resources.browser.mjs'

// Deliberately approach the reader without opening it: all warmed reader fonts
// are unconsumed in this window. Wait for completion rather than hiding bytes.
const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || 'msedge', headless: true, args: ['--force-effective-connection-type=3G'] })
const samples = []
try {
  for (const [version, base] of [['baseline', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4175/'], ['candidate', process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4174/']]) {
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
      await context.addInitScript(connectionState, { effectiveType: '4g', downlink: 1.6, rtt: 150, saveData: false })
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      const requests = new Map()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      cdp.on('Network.requestWillBeSent', event => requests.set(event.requestId, { path: new URL(event.request.url).pathname, type: event.type, bytes: 0, done: false }))
      cdp.on('Network.loadingFinished', event => Object.assign(requests.get(event.requestId) || {}, { bytes: event.encodedDataLength, done: true }))
      await cdp.send('Network.enable')
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await cdp.send('Network.emulateNetworkConditionsByRule', { offline: false, matchedNetworkConditions: [{ urlPattern: '', latency: 150,
        downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 }] })
      try {
        await page.goto(new URL('home/', base).href, { waitUntil: 'domcontentloaded' })
        await page.locator('.home-editorial').waitFor()
        await page.waitForTimeout(500)
        const timing = await page.evaluate(async () => {
          const start = performance.now()
          document.querySelector('#now .home-gallery').scrollIntoView({ block: 'center', behavior: 'instant' })
          const image = document.querySelector('#now .home-gallery img')
          const imageReady = new Promise(resolve => {
            const sample = () => {
              if (image.currentSrc && image.complete && image.naturalWidth) void image.decode().then(() => resolve(performance.now() - start))
              else requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
          })
          const fontsReady = new Promise(resolve => {
            const sample = () => {
              const fonts = [...document.fonts].filter(face => face.family.includes('Woodland') && face.status === 'loaded')
              if (fonts.length >= 2 && document.fonts.status === 'loaded') resolve(performance.now() - start)
              else requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
          })
          let timer
          try {
            const [imageMs, fontMs] = await Promise.race([Promise.all([imageReady, fontsReady]), new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('Reader preparation did not complete')), 25000)
            })])
            return { imageMs, fontMs }
          } finally { clearTimeout(timer) }
        })
        await page.waitForTimeout(500)
        assert.equal(await page.locator('.home-now-reader').count(), 0)
        assert.deepEqual(errors, [])
        const fonts = [...requests.values()].filter(item => /woodland-wenkai|projects-instrument-serif/.test(item.path))
        assert.ok(fonts.length > 0 && fonts.every(font => font.done))
        const result = { version, run, ...timing, unconsumedFontBytes: fonts.reduce((sum, item) => sum + item.bytes, 0), fonts }
        samples.push(result)
        console.log(JSON.stringify({ version, run, ...timing, unconsumedFontKiB: result.unconsumedFontBytes / 1024 }))
      } finally { await context.close() }
    }
  }
  await mkdir('node_modules/.cache/first-open', { recursive: true })
  await writeFile('node_modules/.cache/first-open/preparation.json', JSON.stringify({ browser: browser.version(), samples }, null, 2))
} catch (error) { console.error(`Reader preparation measurement failed: ${error.message}`); process.exitCode = 1 }
finally { await browser.close() }
