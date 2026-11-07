import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { routeCases, connectionState, contentReady } from './page-resources.browser.mjs'

const output = 'node_modules/.cache/page-resources/visual'
const versions = [
  ['baseline', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4175/'],
  ['candidate', process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4174/'],
]
const views = [
  ['desktop', { width: 1440, height: 900 }, false, 1],
  ['mobile', { width: 390, height: 844 }, true, 3],
  ['landscape', { width: 844, height: 390 }, true, 3],
]
const { chromium } = await import('playwright')
const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
const results = []
try {
  await mkdir(output, { recursive: true })
  for (const [view, viewport, mobile, deviceScaleFactor] of views) for (const [path, selector, moduleName] of routeCases) {
    const screenshots = []
    const geometries = []
    for (const [version, base] of versions) {
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor, reducedMotion: 'reduce' })
      await context.addInitScript(connectionState, { saveData: true })
      await context.addInitScript(() => {
        let seed = 12345
        Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
      })
      try {
        const page = await context.newPage()
        await page.goto(new URL(path, base).href)
        await contentReady(page, selector)
        await page.evaluate(async () => {
          // Include background artwork that is not represented by an img element.
          const sources = [
            [document.querySelector('.journey-cover > .section-backdrop'), '::before'],
            [document.querySelector('.correspondence-graffiti'), null],
          ].flatMap(([element, pseudo]) => element ? [...getComputedStyle(element, pseudo).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1]) : [])
          await Promise.all(sources.map(async src => { const image = new Image(); image.src = src; await image.decode() }))
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        })
        // Fix the same decorative phase and allow compositing to settle. This
        // normalization is only for screenshots, never for performance samples.
        await page.evaluate(() => {
          for (const animation of document.getAnimations()) {
            const end = animation.effect?.getComputedTiming().endTime
            animation.pause()
            animation.currentTime = Number.isFinite(end) ? end : 0
          }
        })
        await page.waitForTimeout(250)
        geometries.push(await page.locator('main').evaluate(main => ({
          width: main.getBoundingClientRect().width, height: main.getBoundingClientRect().height,
          images: [...main.querySelectorAll('img')].filter(image => {
            const rect = image.getBoundingClientRect()
            return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth
          }).map(image => ({
            src: new URL(image.currentSrc || image.src).pathname,
            width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height,
            x: image.getBoundingClientRect().x, y: image.getBoundingClientRect().y,
            filter: getComputedStyle(image).filter, transform: getComputedStyle(image).transform,
          })),
        })))
        screenshots.push(await page.screenshot({ path: `${output}/${view}-${moduleName}-${version}.png` }))
      } finally { await context.close() }
    }
    assert.deepEqual(geometries[1], geometries[0], `${view} ${moduleName}: layout and image candidates`)
    const [before, after] = await Promise.all(screenshots.map(buffer => sharp(buffer).ensureAlpha().raw().toBuffer()))
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
    results.push({ view, path, changedPixels, totalPixels: before.length / 4, maxChannelDifference })
    console.log(JSON.stringify(results.at(-1)))
  }
  await writeFile(`${output}/comparison.json`, JSON.stringify(results, null, 2))
} catch (error) { console.error(`Resource visual comparison failed: ${error.message}`); process.exitCode = 1 }
finally { await browser.close() }
