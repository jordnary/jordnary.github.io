import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const ring = element => [null, '::before', '::after'].some(pseudo => {
  const style = getComputedStyle(element, pseudo)
  return !['none', 'hidden'].includes(style.outlineStyle) && Number.parseFloat(style.outlineWidth) > 0
})

export async function runFocusFeedbackChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const session = await context.newCDPSession(page)
  await session.send('DOM.enable')
  await session.send('CSS.enable')
  const force = async (selector, enabled) => {
    const { root } = await session.send('DOM.getDocument')
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector })
    assert.ok(nodeId, `A focus target exists for ${selector}`)
    await session.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: enabled ? ['focus', 'focus-visible'] : [] })
  }
  const checkControl = async (selector, tapPoint = { x: 2, y: 2 }) => {
    await page.touchscreen.tap(tapPoint.x, tapPoint.y)
    assert.equal(await page.locator('html').getAttribute('data-input-modality'), 'pointer')
    await force(selector, true)
    assert.equal(await page.locator(selector).first().evaluate(ring), false, `${selector} has no pointer-focus ring even if the browser matches :focus-visible`)
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('html').getAttribute('data-input-modality'), 'keyboard')
    assert.equal(await page.locator(selector).first().evaluate(ring), true, `${selector} retains its keyboard-focus indicator`)
    await force(selector, false)
  }
  try {
    for (const [path, selector] of [
      ['', '.launch-intro-enter'], ['home/', '.home-editorial-scroll'], ['about/', '.journey-scroll-link'],
      ['learning/', '.note-cover'], ['projects/', '.archive-filters button'],
      ['projects/gaussian-image-fitting/', '.project-reader-back'], ['projects/studio/', '.studio-theme button'],
      ['contact/', '.contact-copy-button'],
    ]) {
      await page.goto(new URL(path, baseURL).href)
      await page.locator(selector).first().waitFor({ state: 'attached' })
      await checkControl(selector)
      await page.touchscreen.tap(2, 2)
      const audit = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('button, a[href], summary, [role="button"], [tabindex]')]
          .filter(element => element instanceof HTMLElement && !element.matches('input, textarea, select, [contenteditable], :disabled')
            && element.getClientRects().length && !element.closest('[inert]'))
        const failures = []
        for (const element of controls) {
          element.focus({ preventScroll: true })
          if (document.activeElement !== element) continue
          for (const pseudo of [null, '::before', '::after']) {
            const style = getComputedStyle(element, pseudo)
            if (!['none', 'hidden'].includes(style.outlineStyle) && parseFloat(style.outlineWidth) > 0) failures.push(element.tagName)
          }
        }
        return { count: controls.length, failures }
      })
      assert.deepEqual(audit.failures, [], `${path || '/'} suppresses pointer-only focus outlines across its controls`)
      report(`${path || '/'}: ${audit.count} controls audited; pointer rings hidden and keyboard rings preserved`)
    }

    await page.goto(new URL('projects/', baseURL).href)
    await page.getByRole('button', { name: 'Open menu', exact: true }).tap()
    const menu = page.getByRole('dialog', { name: 'Site navigation' })
    await menu.waitFor()
    await checkControl('.archive-menu nav a')
    await menu.getByRole('link', { name: 'Home', exact: true }).tap()
    await page.waitForFunction(() => document.body.dataset.page === 'home' && !document.querySelector('.project-page-transition'))
    await force('main', true)
    assert.equal(await page.locator('main').evaluate(ring), false)
    assert.ok(await page.locator('main').evaluate(element => element === document.activeElement), 'Route navigation still transfers semantic focus')
    await force('main', false)
    report('Projects Menu → Home keeps route focus without a black frame around the new page')

    await page.locator('#now .home-gallery-open').first().tap()
    await page.waitForFunction(() => document.querySelector('.home-now-reader')?.dataset.phase === 'open')
    const closeBounds = await page.locator('.home-now-close').boundingBox()
    await checkControl('.home-now-close', { x: closeBounds.x - 10, y: closeBounds.y + 20 })
    await page.locator('.home-now-close').tap()
    await page.locator('.home-now-reader').waitFor({ state: 'detached' })
    report('The home reading panel also removes touch-triggered pseudo-element rings')

    await page.goto(new URL('learning/', baseURL).href)
    await page.locator('.note-cover').first().tap()
    await page.locator('.learning-note-reader[open]').waitFor()
    const bounds = await page.locator('.note-reader-masthead').boundingBox()
    await checkControl('.note-reader-masthead button', { x: bounds.x + 20, y: bounds.y + bounds.height / 2 })
    await page.getByRole('button', { name: '关闭笔记', exact: true }).tap()
    await page.locator('.learning-note-reader[open]').waitFor({ state: 'detached' })
    await force('.notes-filter select', true)
    assert.equal(await page.locator('.notes-filter select').first().evaluate(ring), true, 'Native form controls retain their focus feedback after touch')
    await force('.notes-filter select', false)
    report('Learning reader controls avoid touch focus borders while native form controls retain their feedback')

    await page.goto(new URL('projects/vae-gan-digits/', baseURL).href)
    await page.locator('.project-reader-cover .project-reader-image-trigger').tap()
    await page.locator('.image-gallery').waitFor()
    await page.getByRole('navigation', { name: '图片缩略图' }).waitFor()
    await checkControl('.image-gallery button[aria-label="关闭图片预览"]', { x: 195, y: 160 })
    await page.getByRole('button', { name: '关闭图片预览', exact: true }).tap()
    await page.locator('.image-gallery').waitFor({ state: 'detached' })
    report('Image preview controls follow the same pointer/keyboard policy and still close normally')
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ channel: process.env.FOCUS_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
  try {
    await runFocusFeedbackChecks(browser, process.env.FOCUS_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Focus feedback checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
