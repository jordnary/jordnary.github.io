import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { connectionState } from './page-resources.browser.mjs'

const { chromium } = await import('playwright')
const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
const base = process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4174/'
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
let passed = 0
const pass = name => { passed++; console.log(`PASS: ${name}`) }
async function setup(settings = {}, connection = { effectiveType: '4g', downlink: 10, rtt: 20, saveData: false }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...settings })
  await context.addInitScript(connectionState, connection)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const requests = []
  page.on('request', request => requests.push(new URL(request.url()).pathname))
  return { context, page, requests, errors }
}
const home = async page => {
  await page.goto(new URL('home/', base).href)
  await page.locator('.home-editorial').waitFor()
}
const reader = async page => {
  await page.locator('#now .home-gallery-open').first().evaluate(el => { el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus(); el.click() })
  await page.waitForFunction(() => document.querySelector('.home-now-reader')?.dataset.phase === 'open'
    && Boolean(document.querySelector('#home-now-reader-title')))
}

try {
  for (const connection of [
    { effectiveType: '4g', downlink: 10, rtt: 20, saveData: false },
    { effectiveType: '4g', downlink: 1.6, rtt: 150, saveData: false },
    { effectiveType: '4g', downlink: 10, rtt: 20, saveData: true },
    {},
  ]) {
    const { context, page, requests, errors } = await setup({}, connection)
    try {
      await home(page)
      assert.equal(requests.filter(url => url.includes('/woodland-wenkai/')).length, 0)
      await page.locator('#now').evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }))
      await page.waitForTimeout(700)
      const speculative = requests.filter(url => url.includes('/woodland-wenkai/'))
      const prepares = !connection.saveData
      assert.deepEqual(speculative, prepares ? ['/fonts/woodland-wenkai/reader.woff2'] : [])
      await reader(page)
      await page.waitForFunction(() => document.querySelector('.home-now-live-content')?.getAttribute('aria-busy') === 'false')
      await page.evaluate(() => document.fonts.ready)
      assert.ok(requests.includes('/fonts/woodland-wenkai/reader.woff2'))
      assert.ok(!requests.includes('/fonts/woodland-wenkai.woff2'))
      assert.deepEqual(errors, [])
      pass(`Font preparation respects ${connection.saveData ? 'Save-Data' : connection.downlink === 10 ? 'fast connection' : connection.downlink ? 'weak connection' : 'unknown connection'}; explicit reading works`)
    } finally { await context.close() }
  }

  for (const kind of ['menu', 'reader', 'gallery']) {
    const { context, page, errors } = await setup(mobile)
    try {
      await context.addInitScript(() => {
        const raf = window.requestAnimationFrame.bind(window)
        const cancel = window.cancelAnimationFrame.bind(window)
        const pending = new Map()
        let next = -1
        window.requestAnimationFrame = callback => {
          if (!window.__holdConstruction) return raf(callback)
          const id = next--
          pending.set(id, callback)
          return id
        }
        window.cancelAnimationFrame = id => { if (id < 0) pending.delete(id); else cancel(id) }
        window.__releaseConstruction = () => { window.__holdConstruction = false; pending.forEach(callback => raf(callback)); pending.clear() }
      })
      if (kind === 'gallery') {
        await page.goto(new URL('projects/vae-gan-digits/', base).href)
        await page.locator('.project-reader-cover').waitFor()
      } else await home(page)
      const trigger = kind === 'reader' ? '#now .home-gallery-open' : kind === 'gallery' ? '.project-reader-cover .project-reader-image-trigger' : '.nav-menu-button'
      await page.locator(trigger).first().evaluate(el => { el.scrollIntoView({ behavior: 'instant', block: 'center' }); el.focus(); window.__holdConstruction = true; el.click() })
      await page.waitForTimeout(150)
      const pending = await page.evaluate(kind => kind === 'reader'
        ? Boolean(document.querySelector('.home-now-reader[open] .home-now-close')) && !document.querySelector('#home-now-reader-title')
        : kind === 'gallery' ? Boolean(document.querySelector('.gallery-opening button')) && !document.querySelector('.yarl__carousel')
          : Boolean(document.querySelector('#mobile-navigation[open] .mobile-nav-close')) && !document.querySelector('.mobile-nav-list'), kind)
      assert.ok(pending, 'The original opening surface and close control precede heavy construction')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(650)
      await page.evaluate(() => window.__releaseConstruction())
      await page.waitForTimeout(150)
      assert.equal(await page.locator('.home-now-reader, .yarl__root, #mobile-navigation[open]').count(), 0)
      assert.ok(await page.locator(trigger).first().evaluate(el => el === document.activeElement), 'Cancellation restores the trigger focus')
      assert.deepEqual(errors, [])
      pass(`${kind}: cancel before construction, no late mount or residual input lock`)
    } finally { await context.close() }
  }

  {
    const { context, page, requests } = await setup()
    try {
      await home(page)
      const css = await readFile('src/components/HomeNow.fonts.css', 'utf8')
      const rules = [...css.matchAll(/src: url\('([^']+)'\)[\s\S]*?unicode-range: ([^;]+);/g)]
      for (const prefix of ['reader', 'common-001', 'extra-004']) {
        const rule = rules.find(match => match[1].includes(`/${prefix}`))
        assert.ok(rule)
        const character = String.fromCodePoint(parseInt(rule[2].match(/U\+([0-9A-F]+)/)[1], 16))
        const count = requests.length
        const loaded = await page.evaluate(async character => (await document.fonts.load('18px "Woodland WenKai"', character)).every(face => face.status === 'loaded'), character)
        assert.ok(loaded)
        assert.deepEqual(requests.slice(count).filter(url => url.includes('/woodland-wenkai/')), [rule[1]])
      }
      pass('Explicit characters request only their exact core, common or extended slice')
    } finally { await context.close() }
  }

  {
    const { context, page, requests, errors } = await setup({}, { effectiveType: '4g', downlink: 1.6, rtt: 150, saveData: false })
    try {
      await home(page)
      const css = await readFile('src/components/HomeNow.fonts.css', 'utf8')
      const points = [...css.matchAll(/src: url\('[^']+\/common-\d+\.woff2'\)[\s\S]*?unicode-range: U\+([0-9A-F]+)/g)]
        .slice(0, 6).map(match => String.fromCodePoint(parseInt(match[1], 16)))
      for (const character of points) await page.evaluate(text => document.fonts.load('18px "Woodland WenKai"', text).then(() => undefined), character)
      await page.waitForTimeout(100)
      const expected = await page.evaluate(() => JSON.parse(sessionStorage.getItem('home-now-font-ranges:v1') || '[]'))
      assert.equal(expected.length, 3)
      // Chromium may probe every previously used font from its local HTTP
      // cache on reload. Measure which faces the page actually prepares, and
      // separately keep the original bound on network transfers.
      await page.addInitScript(() => {
        window.__preparedRanges = []
        const load = FontFace.prototype.load
        FontFace.prototype.load = function () {
          if (this.family === 'Woodland WenKai') window.__preparedRanges.push(this.unicodeRange)
          return load.call(this)
        }
      })
      await page.reload()
      await page.locator('#now').evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }))
      await page.waitForFunction(() => window.__preparedRanges.length >= 3)
      await page.evaluate(() => document.fonts.ready)
      assert.deepEqual(await page.evaluate(() => window.__preparedRanges.sort()), expected.sort())
      const warmed = await page.evaluate(() => performance.getEntriesByType('resource')
        .filter(r => r.transferSize > 0 && r.name.includes('/woodland-wenkai/')).map(r => new URL(r.name).pathname))
      assert.ok(warmed.filter(url => url.includes('/common-')).length <= 3)
      assert.ok(!warmed.some(url => url.includes('/extra-')))
      assert.ok(warmed.length <= 4)
      assert.deepEqual(errors, [])
      pass('Reload prepares at most three previously used common slices; extended glyphs remain on demand')
    } finally { await context.close() }
  }

  {
    const { context, page, errors } = await setup(mobile)
    try {
      await page.route('**/fonts/woodland-wenkai/*.woff2', route => route.abort())
      await page.route('**/fonts/projects-instrument-serif.ttf', route => route.abort())
      await home(page)
      await reader(page)
      await page.waitForFunction(() => document.querySelector('.home-now-live-content')?.getAttribute('aria-busy') === 'false')
      await page.evaluate(() => document.fonts.ready)
      const fallback = await page.locator('.home-now-reader-scroll').evaluate(el => ({
        text: el.textContent.length, overflow: el.scrollWidth - el.clientWidth,
        family: getComputedStyle(el).fontFamily,
        failures: [...document.fonts].filter(face => face.family.includes('Woodland') && face.status === 'error').length,
      }))
      assert.ok(fallback.text > 100 && fallback.failures > 0)
      assert.ok(fallback.overflow < 2)
      assert.match(fallback.family, /KaiTi|Kaiti SC/)
      await page.keyboard.press('Escape')
      await page.locator('.home-now-reader').waitFor({ state: 'detached' })
      assert.deepEqual(errors, [])
      pass('Failed Chinese and display fonts preserve readable text, scrolling and close/focus behavior')
    } finally { await context.close() }
  }

  const cycles = []
  for (const kind of ['menu', 'reader', 'gallery']) {
    const { context, page, errors } = await setup({ ...mobile, reducedMotion: 'reduce' })
    try {
      const cdp = await context.newCDPSession(page)
      if (kind === 'gallery') {
        await page.goto(new URL('projects/vae-gan-digits/', base).href)
        await page.locator('.project-reader-cover').waitFor()
      } else await home(page)
      const samples = []
      for (let count = 1; count <= 20; count++) {
        if (kind === 'reader') await reader(page)
        else if (kind === 'menu') {
          await page.locator('.nav-menu-button').click()
          await page.locator('#mobile-nav-toggle-projects').click()
          await page.locator('.mobile-nav-back').waitFor()
        } else {
          await page.locator('.project-reader-cover .project-reader-image-trigger').click()
          await page.locator('.yarl__carousel').waitFor()
        }
        if (count === 1 && kind !== 'menu') {
          const position = await page.locator('#site-scroll').evaluate(el => {
            const top = el.scrollTop
            const overflow = getComputedStyle(el).overflowY
            el.scrollTop += 120
            return { top, overflow }
          })
          assert.equal(position.overflow, 'auto', 'The viewer keeps the mobile scroll container geometry intact')
          await page.waitForFunction(top => Math.abs(document.querySelector('#site-scroll').scrollTop - top) < 1, position.top)
          await page.mouse.move(5, 5)
          await page.mouse.wheel(0, 200)
          await page.waitForTimeout(80)
          assert.equal(await page.locator('#site-scroll').evaluate(el => el.scrollTop), position.top)
        }
        await page.keyboard.press('Escape')
        await page.waitForFunction(() => !document.querySelector('.home-now-reader,.yarl__root,#mobile-navigation[open]'))
        if ([5, 10, 20].includes(count)) {
          await page.waitForTimeout(100)
          await cdp.send('HeapProfiler.collectGarbage')
          samples.push({ count, ...await cdp.send('Memory.getDOMCounters'), heap: (await cdp.send('Runtime.getHeapUsage')).usedSize,
            elements: await page.evaluate(() => document.getElementsByTagName('*').length) })
        }
      }
      assert.equal(samples[2].elements, samples[1].elements)
      assert.equal(samples[2].nodes, samples[1].nodes)
      assert.equal(samples[2].jsEventListeners, samples[1].jsEventListeners)
      assert.deepEqual(errors, [])
      cycles.push({ kind, samples })
      pass(`${kind}: 20 open/close cycles stabilize DOM and listeners`)
    } finally { await context.close() }
  }
  await mkdir('node_modules/.cache/first-open', { recursive: true })
  await writeFile('node_modules/.cache/first-open/cycles.json', JSON.stringify(cycles, null, 2))
  console.log(`${passed} first-open and font checks passed`)
} catch (error) { console.error(`First-open regression failed: ${error.message}`); process.exitCode = 1 }
finally { await browser.close() }
