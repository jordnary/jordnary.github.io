import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const ornamentSelector = '.journey-next-ornament'
const layoutWidths = [320, 390, 699, 700, 701, 899, 900, 901, 1199, 1200, 1201, 1440]
const breakpointGroups = [[699, 700, 701], [899, 900, 901], [1199, 1200, 1201]]

async function settleLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    for (let frame = 0; frame < 3; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
  })
}

async function backgroundBounds(page) {
  return page.evaluate(() => {
    const scene = document.querySelector('.journey-next-scene').getBoundingClientRect()
    return [...document.querySelectorAll('.journey-next-ornament, .journey-next-ornament path, .journey-next-ornament circle')].map(element => {
      const bounds = element.getBoundingClientRect()
      return { left: bounds.left - scene.left, top: bounds.top - scene.top, width: bounds.width, height: bounds.height }
    })
  })
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const scene = document.querySelector('.journey-next-scene').getBoundingClientRect()
    const ornaments = [...document.querySelectorAll('.journey-next-ornament')]
    const animations = ornaments.flatMap(element => element.getAnimations({ subtree: true }))
    animations.forEach(animation => animation.pause())

    const bounds = element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const matrix = element.getScreenCTM?.()
      const scale = style.vectorEffect === 'non-scaling-stroke' ? 1 : matrix ? Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)) : 1
      const padding = style.stroke === 'none' ? 0 : Number.parseFloat(style.strokeWidth) * scale / 2
      return { left: rect.left - padding, top: rect.top - padding, right: rect.right + padding, bottom: rect.bottom + padding }
    }
    const union = boxes => ({
      left: Math.min(...boxes.map(box => box.left)), top: Math.min(...boxes.map(box => box.top)),
      right: Math.max(...boxes.map(box => box.right)), bottom: Math.max(...boxes.map(box => box.bottom)),
    })
    const distance = (first, second) => Math.hypot(
      Math.max(first.left - second.right, second.left - first.right, 0),
      Math.max(first.top - second.bottom, second.top - first.bottom, 0),
    )
    const cards = [...document.querySelectorAll('.journey-next-link')].map(card => union([...card.querySelectorAll('.journey-next-border path')].map(bounds)))
    const text = [...document.querySelectorAll('.journey-outro h2, .journey-outro-kicker, .journey-outro-copy, .journey-next-title, .journey-next-note')].map(bounds)
    let cardGap = Infinity
    let textGap = Infinity
    let ornamentGap = Infinity
    let paintLeft = Infinity
    let paintRight = -Infinity
    // Cover every stepped flower pose and the extrema of the other animations.
    const phases = [...Array.from({ length: 18 }, (_, index) => (index + 0.5) / 18), 0, 0.18, 0.3, 0.33, 0.48, 0.55, 0.62, 0.66, 0.74, 0.8, 0.999999]
    for (const phase of phases) {
      for (const animation of animations) {
        const timing = animation.effect.getTiming()
        animation.currentTime = timing.delay + Number(timing.duration) * (1 + phase)
      }
      const drawings = ornaments.map(ornament => [...ornament.querySelectorAll('path, circle')].map(bounds))
      for (const [index, drawing] of drawings.entries()) {
        for (const shape of drawing) {
          paintLeft = Math.min(paintLeft, shape.left)
          paintRight = Math.max(paintRight, shape.right)
          for (const card of cards) cardGap = Math.min(cardGap, distance(shape, card))
          for (const copy of text) textGap = Math.min(textGap, distance(shape, copy))
          for (const other of drawings.slice(index + 1).flat()) ornamentGap = Math.min(ornamentGap, distance(shape, other))
        }
      }
    }
    return {
      anchors: ornaments.map(ornament => {
        const rect = ornament.getBoundingClientRect()
        return { left: rect.left - scene.left, top: rect.top - scene.top, width: rect.width, height: rect.height }
      }),
      cardGap, textGap, ornamentGap, paintLeft, paintRight,
      viewport: document.documentElement.clientWidth,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth,
    }
  })
}

async function sampleAnimationClocks(ornament, duration = 180) {
  return ornament.evaluate(async (element, milliseconds) => {
    const samples = []
    const start = performance.now()
    do {
      await new Promise(resolve => requestAnimationFrame(resolve))
      samples.push(element.getAnimations({ subtree: true }).map(animation => ({ time: animation.currentTime, state: animation.playState })))
    } while (performance.now() - start < milliseconds)
    return samples
  }, duration)
}

