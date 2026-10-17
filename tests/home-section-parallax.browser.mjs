import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const sections = [
  { id: 'selected', anchor: '.home-editorial-feature-layout', card: '.home-editorial-feature' },
  { id: 'journal', anchor: '.home-editorial-journal-rail', card: '.home-editorial-journal-card-content' },
]
const screenshotDirectory = 'node_modules/.cache/home-section-parallax'

async function settleScroll(page, top) {
  await page.evaluate(target => window.scrollTo({ top: target, behavior: 'instant' }), top)
  await page.waitForFunction(target => Math.abs(scrollY - target) < 1, top)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
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

export async function runHomeSectionParallaxChecks(browser, baseURL, report = () => {}) {
  await mkdir(screenshotDirectory, { recursive: true })
  for (const width of [1440, 2558, 768, 390, 320]) {
    const height = width === 2558 ? 1352 : 900
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference', isMobile: width < 600, hasTouch: width < 600 })
    await context.addInitScript(() => {
      sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
      sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(new URL('home/', baseURL).href)
      await page.locator('.home-editorial-section').first().waitFor({ state: 'attached' })
      await page.evaluate(() => document.fonts.ready)
      const rail = page.locator('.home-editorial-journal-rail')
      assert.equal(await rail.evaluate(element => element.scrollLeft), 0, 'The carousel starts at its first card')
      const distance = width < 600 ? 30 : 100
      for (const { id, anchor, card } of sections) {
        for (const [stationary, moving, direction] of [
          [`#${id} .home-editorial-section-heading`, `#${id} h2`, 1],
          [`#${id} ${anchor}`, `#${id} ${card}`, -1],
        ]) {
          const center = await centerAnchor(page, stationary)
          await settleScroll(page, center - distance)
          const before = await geometry(page, moving)
          await settleScroll(page, center + distance)
          const after = await geometry(page, moving)
          assert.ok((after.x - before.x) * direction > distance * .12, `${width}px ${moving} visibly moves ${direction > 0 ? 'right' : 'left'} while scrolling down`)
          assert.ok(Math.abs(after.width - before.width) < .1, 'Parallax changes position without resizing the content')
          await page.waitForTimeout(120)
          assert.ok(Math.abs((await geometry(page, moving)).x - after.x) < .1, 'Horizontal movement stops when document scrolling stops')
          await settleScroll(page, center - distance)
          assert.ok(Math.abs((await geometry(page, moving)).x - before.x) < .1, 'Reverse scrolling retraces the same horizontal position')

          const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
          const at = async offset => {
            await settleScroll(page, Math.round(Math.max(0, Math.min(maxScroll, center + offset))))
            return geometry(page, moving)
          }
          const early = await at(-height * 1.5)
          const earlier = await at(-height * 2)
          const late = await at(height * 1.5)
          const later = await at(height * 2)
          assert.ok(Math.abs(early.x - earlier.x) < .1, 'Horizontal movement stops at its entry boundary')
          assert.ok(Math.abs(late.x - later.x) < .1, 'Horizontal movement stops at its exit boundary')
          const maxRange = direction > 0 ? (width < 600 ? 20 : Math.min(width * .0425, 88) * 1.5) : (width < 600 ? 24 : Math.min(width * .07, 140) * 2)
          assert.ok(Math.abs(late.x - early.x) <= maxRange + 1, 'The full horizontal travel stays inside its bounded range')
          await settleScroll(page, center - distance)
          assert.ok(Math.abs((await geometry(page, moving)).x - before.x) < .1, 'Returning from either boundary restores the same position')
        }

        for (const offset of [height, height / 2, 0, -height / 2]) {
          const top = await page.locator(`#${id}`).evaluate(element => scrollY + element.getBoundingClientRect().top)
          await settleScroll(page, Math.max(0, Math.round(top - offset)))
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${width}px ${id} does not create page-wide horizontal overflow`)
        }

        if (width === 1440 || width === 390) {
          const top = await page.locator(`#${id}`).evaluate(element => scrollY + element.getBoundingClientRect().top)
          await settleScroll(page, Math.round(top - 160))
          await page.waitForTimeout(1800)
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
      await next.click()
      await page.waitForFunction(() => {
        const box = document.querySelector('.home-editorial-journal-card:last-child .home-editorial-photo').getBoundingClientRect()
        return box.left >= 0 && box.right <= innerWidth
      })
      report(`PASS: ${width}px headings and cards move in opposite directions, retrace, fit the viewport, and retain carousel controls`)

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
