import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const output = 'node_modules/.cache/home-gallery-scroll'

function captureEntrance() {
  sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
  sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
  window.homeGalleryEntrance = { done: false, samples: [] }
  let started
  const sample = time => {
    const rail = document.querySelector('.home-gallery')
    if (rail && (started !== undefined || rail.getBoundingClientRect().top < innerHeight)) {
      started ??= time
      const cards = Array.from(rail.querySelectorAll('.home-gallery-card-content')).slice(0, 2)
      window.homeGalleryEntrance.samples.push({
        time: time - started,
        cards: cards.map(card => {
          const style = getComputedStyle(card)
          return { opacity: Number(style.opacity), x: new DOMMatrixReadOnly(style.transform).m41 }
        }),
      })
      if (time - started > 2200) {
        window.homeGalleryEntrance.done = true
        return
      }
    }
    requestAnimationFrame(sample)
  }
  requestAnimationFrame(sample)
}

async function checkEntrance(page, label) {
  await page.waitForFunction(() => window.homeGalleryEntrance.done)
  const samples = await page.evaluate(() => window.homeGalleryEntrance.samples)
  assert.equal(samples[0].cards[0].opacity, 0, `${label}: the first visible frame starts hidden`)
  assert.ok(samples.filter(({ cards }) => cards[0].opacity > .05 && cards[0].opacity < .95).length >= 6,
    `${label}: the image fades through multiple visible frames`)
  assert.ok(samples.filter(({ cards }) => cards[0].opacity > .05 && cards[0].x > 1).length >= 6,
    `${label}: the image slides in from the right while fading`)
  assert.ok(samples.some(({ cards }) => cards[0].opacity - cards[1].opacity > .15),
    `${label}: neighboring cards enter with a visible stagger`)
  for (let index = 1; index < samples.length; index++) {
    assert.ok(samples[index].cards[0].x <= samples[index - 1].cards[0].x + .01,
      `${label}: the entrance never reverses or jumps back`)
  }
  assert.ok(samples.at(-1).cards.every(card => card.opacity === 1 && Math.abs(card.x) < .01),
    `${label}: the entrance finishes fully visible at its resting position`)
}

async function scrollAndSample(page, top) {
  return page.evaluate(async top => {
    const rail = document.querySelector('.home-gallery')
    const content = rail.querySelector('.home-gallery-card-content')
    const samples = []
    const started = performance.now()
    window.scrollTo({ top, behavior: 'instant' })
    await new Promise(resolve => {
      const sample = time => {
        samples.push({
          x: Number.parseFloat(getComputedStyle(content).translate) || 0,
          entrance: new DOMMatrixReadOnly(getComputedStyle(content).transform).m41,
          opacity: Number(getComputedStyle(content).opacity),
          scroll: rail.scrollLeft,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        })
        if (time - started > 1600) resolve()
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    return samples
  }, top)
}

export async function runHomeGalleryScrollChecks(browser, baseURL, report = () => {}) {
  await mkdir(output, { recursive: true })
  const homeURL = new URL('home/', baseURL).href
  for (const width of [390, 1440, 2558]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' })
    await context.addInitScript(captureEntrance)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.setDefaultTimeout(8000)
    try {
      await page.goto(homeURL)
      await page.evaluate(() => document.fonts.ready)
      const bleed = page.locator('.home-gallery-bleed')
      assert.equal(await bleed.evaluate(element => element.classList.contains('is-revealed')), false,
        'The gallery waits below the first screen until it enters the viewport')
      const top = await page.locator('.home-gallery').evaluate(element => element.getBoundingClientRect().top + scrollY)
      await page.evaluate(top => window.scrollTo({ top: top - innerHeight * .75, behavior: 'instant' }), top)
      await checkEntrance(page, `${width}px first scroll`)
      report(`PASS: ${width}px first scroll fades and slides neighboring cards in sequence`)

      await page.screenshot({ path: `${output}/gallery-${width}.png` })
      const down = await scrollAndSample(page, top - 900 * .2)
      assert.ok(down[0].x - down.at(-1).x > 10, 'Scrolling down moves the entire gallery left')
      assert.ok(down.filter(sample => sample.x > down.at(-1).x + .1 && sample.x < down[0].x - .1).length >= 6,
        'The scroll displacement follows through smoothly across intermediate frames')
      for (let index = 1; index < down.length; index++) {
        assert.ok(down[index].x <= down[index - 1].x + .02, 'The scroll follow-through never reverses')
      }
      const up = await scrollAndSample(page, top - 900 * .75)
      assert.ok(up.at(-1).x - up[0].x > 10, 'Scrolling up moves the gallery right')
      assert.ok(Math.abs(up.at(-1).x - down[0].x) < .1, 'Returning to the same page position restores the same horizontal offset')
      assert.ok([...down, ...up].every(sample => sample.scroll === 0 && sample.opacity === 1 && sample.entrance === 0 && !sample.overflow),
        'Vertical scroll preserves the selected slide without replaying the entrance or overflowing the page')
      report(`PASS: ${width}px scroll follows both directions smoothly without advancing the carousel`)

      await page.reload()
      await checkEntrance(page, `${width}px refresh`)
      assert.ok(await page.evaluate(() => scrollY > 0), 'Refreshing restores the visible gallery position')
      report(`PASS: ${width}px refreshing a visible gallery replays the entrance`)

      await scrollAndSample(page, 0)
      const reentry = await scrollAndSample(page, top - 900 * .5)
      assert.ok(reentry.every(sample => sample.opacity === 1 && sample.entrance === 0),
        'Leaving and re-entering the gallery does not repeat its one-time entrance')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.home-gallery-card-content'))
        .every(card => getComputedStyle(card).translate === 'none'))
      assert.ok(await page.locator('.home-gallery-card-content').evaluateAll(cards => cards.every(card => {
        const style = getComputedStyle(card)
        return style.opacity === '1' && style.transform === 'none' && style.translate === 'none' && style.transitionDuration === '0s'
      })), 'Reduced motion immediately shows all cards without entrance or parallax motion')
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      const restored = await scrollAndSample(page, top - 900 * .75)
      assert.ok(restored.at(-1).x > 0 && restored.every(sample => sample.opacity === 1 && sample.entrance === 0),
        'Enabling motion again restores parallax without repeating the entrance')
      assert.deepEqual(errors, [])
      report(`PASS: ${width}px re-entry and live reduced-motion preferences`)
    } finally {
      await context.close()
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.HOME_EDITORIAL_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runHomeGalleryScrollChecks(browser, process.env.HOME_EDITORIAL_TEST_URL || 'http://127.0.0.1:5173/', console.log)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
