import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const { chromium } = await import('playwright')
const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
const output = 'node_modules/.cache/first-open/visual'
const versions = [['baseline', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4175/'], ['candidate', process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4174/']]
const records = []
try {
  await mkdir(output, { recursive: true })
  for (const file of ['github.json', 'rss.json']) {
    const values = await Promise.all(versions.map(async ([, base]) => (await fetch(new URL(`data/${file}`, base))).text()))
    assert.equal(values[0], values[1], 'Visual comparison requires identical snapshots')
  }
  for (const profile of [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    { name: 'landscape', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  ]) for (const [version, base] of versions) {
    const { name, ...settings } = profile
    const context = await browser.newContext({ ...settings, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const capture = async (scene, selector) => {
      await page.locator(selector).waitFor()
      await page.evaluate(async selector => {
        const root = document.querySelector(selector)
        await Promise.all([...root.querySelectorAll('img')].filter(img => img.currentSrc || img.src).map(img => img.decode().catch(() => {})))
        await document.fonts.ready
      }, selector)
      await page.waitForTimeout(250)
      const geometry = await page.locator(selector).evaluate(root => [...root.querySelectorAll('h2, h3, p, strong, small, img, button, .rss-item-copy > span, .github-repository-main > span')].map(el => {
        const box = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return { tag: el.tagName, x: box.x, y: box.y, width: box.width, height: box.height, font: style.fontFamily, size: style.fontSize }
      }))
      const file = `${name}-${scene}-${version}.png`
      await page.screenshot({ path: `${output}/${file}` })
      records.push({ profile: name, scene, version, geometry, file })
    }
    try {
      await page.goto(new URL('home/', base).href)
      await page.locator('.home-editorial').waitFor()
      if (profile.viewport.width < 720) {
        await page.locator('.nav-menu-button').click()
        await page.locator('#mobile-nav-toggle-projects').click()
        await capture('menu', '.mobile-nav-panel.is-active')
      } else {
        await page.locator('#nav-toggle-projects').click()
        await capture('menu', '#nav-panel-projects')
      }
      await page.keyboard.press('Escape')
      for (const index of [0, 1]) {
        await page.locator('#now .home-gallery-open').nth(index).evaluate(el => { el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus(); el.click() })
        await page.waitForFunction(() => document.querySelector('.home-now-live-content')?.getAttribute('aria-busy') === 'false')
        await capture(index ? 'reading' : 'reader', '.home-now-reader')
        await page.keyboard.press('Escape')
        await page.locator('.home-now-reader').waitFor({ state: 'detached' })
      }
      await page.goto(new URL('projects/vae-gan-digits/', base).href)
      await page.locator('.project-reader-cover .project-reader-image-trigger').click()
      await page.locator('.yarl__slide_current .gallery-original').waitFor()
      await capture('gallery', '.yarl__root')
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
  const comparisons = []
  for (const before of records.filter(record => record.version === 'baseline')) {
    const after = records.find(record => record.version === 'candidate' && record.scene === before.scene && record.profile === before.profile)
    assert.equal(before.geometry.length, after.geometry.length)
    let maxGeometryDifference = 0
    for (let i = 0; i < before.geometry.length; i++) {
      assert.equal(before.geometry[i].font, after.geometry[i].font)
      assert.equal(before.geometry[i].size, after.geometry[i].size)
      for (const key of ['x', 'y', 'width', 'height']) maxGeometryDifference = Math.max(maxGeometryDifference, Math.abs(before.geometry[i][key] - after.geometry[i][key]))
    }
    assert.ok(maxGeometryDifference < 1, `${before.profile} ${before.scene}: preserve text wrapping and layout`)
    const [a, b] = await Promise.all([before, after].map(record => sharp(`${output}/${record.file}`).ensureAlpha().raw().toBuffer()))
    assert.equal(a.length, b.length)
    let changedPixels = 0
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) changedPixels++
    const comparison = { profile: before.profile, scene: before.scene, maxGeometryDifference, changedPixels, totalPixels: a.length / 4 }
    comparisons.push(comparison)
    console.log(JSON.stringify(comparison))
  }
  await writeFile(`${output}/comparison.json`, JSON.stringify({ comparisons, records }, null, 2))
} catch (error) { console.error(`First-open visual comparison failed: ${error.message}`); process.exitCode = 1 }
finally { await browser.close() }
