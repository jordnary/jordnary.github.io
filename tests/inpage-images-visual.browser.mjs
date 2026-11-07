import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { connectionState } from './page-resources.browser.mjs'

const output = 'node_modules/.cache/inpage-images/visual'
const versions = [
  ['baseline', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4175/'],
  ['candidate', process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4174/'],
]
const views = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'landscape', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
]
const ready = async (page, selector) => {
  await page.waitForFunction(selector => {
    const images = [...document.querySelectorAll(selector)]
    return images.length && images.every(image => image.currentSrc && image.complete && image.naturalWidth)
  }, selector)
  await page.locator(selector).evaluateAll(images => Promise.all(images.map(image => image.decode())))
}
const { chromium } = await import('playwright')
const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
const records = []
try {
  await mkdir(output, { recursive: true })
  for (const file of ['github.json', 'rss.json']) {
    const snapshots = await Promise.all(versions.map(async ([, base]) => {
      const response = await fetch(new URL(`data/${file}`, base))
      assert.ok(response.ok, `The ${file} fixture must be available`)
      return response.text()
    }))
    assert.ok(snapshots.every(value => value === snapshots[0]), `Use identical ${file} fixtures for both versions`)
  }
  for (const { name: view, ...settings } of views) for (const [version, base] of versions) {
    const context = await browser.newContext({ ...settings, reducedMotion: 'reduce', serviceWorkers: 'block' })
    await context.addInitScript(connectionState)
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const capture = async (scene, selector) => {
        await ready(page, selector)
        await page.evaluate(async () => {
          await document.fonts.ready
          for (const animation of document.getAnimations()) {
            const end = animation.effect?.getComputedTiming().endTime
            animation.pause()
            animation.currentTime = Number.isFinite(end) ? end : 0
          }
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        })
        await page.waitForTimeout(100)
        const images = await page.locator(selector).evaluateAll(images => images.map(image => {
          const rect = image.getBoundingClientRect()
          const style = getComputedStyle(image)
          return { path: new URL(image.currentSrc).pathname,
            geometry: { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
              objectFit: style.objectFit, objectPosition: style.objectPosition, filter: style.filter,
              transform: style.transform, opacity: style.opacity } }
        }))
        for (const image of images) {
          const root = version === 'baseline' ? 'node_modules/.cache/inpage-images/baseline' : 'dist'
          const { width, height } = await sharp(await readFile(`${root}${image.path}`)).metadata()
          image.sourcePixels = { width, height }
        }
        const file = `${view}-${scene}-${version}.png`
        await page.screenshot({ path: `${output}/${file}` })
        records.push({ view, version, scene, file, images })
      }
      await page.goto(new URL('home/', base).href)
      await page.locator('.home-editorial').waitFor()
      const mobileMenu = settings.viewport.width < 720
      if (mobileMenu) {
        await page.locator('.nav-menu-button').click()
        await page.locator('#mobile-nav-toggle-projects').click()
      } else await page.locator('#nav-toggle-projects').click()
      await capture('menu', mobileMenu ? '.mobile-nav-dialog .nav-photo-frame img' : '#nav-panel-projects .nav-photo-frame img')
      await page.keyboard.press('Escape')
      if (mobileMenu) await page.keyboard.press('Escape')
      await page.locator('#now .home-gallery').scrollIntoViewIfNeeded()
      await capture('gallery', '#now .home-gallery img')
      await page.locator('#now .home-gallery-open').first().click()
      await page.waitForFunction(() => document.querySelector('.home-now-reader')?.dataset.phase === 'open')
      await capture('reader', '.home-now-reader-scene img')
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
  const comparisons = []
  for (const baseline of records.filter(record => record.version === 'baseline')) {
    const candidate = records.find(record => record.version === 'candidate' && record.view === baseline.view && record.scene === baseline.scene)
    assert.deepEqual(candidate.images.map(image => image.geometry), baseline.images.map(image => image.geometry),
      `${baseline.view} ${baseline.scene}: preserve image placement, crop and style`)
    const [before, after] = await Promise.all([baseline, candidate].map(record => sharp(`${output}/${record.file}`).ensureAlpha().raw().toBuffer()))
    assert.equal(before.length, after.length)
    let changedPixels = 0
    let maxChannelDifference = 0
    for (let index = 0; index < before.length; index += 4) {
      let changed = false
      for (let channel = 0; channel < 3; channel++) {
        const difference = Math.abs(before[index + channel] - after[index + channel])
        changed ||= difference > 0
        maxChannelDifference = Math.max(maxChannelDifference, difference)
      }
      changedPixels += Number(changed)
    }
    const comparison = { view: baseline.view, scene: baseline.scene, changedPixels, totalPixels: before.length / 4, maxChannelDifference }
    comparisons.push(comparison)
    console.log(JSON.stringify(comparison))
  }
  await writeFile(`${output}/comparison.json`, JSON.stringify({ records, comparisons }, null, 2))
} catch (error) { console.error(`In-page image visual comparison failed: ${error.message}`); process.exitCode = 1 }
finally { await browser.close() }
