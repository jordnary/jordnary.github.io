import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const motifSelector = '.journey-margin-motif'
const screenshotDirectory = 'node_modules/.cache/about-decorations'

async function settleLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    for (let frame = 0; frame < 3; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
  })
}

async function sampleFrames(motif, duration = 1350) {
  return motif.evaluate(async (element, milliseconds) => {
    const frames = [...element.querySelectorAll('.journey-pencil-frame')]
    const samples = []
    const start = performance.now()
    do {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const opacity = frames.map(frame => Number(getComputedStyle(frame).opacity))
      samples.push({
        opacity,
        visible: opacity.flatMap((value, index) => value > 0.5 ? [index] : []),
        times: element.getAnimations({ subtree: true }).map(animation => animation.currentTime),
      })
    } while (performance.now() - start < milliseconds)
    return samples
  }, duration)
}

function assertSingleFrame(samples, label) {
  assert.ok(samples.length >= 5, `${label} includes multiple rendered frames`)
  const invalidFrame = samples.find(sample => sample.visible.length !== 1)
  assert.ok(!invalidFrame, `${label} shows exactly one pencil pose in every rendered frame${invalidFrame ? `; received ${JSON.stringify(invalidFrame)}` : ''}`)
  assert.ok(samples.every(sample => sample.opacity.every(opacity => opacity === 0 || opacity === 1)), `${label} swaps complete poses without a crossfade`)
}

