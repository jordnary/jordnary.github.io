import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const active = page => page.waitForFunction(() => document.querySelector('.projects-cursor')?.dataset.active === 'true')
const navigate = (page, baseURL, path) => page.evaluate(href => {
  const link = document.createElement('a')
  link.href = href
  document.body.append(link)
  link.click()
  link.remove()
}, new URL(path, baseURL).href)

async function checkTransition(page, action, projectDestination = true) {
  await page.waitForFunction(() => !document.querySelector('.projects-cursor').getAnimations({ subtree: true }).some(animation => animation.playState === 'running'))
  const initial = await page.locator('.projects-cursor').evaluate(cursor => ({
    mode: cursor.dataset.mode, active: cursor.dataset.active, width: cursor.getBoundingClientRect().width,
  }))
  await page.evaluate(() => {
    const node = document.querySelector('.projects-cursor')
    const probe = window.cursorTransitionProbe = { samples: [], frame: 0 }
    const sample = () => {
      const cursor = document.querySelector('.projects-cursor')
      const overlay = document.querySelector('.project-page-transition[open]')
      const rect = cursor.getBoundingClientRect()
      const background = getComputedStyle(cursor).backgroundColor.match(/[\d.]+/g).map(Number)
      probe.samples.push({ same: cursor === node, count: document.querySelectorAll('.projects-cursor').length,
        overlay: Boolean(overlay), phase: overlay?.dataset.phase, active: cursor.dataset.active, mode: cursor.dataset.mode,
        opacity: Number(getComputedStyle(cursor).opacity), width: rect.width, height: rect.height,
        fill: background.length === 4 ? background[3] : 1,
        plus: Number(getComputedStyle(cursor, '::before').opacity),
        x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
        native: overlay ? getComputedStyle(overlay).cursor : null })
      probe.frame = requestAnimationFrame(sample)
    }
    sample()
  })
  await action()
  await page.locator('.project-page-transition[data-phase="covered"]').waitFor()
  const widths = await page.locator('.project-page-transition-line').evaluateAll(lines => lines.map(line => line.getBoundingClientRect().width))
  assert.deepEqual(widths.map(width => width < .75), [false, false, true, false, true, true, false, true, false, false, true, false, true],
    'The original light hairline pattern is preserved')
  const rect = await page.locator('.projects-cursor').boundingBox()
  const { data } = await sharp(await page.screenshot({ clip: {
    x: Math.round(rect.x + rect.width / 2) - 1, y: Math.round(rect.y + rect.height / 2) - 1, width: 2, height: 2,
  } })).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.ok([...data].every(channel => channel < 45), 'The black cursor is actually painted above the opaque transition dialog')
  await page.mouse.move(rect.x + rect.width / 2 + 10, rect.y + rect.height / 2 + 6, { steps: 5 })
  await page.locator('.project-page-transition').waitFor({ state: 'detached' })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.waitForFunction(() => !document.querySelector('.projects-cursor').getAnimations({ subtree: true }).some(animation => animation.playState === 'running'))
  const samples = await page.evaluate(() => {
    cancelAnimationFrame(window.cursorTransitionProbe.frame)
    return window.cursorTransitionProbe.samples
  })
  assert.ok(samples.every(sample => sample.same && sample.count === 1), 'Navigation retains exactly one cursor node')
  const covered = samples.filter(sample => sample.overlay)
  assert.ok(covered.length > 5)
  assert.ok(covered.every(sample => sample.active === 'true' && sample.opacity === 1 && sample.mode === 'default' && sample.native === 'none'),
    'Every transition frame keeps the replacement dot visible and suppresses the native pointer')
  assert.ok(covered.filter(sample => sample.phase !== 'covering').every(sample => Math.abs(sample.width - 10) < .01 && Math.abs(sample.height - 10) < .01),
    'The cursor settles to the normal dot after its entrance shape transition')
  if (initial.active === 'true' && initial.width > 10.1) {
    assert.ok(covered.some(sample => sample.width > 10.1 && sample.width < initial.width - .1), 'The previous cursor shape smoothly contracts into the transition dot')
    if (initial.mode === 'interactive') assert.ok(covered.some(sample => sample.fill > .01 && sample.fill < .99), 'The link ring gradually fills instead of switching abruptly')
    if (initial.mode === 'preview') assert.ok(covered.some(sample => sample.plus > .01 && sample.plus < .99), 'The preview plus fades while its circle contracts')
  }
  assert.equal(samples.at(-1).active, projectDestination ? 'true' : 'false', 'The new page takes over at the existing pointer location')
  if (projectDestination) {
    assert.ok(samples.slice(samples.findIndex(sample => sample.overlay)).every(sample => sample.active === 'true' && sample.opacity === 1),
      'The modal-to-page handoff never hides the cursor between frames')
    const expected = await page.evaluate(() => {
      const cursor = document.querySelector('.projects-cursor')
      const rect = cursor.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return hit?.closest('[data-project-preview]') ? 'preview'
        : hit?.closest('a[href], button:not(:disabled), [role="button"]:not([aria-disabled="true"])') ? 'interactive' : 'default'
    })
    assert.equal(samples.at(-1).mode, expected, 'The destination shape follows the content under the stationary pointer')
    const destination = samples.slice(samples.findLastIndex(sample => sample.overlay) + 1)
    if (expected === 'interactive') {
      assert.ok(destination.some(sample => sample.width > 10.1 && sample.width < 17.9), 'The transition dot smoothly expands into the destination link ring')
      assert.ok(destination.some(sample => sample.fill > .01 && sample.fill < .99), 'The destination ring becomes hollow gradually')
    } else if (expected === 'preview') {
      assert.ok(destination.some(sample => sample.width > 10.1 && sample.width < 23.9 && sample.plus > .01 && sample.plus < .99),
        `The transition dot smoothly becomes the destination preview cursor: ${JSON.stringify(destination.slice(0, 8).map(({ width, plus }) => ({ width, plus })))}`)
    }
  }
}

