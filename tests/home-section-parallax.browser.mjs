import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const sections = [
  { id: 'selected', anchor: '.home-editorial-feature-layout', card: '.home-editorial-feature' },
  { id: 'journal', anchor: '.home-editorial-journal-rail', card: '.home-editorial-journal-card-content' },
]
const screenshotDirectory = 'node_modules/.cache/home-section-parallax'

async function scrollPage(page, top) {
  const target = await page.evaluate(requested => {
    const position = Math.round(Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, requested)))
    window.scrollTo({ top: position, behavior: 'instant' })
    return position
  }, top)
  await page.waitForFunction(position => Math.abs(scrollY - position) < 1, target)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function settleMotion(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const moving = Array.from(document.querySelectorAll('.home-editorial-section-heading h2, .home-editorial-feature, .home-editorial-journal-card-content'))
    const read = () => moving.map(element => {
      const x = Number.parseFloat(getComputedStyle(element).translate) || 0
      const section = element.closest('.home-editorial-section')
      const limit = element.matches('h2')
        ? (innerWidth <= 600 ? 10 : Math.min(innerWidth * .036, 112))
        : Number.parseFloat(getComputedStyle(section).getPropertyValue('--home-section-photo-limit'))
      if (!Number.isFinite(limit) || Math.abs(x) > limit + .1) throw new Error('Scroll follow-through stays within its horizontal bounds without overshooting')
      return x
    })
    const start = performance.now()
    let stableSince = start
    let previous
    const sample = now => {
      try {
        const current = read()
        if (!previous || current.some((value, index) => Math.abs(value - previous[index]) > .001)) stableSince = now
        previous = current
        if (now - stableSince >= 64) return resolve()
        if (now - start > 3000) return reject(new Error('Horizontal follow-through does not settle after scrolling stops'))
        requestAnimationFrame(sample)
      } catch (error) {
        reject(error)
      }
    }
    requestAnimationFrame(sample)
  }))
}

async function settleScroll(page, top) {
  await scrollPage(page, top)
  await settleMotion(page)
}

async function centerAnchor(page, selector) {
  return page.locator(selector).evaluate(element => Math.round(scrollY + element.getBoundingClientRect().top - innerHeight / 2))
}

async function geometry(page, selector) {
  return page.locator(selector).first().evaluate(element => {
    const box = element.getBoundingClientRect()
    return { x: box.x, width: box.width, translate: getComputedStyle(element).translate }
  })
}