export async function runAboutNextBackgroundChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(new URL('about/', baseURL).href)
    await page.locator(ornamentSelector).first().waitFor({ state: 'attached' })
    const structure = await page.evaluate(() => {
      const layer = document.querySelector('.journey-next-ornaments')
      const links = document.querySelector('.journey-next-links')
      return {
        count: layer.querySelectorAll(':scope > svg').length,
        sharedScene: layer.parentElement === links.parentElement && layer.parentElement.matches('.journey-next-scene'),
        insideLink: [...layer.querySelectorAll('svg')].some(element => element.closest('a')),
        hidden: layer.getAttribute('aria-hidden'),
        pointerEvents: getComputedStyle(layer).pointerEvents,
      }
    })
    assert.deepEqual(structure, { count: 4, sharedScene: true, insideLink: false, hidden: 'true', pointerEvents: 'none' }, 'Four inaccessible, click-through background drawings are siblings of the card grid')
    pass('Four decorations live in an independent background layer outside both links')

    const layouts = new Map()
    let minimumGap = Infinity
    for (const width of layoutWidths) {
      await page.setViewportSize({ width, height: 900 })
      await page.mouse.move(1, 1)
      await page.locator('.journey-next-scene').scrollIntoViewIfNeeded()
      await settleLayout(page)
      const layout = await inspectLayout(page)
      layouts.set(width, layout)
      minimumGap = Math.min(minimumGap, layout.cardGap)
      assert.ok(layout.cardGap >= 8, `${width}px drawings leave visible space around both card borders; minimum ${layout.cardGap.toFixed(2)}px`)
      assert.ok(layout.textGap >= 8, `${width}px drawings do not cover the heading or any card text`)
      assert.ok(layout.ornamentGap >= 4, `${width}px drawings do not overlap one another`)
      assert.ok(layout.overflow <= 1 && layout.paintLeft >= -1 && layout.paintRight <= layout.viewport + 1, `${width}px drawings stay inside the viewport without horizontal overflow`)
      const beforeHover = await backgroundBounds(page)
      for (const card of await page.locator('.journey-next-link').all()) {
        await card.hover()
        await page.waitForTimeout(300)
        const duringHover = await backgroundBounds(page)
        for (const [index, previous] of beforeHover.entries()) {
          for (const key of ['left', 'top', 'width', 'height']) {
            assert.ok(Math.abs(duringHover[index][key] - previous[key]) < 0.1, `${width}px card hover leaves background shape ${index + 1} ${key} unchanged`)
          }
        }
      }
    }
    pass(`Twelve widths keep all sampled drawing poses clear of cards, text, and one another; card clearance is at least ${minimumGap.toFixed(2)}px`)
    pass('Hovering either card leaves every background SVG and frozen path in place at all twelve widths')

    for (const group of breakpointGroups) {
      for (let index = 1; index < group.length; index++) {
        const previous = layouts.get(group[index - 1]).anchors
        const next = layouts.get(group[index]).anchors
        for (let ornament = 0; ornament < next.length; ornament++) {
          for (const key of ['left', 'top', 'width', 'height']) {
            assert.ok(Math.abs(next[ornament][key] - previous[ornament][key]) <= 1.25, `${group[index - 1]}→${group[index]}px keeps decoration ${ornament + 1} ${key} continuous`)
          }
        }
      }
    }
    pass('Background positions and sizes remain continuous across the 700px, 900px, and 1200px layout boundaries')

    // Reload removes the deliberate animation freezes used for geometry checks.
    await page.setViewportSize({ width: 1440, height: 180 })
    await page.reload()
    await settleLayout(page)
    const ripples = page.locator('.journey-next-ornament--ripples')
    await ripples.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      window.scrollTo({ top: scrollY + bounds.bottom - innerHeight + 2, behavior: 'instant' })
    })
    await page.waitForFunction(() => {
      const drawing = document.querySelector('.journey-next-ornament--ripples')
      const cards = [...document.querySelectorAll('.journey-next-link')]
      return drawing.dataset.motion === 'running' && cards.every(card => {
        const bounds = card.getBoundingClientRect()
        return bounds.top >= innerHeight && card.dataset.motion === 'paused'
      })
    })
    const independentClocks = await sampleAnimationClocks(ripples)
    assert.ok(independentClocks[0].length > 0 && independentClocks.at(-1).every((clock, index) => clock.state === 'running' && clock.time > independentClocks[0][index].time + 100), 'A visible background drawing advances while both cards are offscreen and paused')
    pass('A visible background drawing animates independently while both cards are outside the viewport')

    await page.setViewportSize({ width: 1440, height: 900 })
    for (const ornament of await page.locator(ornamentSelector).all()) {
      await ornament.scrollIntoViewIfNeeded()
      await page.waitForFunction(element => element.dataset.motion === 'running' && element.getAnimations({ subtree: true }).every(animation => animation.playState === 'running'), await ornament.elementHandle())
      const running = await sampleAnimationClocks(ornament)
      assert.ok(running[0].length > 0 && running.at(-1).every((clock, index) => clock.time > running[0][index].time + 100), 'Every visible drawing advances its own animation clock')
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.waitForFunction(element => element.getBoundingClientRect().top >= innerHeight && element.dataset.motion === 'paused' && element.getAnimations({ subtree: true }).every(animation => animation.playState === 'paused'), await ornament.elementHandle())
      const paused = await sampleAnimationClocks(ornament)
      assert.ok(paused.every(sample => sample.every((clock, index) => Math.abs(clock.time - paused[0][index].time) < 0.01)), 'Every offscreen drawing freezes its animation clock')
    }
    pass('All four drawings advance when visible and freeze their animation clocks after leaving the viewport')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.locator('.journey-next-scene').scrollIntoViewIfNeeded()
    await settleLayout(page)
    assert.equal(await page.locator('.journey-next-ornaments').evaluate(element => element.getAnimations({ subtree: true }).length), 0, 'Reduced motion removes every background animation')
    const staticBefore = await backgroundBounds(page)
    await page.waitForTimeout(200)
    assert.deepEqual(await backgroundBounds(page), staticBefore, 'Reduced motion preserves a complete, motionless background')
    pass('Reduced motion removes the background animations and preserves static drawings')
    assert.deepEqual(errors, [], 'Background checks produce no uncaught browser errors')
  } finally {
    await context.close()
  }
  return checks
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.ABOUT_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runAboutNextBackgroundChecks(browser, process.env.ABOUT_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} about next background checks passed`)
  } catch (error) {
    console.error('About next background checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