export async function runProjectCursorTransitionChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(new URL('projects/', baseURL).href)
    await page.locator('.archive-project-link').first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.mouse.move(40, 240)
    await active(page)
    await page.locator('.archive-project-link').first().hover()
    await checkTransition(page, () => page.locator('.archive-project-link').first().click())
    await page.locator('.project-reader-back').hover()
    await checkTransition(page, () => navigate(page, baseURL, 'projects/vae-gan-digits/'))
    report('Preview plus and link ring smoothly become the transition dot, then recover the correct destination shape without recreating the cursor')

    await page.locator('.project-reader-cover .project-reader-image-trigger').click()
    await page.locator('.image-gallery').waitFor()
    await page.waitForFunction(() => document.querySelector('.projects-cursor').dataset.active === 'false')
    await page.keyboard.press('Escape')
    await page.locator('.image-gallery').waitFor({ state: 'detached' })
    await active(page)
    report('Image preview yields to the native pointer and closing resumes the shared cursor without moving the mouse')

    await checkTransition(page, () => navigate(page, baseURL, 'projects/studio/'))
    await page.getByRole('button', { name: 'Dark', exact: true }).click()
    await page.mouse.move(40, 100)
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.projects-cursor')).backgroundColor === 'rgb(242, 242, 242)')
    await checkTransition(page, () => navigate(page, baseURL, 'projects/'))
    report('Studio keeps its contrasting cursor color and changes to the black dot during the paper transition')

    await checkTransition(page, () => navigate(page, baseURL, 'contact/'), false)
    await checkTransition(page, () => page.locator('.nav-link').filter({ hasText: '项目' }).click())
    await page.keyboard.press('Tab')
    await page.waitForFunction(() => document.querySelector('.projects-cursor').dataset.active === 'false')
    await page.mouse.move(40, 240)
    await active(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => document.querySelector('.projects-cursor').dataset.active === 'false')
    assert.deepEqual(errors, [])
    report('Entering from ordinary pages preserves the click position; leaving Projects, keyboard use and reduced motion restore the native pointer')
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.PROJECT_TRANSITION_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runProjectCursorTransitionChecks(browser, process.env.PROJECT_TRANSITION_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Project cursor continuity checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