async function recordHeadingScroll(page, selector, top) {
  return page.evaluate(async ({ selector, top }) => {
    const heading = document.querySelector(selector)
    const samples = []
    const started = performance.now()
    window.scrollTo({ top: Math.round(top), behavior: 'instant' })
    await new Promise(resolve => {
      const sample = time => {
        samples.push({ time, x: Number.parseFloat(getComputedStyle(heading).translate) })
        // A layout notification during follow-through must not snap to the target.
        if (samples.length === 3) window.dispatchEvent(new Event('resize'))
        if (time - started >= 500) resolve()
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    return samples
  }, { selector, top })
}

function assertContinuousApproach(samples, start, end) {
  const direction = Math.sign(end - start)
  const range = Math.abs(end - start)
  const intermediate = samples.filter(({ x }) => (x - start) * direction > .05 && (end - x) * direction > .05)
  assert.ok(intermediate.length >= 4, 'Crossing a boundary moves through multiple intermediate frames instead of teleporting')
  let previous = start
  for (const { x } of samples) {
    assert.ok((x - previous) * direction >= -.02, 'Approaching the endpoint never reverses or jitters')
    assert.ok(Math.abs(x - previous) < range * .8, 'No frame jumps directly across most of the remaining range')
    assert.ok((end - x) * direction >= -.02, 'Following never overshoots its endpoint')
    previous = x
  }
  assert.ok(Math.abs(previous - end) < .1, 'The heading finishes its short follow-through')
}

async function checkReferencePlayback(page, selector, headingTop, report) {
  // Time, visible title top, and left edge measured from the supplied 2558x1346
  // recording. Compare displacement so the site's own typography/gutter stays intact.
  const reference = [[1.044, 1232, 59], [1.110, 1140, 65], [1.175, 1086, 72], [1.240, 999, 81], [1.306, 891, 91], [1.371, 850, 97], [1.436, 830, 106], [1.501, 829, 108], [1.567, 829, 108], [1.632, 830, 109], [1.697, 775, 115], [1.762, 625, 124], [1.828, 534, 129], [1.893, 396, 141], [1.958, 304, 152], [2.024, 192, 161], [2.089, 82, 169], [2.154, -23, 175], [2.219, -57, 178], [2.285, -71, 181], [2.350, -71, 182], [2.415, -91, 183]]
  const height = page.viewportSize().height
  await settleScroll(page, headingTop - reference[0][1] / 1346 * height)
  const samples = await page.evaluate(async ({ selector, headingTop, reference }) => {
    const heading = document.querySelector(selector)
    const startX = Number.parseFloat(heading.style.translate)
    const started = performance.now()
    const samples = []
    let index = 0
    await new Promise(resolve => {
      const frame = time => {
        const seconds = (time - started) / 1000 + reference[0][0]
        while (index < reference.length && seconds >= reference[index][0]) {
          samples.push({ actual: Number.parseFloat(heading.style.translate) - startX, expected: reference[index][2] - reference[0][2] })
          index++
        }
        if (index === reference.length) return resolve()
        const previous = reference[Math.max(0, index - 1)]
        const next = reference[index]
        const progress = Math.max(0, Math.min(1, (seconds - previous[0]) / (next[0] - previous[0])))
        const top = previous[1] + (next[1] - previous[1]) * progress
        window.scrollTo({ top: Math.round(headingTop - top / 1346 * innerHeight), behavior: 'instant' })
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
    return samples
  }, { selector, headingTop, reference })
  const errors = samples.map(sample => Math.abs(sample.actual - sample.expected))
  const rmse = Math.sqrt(errors.reduce((sum, error) => sum + error ** 2, 0) / errors.length)
  assert.ok(rmse < 4 && Math.max(...errors) < 8, 'The visible trajectory and brief pauses match the recorded horizontal displacement')
  report(`PASS: ${selector} reference playback RMS position error ${rmse.toFixed(2)}px`)
}

export async function runHomeSectionParallaxChecks(browser, baseURL, report = () => {}) {
  await mkdir(screenshotDirectory, { recursive: true })
  const widths = process.env.HOME_EDITORIAL_TEST_WIDTHS?.split(',').map(Number) ?? [1440, 2558, 768, 390, 320]
  assert.ok(widths.length > 0 && widths.every(width => [1440, 2558, 768, 390, 320].includes(width)), 'Requested test widths must be supported viewport sizes')
  for (const width of widths) {
    const height = width === 2558 ? 1352 : 900
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference', isMobile: width < 600, hasTouch: width < 600 })
    await context.addInitScript(() => {
      sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
      sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(new URL('home/', baseURL).href)
      await page.locator('.home-editorial-section').first().waitFor({ state: 'attached' })
      await page.evaluate(() => document.fonts.ready)
      const rail = page.locator('.home-editorial-journal-rail')
      assert.equal(await rail.evaluate(element => element.scrollLeft), 0, 'The carousel starts at its first card')
      const distance = width < 600 ? 30 : 100
      const headingRange = width <= 600 ? 20 : Math.min(width * .026, 80) + Math.min(width * .036, 112)
      for (const { id, anchor, card } of sections) {
        report(`CHECK: ${width}px ${id} bounded scrolling and reference heading pace`)
        const heading = `#${id} h2`
        const content = `#${id} ${card}`
        const headingTop = await page.locator(heading).evaluate(element => scrollY + element.getBoundingClientRect().top)
        if (width === 2558) await checkReferencePlayback(page, heading, headingTop, report)
        const atHeading = async viewportFraction => {
          await settleScroll(page, headingTop - height * viewportFraction)
          return { heading: await geometry(page, heading), card: await geometry(page, content) }
        }
        const early = await atHeading(1.2)
        const earlier = await atHeading(1.4)
        const middle = await atHeading(.5)
        if (width === 1440 || width === 2558) {
          const middleLater = await atHeading(.3)
          const nearEdge = await atHeading(.1)
          const middleTravel = middleLater.heading.x - middle.heading.x
          const upperTravel = nearEdge.heading.x - middleLater.heading.x
          assert.ok(middleTravel > headingRange * .12, `${width}px ${id} keeps a visible pace through the middle of the viewport`)
          assert.ok(upperTravel > middleTravel * .65 && upperTravel < middleTravel * .9, `${width}px ${id} slows gently near the upper edge without exhausting its travel early`)
          const start = (await atHeading(.5)).heading
          const forward = await recordHeadingScroll(page, heading, headingTop + height * .65)
          const end = await geometry(page, heading)
          assertContinuousApproach(forward, Number.parseFloat(start.translate), Number.parseFloat(end.translate))
          const reverseStart = (await atHeading(.7)).heading
          const backward = await recordHeadingScroll(page, heading, headingTop - height * 1.1)
          const reverseEnd = await geometry(page, heading)
          assertContinuousApproach(backward, Number.parseFloat(reverseStart.translate), Number.parseFloat(reverseEnd.translate))
        }
        await atHeading(-.65)
        const terminalPositions = []
        for (const fraction of [-.65, -.8, -1]) {
          await scrollPage(page, headingTop - height * fraction)
          terminalPositions.push(await geometry(page, heading))
        }
        const expectedEnd = early.heading.x + headingRange
        assert.ok(terminalPositions.every(position => Math.abs(position.x - expectedEnd) < .1), `${width}px ${id} stays at its endpoint after leaving the viewport`)
        await page.waitForTimeout(160)
        assert.ok(Math.abs((await geometry(page, heading)).x - expectedEnd) < .1, 'A heading at the upper endpoint has no horizontal follow-through after scrolling stops')
        const upper = (await atHeading(0)).heading
        const late = await atHeading(-1)
        const later = await atHeading(-1.2)
        for (const type of ['heading', 'card']) {
          assert.ok(Math.abs(early[type].x - earlier[type].x) < .1, `${width}px ${id} ${type} stops at its entry boundary`)
          assert.ok(Math.abs(late[type].x - later[type].x) < .1, `${width}px ${id} ${type} stops at its exit boundary`)
          assert.ok(Math.abs(late[type].width - early[type].width) < .1, 'Parallax changes position without resizing the content')
        }
        const fullHeadingTravel = late.heading.x - early.heading.x
        assert.ok(fullHeadingTravel > headingRange * .95 && fullHeadingTravel <= headingRange + .1, `${width}px ${id} uses its finite heading travel range`)
        assert.ok(middle.heading.x > early.heading.x && middle.heading.x < upper.x, 'The heading moves right as the page scrolls down')
        assert.ok((upper.x - early.heading.x) / fullHeadingTravel > .85 && (upper.x - early.heading.x) / fullHeadingTravel < .92, `${width}px ${id} retains the reference's gentle remaining travel at the upper edge`)
        const photoLimit = await page.locator(`#${id}`).evaluate(element => Number.parseFloat(getComputedStyle(element).getPropertyValue('--home-section-photo-limit')))
        assert.ok(early.card.x - late.card.x > photoLimit * 1.9 && early.card.x - late.card.x <= photoLimit * 2 + .1, `${width}px ${id} uses its finite image travel range`)
        const returned = await atHeading(.5)
        assert.ok(Math.abs(returned.heading.x - middle.heading.x) < .1, 'Returning from either heading boundary restores the same horizontal position')

        const center = await centerAnchor(page, `#${id} ${anchor}`)
        await settleScroll(page, center - distance)
        const before = await geometry(page, content)
        let following
        if (width === 1440 && id === 'selected') {
          await scrollPage(page, center + distance)
          const firstFrames = await geometry(page, content)
          await page.waitForTimeout(160)
          following = await geometry(page, content)
          assert.ok(firstFrames.x < before.x - .1 && following.x < firstFrames.x - .1, 'Images begin moving with the scroll and continue following briefly after it stops')
          await settleMotion(page)
        } else await settleScroll(page, center + distance)
        const after = await geometry(page, content)
        if (following) assert.ok(following.x > after.x + .1, 'The brief follow-through approaches its final position without jumping straight to it')
        assert.ok(before.x - after.x > distance * .12, `${width}px ${id} images move left while scrolling down`)
        await page.waitForTimeout(160)
        assert.ok(Math.abs((await geometry(page, content)).x - after.x) < .1, 'Horizontal follow-through finishes and remains still when scrolling stops')
        await settleScroll(page, center - distance)
        assert.ok(Math.abs((await geometry(page, content)).x - before.x) < .1, 'Reverse scrolling retraces the same image position')

        for (const offset of [height, height / 2, 0, -height / 2]) {
          const top = await page.locator(`#${id}`).evaluate(element => scrollY + element.getBoundingClientRect().top)
          await scrollPage(page, top - offset)
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${width}px ${id} does not create page-wide horizontal overflow`)
        }

        if (width === 1440 || width === 390) {
          const top = await page.locator(`#${id}`).evaluate(element => scrollY + element.getBoundingClientRect().top)
          await settleScroll(page, Math.round(top - 160))
          await page.screenshot({ path: `${screenshotDirectory}/${id}-${width}-entry.png` })
          await settleScroll(page, Math.round(top + 80))
          await page.screenshot({ path: `${screenshotDirectory}/${id}-${width}-scrolled.png` })
        }
      }

      assert.equal(await rail.evaluate(element => element.scrollLeft), 0, 'Vertical parallax never changes the horizontal carousel position')
      const next = page.getByRole('button', { name: '下一张日常卡片', exact: true })
      await next.scrollIntoViewIfNeeded()
      const start = await rail.evaluate(element => element.scrollLeft)
      await next.click()
      await page.waitForFunction(value => document.querySelector('.home-editorial-journal-rail').scrollLeft > value + 20, start)
      await page.waitForTimeout(700)
      const selectedCard = await rail.evaluate(element => element.scrollLeft)
      const journalCenter = await centerAnchor(page, '#journal .home-editorial-journal-rail')
      await settleScroll(page, journalCenter - 120)
      await settleScroll(page, journalCenter + 120)
      assert.ok(Math.abs(await rail.evaluate(element => element.scrollLeft) - selectedCard) < 1, 'Vertical parallax preserves a manually selected carousel card')
      await next.scrollIntoViewIfNeeded()
      await next.click()
      await page.waitForFunction(() => {
        const box = document.querySelector('.home-editorial-journal-card:last-child .home-editorial-photo').getBoundingClientRect()
        return box.left >= 0 && box.right <= innerWidth
      })
      await page.waitForTimeout(700)
      const lastCard = await rail.evaluate(element => element.scrollLeft)
      await settleScroll(page, journalCenter - 120)
      assert.ok(Math.abs(await rail.evaluate(element => element.scrollLeft) - lastCard) < 1, 'Vertical parallax also preserves the final carousel snap position')
      report(`PASS: ${width}px headings approach boundaries smoothly, ease out near the upper edge, and preserve carousel positions`)

      if (width === 2558) {
        await page.setViewportSize({ width: 1440, height: 900 })
        const resizedCenter = await centerAnchor(page, '#selected h2')
        await settleScroll(page, resizedCenter)
        const resized = await geometry(page, '#selected h2')
        assert.ok(Math.abs(Number.parseFloat(resized.translate)) <= 52, 'Resizing recalculates the narrower heading bounds')
        await page.setViewportSize({ width, height })
        const restoredCenter = await centerAnchor(page, '#selected h2')
        await settleScroll(page, restoredCenter)
        const restoredHeading = await geometry(page, '#selected h2')
        assert.ok(Number.parseFloat(restoredHeading.translate) > Number.parseFloat(resized.translate) + 2, 'Restoring the maximized viewport recalculates heading travel for its width')
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'Viewport resizing does not introduce horizontal page overflow')
        report('PASS: resizing from maximized to narrower and back recalculates the horizontal range')
      }

      await page.emulateMedia({ reducedMotion: 'reduce' })
      for (const { id, anchor, card } of sections) {
        const target = await centerAnchor(page, `#${id} ${anchor}`)
        await settleScroll(page, target)
        const before = await geometry(page, `#${id} ${card}`)
        await settleScroll(page, target + 100)
        assert.equal((await geometry(page, `#${id} ${card}`)).x, before.x, 'Reduced motion removes horizontal card parallax')
        assert.equal((await geometry(page, `#${id} h2`)).translate, 'none', 'Reduced motion removes horizontal heading parallax')
      }
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      const restored = await centerAnchor(page, '#journal .home-editorial-journal-rail')
      await settleScroll(page, restored + distance)
      assert.notEqual((await geometry(page, '.home-editorial-journal-card-content')).translate, 'none', 'Enabling motion again restores the scroll effect')
      assert.deepEqual(errors, [], 'The page produces no uncaught browser errors')
      report(`PASS: ${width}px respects live reduced-motion changes`)
    } finally {
      await context.close()
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.HOME_EDITORIAL_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runHomeSectionParallaxChecks(browser, process.env.HOME_EDITORIAL_TEST_URL || 'http://127.0.0.1:5173/', console.log)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