export async function runAboutDecorationsChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(new URL('about/', baseURL).href)
    await page.locator(motifSelector).first().waitFor({ state: 'attached' })
    assert.equal(await page.locator(motifSelector).count(), 4, 'The journey has four margin sketches')
    assert.equal(await page.locator('.journey-margin-art').getAttribute('aria-hidden'), 'true', 'Decorative drawings stay outside the accessibility tree')
    await mkdir(screenshotDirectory, { recursive: true })

    for (const width of [1440, 1280, 1024, 900, 701, 700, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await settleLayout(page)
      const layout = await page.evaluate(() => {
        const rect = element => {
          const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
          return { left, top, right, bottom, width, height }
        }
        const paper = [...document.querySelectorAll('.journey-margin-paper')].map(element => ({
          bounds: rect(element),
          grid: getComputedStyle(element).backgroundSize,
        }))
        const motifs = [...document.querySelectorAll('.journey-margin-motif')].map(element => {
          const style = getComputedStyle(element)
          const frame = element.querySelector('.journey-pencil-frame')
          return {
            bounds: rect(element),
            drawing: rect(frame),
            width: Number.parseFloat(style.width),
            display: style.display,
            side: element.classList.contains('journey-margin-motif--loop') ? 'left' : 'right',
            visiblePaths: [...element.querySelectorAll('path')].filter(path => path.getBoundingClientRect().width > 0).length,
            animations: element.getAnimations({ subtree: true }).length,
            opacity: [...element.querySelectorAll('.journey-pencil-frame')].map(frame => Number(getComputedStyle(frame).opacity)),
          }
        })
        return {
          overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
          viewport: document.documentElement.clientWidth,
          scrollbar: Math.max(innerWidth - document.documentElement.clientWidth, innerWidth - document.body.clientWidth),
          paper,
          motifs,
          text: [...document.querySelectorAll('.journey-card h2, .journey-card-copy')].map(rect),
        }
      })
      assert.ok(layout.overflow <= 1, `${width}px layout has no horizontal page overflow`)
      assert.ok(layout.paper.every(paper => paper.grid.split(',').slice(-2).every(size => size.trim() === '20px 20px')), `${width}px paper preserves its 20px grid pitch`)
      const edgeTolerance = layout.scrollbar / 2 + 1
      assert.ok(Math.abs(layout.paper[0].bounds.left) <= edgeTolerance && Math.abs(layout.paper[1].bounds.right - layout.viewport) <= edgeTolerance, `${width}px paper remains anchored to the viewport edges`)
      if (width > 700) {
        for (const [index, motif] of layout.motifs.entries()) {
          const label = `${width}px motif ${index + 1}`
          assert.equal(motif.display, 'block', `${label} remains displayed`)
          assert.equal(motif.width, motif.side === 'left' ? 132 : 112, `${label} keeps its original drawing width`)
          const boundary = motif.side === 'left' ? layout.paper[0].bounds.right : layout.paper[1].bounds.left
          assert.ok(motif.bounds.left < boundary && motif.bounds.right > boundary, `${label} crosses the inner paper edge`)
          assert.ok(Math.min(motif.drawing.right, layout.viewport) - Math.max(motif.drawing.left, 0) > 20, `${label} retains a visible drawing inside the viewport`)
          assert.ok(layout.text.every(text => motif.drawing.right <= text.left || motif.drawing.left >= text.right || motif.drawing.bottom <= text.top || motif.drawing.top >= text.bottom), `${label} does not overlap a card title or body`)
          assert.equal(motif.animations, 0, `${label} has no reduced-motion animations`)
          assert.deepEqual(motif.opacity, [1, 0, 0], `${label} keeps one complete static pencil pose`)
        }
      } else {
        assert.ok(layout.motifs.every(motif => motif.display === 'none' && motif.bounds.width === 0 && motif.bounds.height === 0 && motif.visiblePaths === 0), `${width}px hides every sketch and all its SVG fragments`)
        assert.ok(layout.motifs.every(motif => motif.animations === 0), `${width}px retains no hidden pencil animation`)
      }
      pass(`${width}px preserves the page bounds, paper grid, and ${width > 700 ? 'fixed-size margin drawings without covering card text' : 'complete removal of margin drawings'}`)
      if ([1440, 701, 700, 390].includes(width)) {
        await page.locator('.journey-canvas').screenshot({ path: `${screenshotDirectory}/journey-${width}.png`, animations: 'disabled' })
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await settleLayout(page)
    assert.equal(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), true, 'Motion checks run with a desktop pointer')
    const motifs = page.locator(motifSelector)
    for (let index = 0; index < await motifs.count(); index++) {
      const motif = motifs.nth(index)
      const label = `Animated motif ${index + 1}`
      await motif.evaluate(element => {
        const bounds = element.getBoundingClientRect()
        window.scrollTo({ top: scrollY + bounds.top + bounds.height / 2 - innerHeight / 2, behavior: 'instant' })
      })
      await page.waitForFunction(element => element.dataset.motion === 'running' && element.getAnimations({ subtree: true }).every(animation => animation.playState === 'running'), await motif.elementHandle())
      const samples = await sampleFrames(motif)
      assertSingleFrame(samples, label)
      assert.deepEqual([...new Set(samples.flatMap(sample => sample.visible))].sort(), [0, 1, 2], `${label} actually displays all three pencil poses over time`)
      assert.ok(samples.at(-1).times.every((time, frame) => time > samples[0].times[frame] + 900), `${label} advances its animation clock while visible`)

      await motif.evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().bottom + 200, behavior: 'instant' }))
      await page.waitForFunction(element => {
        const bounds = element.getBoundingClientRect()
        return (bounds.top >= innerHeight || bounds.bottom <= 0) && element.dataset.motion === 'paused'
          && element.getAnimations({ subtree: true }).every(animation => animation.playState === 'paused')
      }, await motif.elementHandle())
      await settleLayout(page)
      const paused = await sampleFrames(motif, 250)
      assertSingleFrame(paused, `${label} outside the viewport`)
      assert.ok(paused.every(sample => sample.times.every((time, frame) => Math.abs(time - paused[0].times[frame]) < 0.01)), `${label} freezes its animation clock outside the viewport`)
      assert.ok(paused.every(sample => sample.visible[0] === paused[0].visible[0]), `${label} retains the same pose while paused`)
    }
    pass('All four desktop sketches switch among three complete pencil poses and pause after leaving the viewport')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (let index = 0; index < await motifs.count(); index++) {
      const motif = motifs.nth(index)
      await motif.scrollIntoViewIfNeeded()
      await settleLayout(page)
      const samples = await sampleFrames(motif, 250)
      assertSingleFrame(samples, `Reduced-motion motif ${index + 1}`)
      assert.ok(samples.every(sample => sample.visible[0] === 0 && sample.times.length === 0), 'Switching to reduced motion removes every animation and holds the first pencil pose')
    }
    pass('Changing to reduced motion leaves one complete, motionless drawing per sketch')
    assert.deepEqual(errors, [], 'The decoration checks produce no uncaught browser errors')
  } finally {
    await context.close()
  }
  return checks
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.ABOUT_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runAboutDecorationsChecks(browser, process.env.ABOUT_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} about decoration checks passed`)
  } catch (error) {
    console.error('About decoration browser checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
