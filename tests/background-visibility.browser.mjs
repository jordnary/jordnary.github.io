import assert from 'node:assert/strict'
import { launchRealTabs, openSiblingTab } from './real-browser-tabs.mjs'

const { chromium } = await import('playwright')
const tabs = await launchRealTabs(chromium, process.env.COMPANION_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL)
try {
  const page = await tabs.context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.bringToFront()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(new URL('about/', process.env.ABOUT_TEST_URL || 'http://127.0.0.1:4196/').href)
  await page.locator('.journey-margin-motif').first().scrollIntoViewIfNeeded()
  const wait = predicate => page.waitForFunction(predicate, undefined, { polling: 100 })
  const running = () => !document.hidden && document.querySelector('.journey-margin-motif')?.dataset.motion === 'running'
  await wait(running)
  const other = await openSiblingTab(page)
  await wait(() => document.hidden && !document.querySelector('[data-motion-threshold][data-motion="running"]'))
  await page.bringToFront()
  await wait(running)
  console.log('PASS: All About decorations pause in a real hidden tab and the visible sketch resumes')

  const brand = page.locator('.footer-brand')
  const clock = page.locator('.footer-clock time')
  const orbit = brand.locator('[data-footer-orbit]').first()
  await page.locator('.footer-shell').scrollIntoViewIfNeeded()
  await wait(() => document.querySelector('.footer-brand')?.dataset.inView === 'true')
  await other.bringToFront()
  await wait(() => document.hidden && document.querySelector('.footer-brand')?.dataset.inView === 'false')
  const time = await clock.getAttribute('datetime'), path = await orbit.getAttribute('d')
  // Use the test driver's clock; a timer inside the background tab may be throttled.
  await new Promise(resolve => setTimeout(resolve, 2200))
  assert.equal(await clock.getAttribute('datetime'), time)
  assert.equal(await orbit.getAttribute('d'), path)
  await page.bringToFront()
  await wait(() => !document.hidden && document.querySelector('.footer-brand')?.dataset.inView === 'true'
    && Date.now() - Date.parse(document.querySelector('.footer-clock time').dateTime) < 1100)
  assert.notEqual(await clock.getAttribute('datetime'), time)
  assert.deepEqual(errors, [])
  console.log('PASS: Footer time and orbit stop in a real hidden tab, then return with the current time')
} finally { await tabs.close() }
