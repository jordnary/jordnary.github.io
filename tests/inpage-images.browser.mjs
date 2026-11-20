import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { connectionState } from './page-resources.browser.mjs'

const { chromium } = await import('playwright')
const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
const base = process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4174/'
const output = 'node_modules/.cache/inpage-images'
const results = []
const lifecycle = []
const pass = message => { results.push(message); console.log(`PASS: ${message}`) }
const ready = async (page, selector) => {
  await page.waitForFunction(selector => {
    const images = [...document.querySelectorAll(selector)]
    return images.length > 0 && images.every(image => image.currentSrc && image.complete && image.naturalWidth)
  }, selector)
  await page.locator(selector).evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode()))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}
const closeReader = async page => {
  await page.locator('.home-now-close').click()
  await page.locator('.home-now-reader').waitFor({ state: 'detached' })
}

try {
  await mkdir(output, { recursive: true })
  for (const view of [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    { name: 'landscape', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  ]) {
    const { name, ...settings } = view
    const context = await browser.newContext({ ...settings, reducedMotion: 'reduce', serviceWorkers: 'block' })
    await context.addInitScript(connectionState)
    const page = await context.newPage()
    const errors = []
    const requests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (request.resourceType() === 'image') requests.push(new URL(request.url()).pathname) })
    try {
      await page.goto(new URL('home/', base).href)
      await page.locator('.home-editorial').waitFor()
      const menuPhotos = '.nav-mega-panel .nav-photo-frame img'
      await ready(page, menuPhotos)
      const prepared = await page.locator(menuPhotos).evaluateAll(images => images.map(image => new URL(image.currentSrc).pathname))
      assert.equal(new Set(prepared).size, 4)
      await ready(page, '#selected .home-gallery img, #now .home-gallery img')
      assert.equal(await page.locator('.home-gallery img').count(), 6)
      const mobileMenu = view.viewport.width < 720
      if (mobileMenu) {
        await page.locator('.nav-menu-button').click()
        await page.locator('#mobile-nav-toggle-projects').click()
      } else await page.locator('#nav-toggle-projects').click()
      const menuSelector = mobileMenu ? '.mobile-nav-dialog .nav-photo-frame img' : '#nav-panel-projects .nav-photo-frame img'
      await ready(page, menuSelector)
      const candidates = await page.locator(menuSelector).evaluateAll(images => images.map(image => ({
        path: new URL(image.currentSrc).pathname, width: image.getBoundingClientRect().width, priority: image.fetchPriority,
      })))
      assert.equal(candidates.length, 3)
      for (const candidate of candidates) {
        assert.equal(requests.filter(path => path === candidate.path).length, 1)
        assert.ok(prepared.includes(candidate.path), 'First open uses the already loaded candidate')
        assert.equal(candidate.priority, 'high')
        const metadata = await sharp(await readFile(`public${candidate.path}`)).metadata()
        assert.ok(metadata.width >= candidate.width * view.deviceScaleFactor, `${name}: ${metadata.width}px must cover ${Math.ceil(candidate.width * view.deviceScaleFactor)} rendered pixels (${candidate.path})`)
      }
      await page.screenshot({ path: `${output}/${name}-menu.png` })
      await page.keyboard.press('Escape')
      if (mobileMenu) await page.keyboard.press('Escape')
      pass(`${name}: closed menu and both Home galleries load before interaction; first open reuses the prepared candidates`)

      if (mobileMenu) {
        await page.locator('.nav-menu-button').click()
        await page.locator('#mobile-nav-toggle-about').click()
      } else await page.locator('#nav-toggle-about').click()
      const aboutSelector = mobileMenu ? '.mobile-nav-dialog .nav-photo-frame img' : '#nav-panel-about .nav-photo-frame img'
      await ready(page, aboutSelector)
      const about = await page.locator(aboutSelector).evaluate(image => ({ path: new URL(image.currentSrc).pathname,
        width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height }))
      const metadata = await sharp(await readFile(`public${about.path}`)).metadata()
      assert.ok(metadata.width >= Math.max(about.width, about.height * metadata.width / metadata.height) * view.deviceScaleFactor,
        `${name}: square/landscape cover crop retains source pixel density`)
      await page.keyboard.press('Escape')
      if (mobileMenu) await page.keyboard.press('Escape')
      pass(`${name}: About menu accounts for object-fit crop and shares its prepared source`)

      await page.locator('#now .home-gallery').scrollIntoViewIfNeeded()
      await ready(page, '#now .home-gallery img')
      await page.locator('#now .home-gallery-open').first().click()
      await ready(page, '.home-now-reader-scene img')
      await page.waitForFunction(() => document.querySelector('.home-now-reader')?.dataset.phase === 'open')
      const frame = await page.locator('.home-now-reader-scene img').evaluate(image => new URL(image.currentSrc).pathname)
      assert.equal(requests.filter(path => path === frame).length, 1, 'Home and reader reuse the same frame')
      if (name === 'desktop') assert.equal(requests.includes('/images/home/now-building.webp'), false, 'Reader does not fall back to a second original cover')
      await page.screenshot({ path: `${output}/${name}-reader.png` })
      await closeReader(page)
      assert.ok(await page.locator('#now .home-gallery-open').first().evaluate(element => element === document.activeElement))
      await page.locator('#now .home-gallery-open').first().click()
      await ready(page, '.home-now-reader-scene img')
      await closeReader(page)
      assert.equal(requests.filter(path => path === frame).length, 1, 'Reopening reuses the frame')
      pass(`${name}: reader prewarm/open/reopen reuse, responsive cover, close and focus return`)

      await page.locator('#selected .home-gallery').scrollIntoViewIfNeeded()
      await page.locator('#selected .home-gallery').focus()
      await page.keyboard.press('End')
      await page.keyboard.press('Home')
      await page.keyboard.press('End')
      await page.waitForFunction(() => document.querySelector('#selected .home-gallery-card:last-child')?.dataset.centered === 'true')
      await ready(page, '#selected .home-gallery-card:last-child img')
      const target = await page.locator('#selected .home-gallery-card:last-child img').evaluate(image => new URL(image.currentSrc).pathname)
      assert.equal(requests.filter(path => path === target).length, 1)
      await page.screenshot({ path: `${output}/${name}-gallery.png` })
      assert.deepEqual(errors, [])
      pass(`${name}: rapid End/Home/End prioritizes latest target and downloads it once`)
    } finally { await context.close() }
  }

  const saved = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  await saved.addInitScript(connectionState, { effectiveType: '3g', downlink: 1.6, rtt: 150, saveData: true })
  try {
    const page = await saved.newPage()
    await page.goto(new URL('home/', base).href)
    await ready(page, '.home-gallery img')
    await page.locator('#selected .home-gallery-link[href$="/learning/"]').click()
    await ready(page, '.note-cover-photo')
    assert.equal(await page.locator('.note-cover-photo').count(), 15)
    assert.ok(await page.locator('.notes-gallery').evaluate(el => el.getBoundingClientRect().top >= innerHeight))
    pass('Home and all Learning note covers load on constrained mobile before scrolling their galleries')
  } finally { await saved.close() }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await context.addInitScript(connectionState)
  try {
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('HeapProfiler.enable')
    await page.goto(new URL('home/#now', base).href)
    await ready(page, '#now .home-gallery img')
    for (let cycle = 0; cycle <= 20; cycle++) {
      if (cycle) {
        await page.locator('#now .home-gallery-open').first().click()
        await ready(page, '.home-now-reader-scene img')
        // Compare complete reader visits, including the content mounted after the cover paints.
        await page.locator('.home-now-live-content[aria-busy="false"]').waitFor()
        await closeReader(page)
      }
      if ([0, 5, 10, 20].includes(cycle)) {
        await cdp.send('HeapProfiler.collectGarbage')
        lifecycle.push({ cycle, ...await cdp.send('Memory.getDOMCounters'), ...await cdp.send('Runtime.getHeapUsage'),
          elements: await page.evaluate(() => document.getElementsByTagName('*').length) })
      }
    }
    assert.equal(lifecycle[3].elements, lifecycle[1].elements)
    assert.equal(lifecycle[3].jsEventListeners, lifecycle[1].jsEventListeners)
    pass('Cold hash entry and 20 reader cycles preserve DOM and listener counts after warmup')
  } finally { await context.close() }
  await writeFile(`${output}/checks.json`, JSON.stringify({ results, lifecycle }, null, 2))
  console.log(`${results.length} in-page image checks passed`)
} catch (error) { console.error(`In-page image checks failed: ${error.message}`); process.exitCode = 1 }
finally { await browser.close() }
