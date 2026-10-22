import assert from 'node:assert/strict'

const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })
  await page.addInitScript(() => sessionStorage.setItem('site-live2d-collapsed-desktop', 'true'))
  await page.goto(new URL('home/', process.env.HOME_EDITORIAL_TEST_URL || 'http://localhost:5173/').href)
  const button = page.locator('#now .home-gallery-open').first()
  await button.scrollIntoViewIfNeeded()
  await page.waitForTimeout(2000)
  for (const mode of ['button', 'Escape-outside', 'Escape-hovered', 'quick-Escape', 'quick-Escape']) {
    await button.click()
    if (mode !== 'quick-Escape') await page.waitForFunction(() => document.querySelector('.home-now-reader')?.dataset.phase === 'open')
    if (mode === 'Escape-outside') await page.mouse.move(20, 20)
    await page.evaluate(() => {
      const check = window.__focusReturnCheck = { frames: [], frame: 0 }
      const record = () => {
        const button = document.querySelector('#now .home-gallery-open')
        const image = button.querySelector('img')
        const bounds = button.querySelector('.home-gallery-window').getBoundingClientRect()
        const phase = document.querySelector('.home-now-reader')?.dataset.phase || 'returned'
        check.frames.push({ phase, width: bounds.width, height: bounds.height,
          scale: new DOMMatrix(getComputedStyle(image).transform).a,
          transitions: [button, image].flatMap(element => element.getAnimations()).filter(animation =>
            animation instanceof CSSTransition && animation.transitionProperty === 'transform').length })
        check.frame = requestAnimationFrame(record)
      }
      record()
    })
    if (mode === 'button') await page.locator('.home-now-close').click()
    else await page.keyboard.press('Escape')
    await page.waitForSelector('.home-now-reader', { state: 'detached' })
    await page.waitForTimeout(850)
    const frames = await page.evaluate(() => {
      const check = window.__focusReturnCheck; cancelAnimationFrame(check.frame); return check.frames
    })
    const target = frames.filter(frame => frame.phase === 'closing').at(-1)
    const returned = frames.filter(frame => frame.phase === 'returned')
    assert.ok(target && returned.length > 2, 'Capture the closing target and the restored card')
    for (const frame of returned) {
      for (const key of ['width', 'height', 'scale']) assert.ok(Math.abs(frame[key] - target[key]) < .25,
        `${mode}: ${key} changes after the card has landed`)
      assert.equal(frame.transitions, 0, `${mode}: returning focus must not start another transform transition`)
    }
    assert.equal(await page.locator('[data-now-returning], [data-now-origin]').count(), 0, 'Temporary return state is fully removed')
    assert.ok(await button.evaluate(element => document.activeElement === element), 'Native focus is restored')
    if (mode !== 'button') assert.ok(await button.evaluate(element => element.matches(':focus-visible') &&
      getComputedStyle(element).outlineStyle !== 'none'), 'Keyboard focus keeps its visible outline')
    console.log(`PASS: ${mode}; source image and card keep the landing geometry with no residual state`)
  }
  // Once focus leaves, the original mouse hover behavior must still work.
  await page.locator('#now .home-gallery').focus()
  await page.mouse.move(20, 20)
  await page.waitForTimeout(850)
  await button.hover()
  await page.waitForTimeout(850)
  assert.ok(await button.evaluate(element => Math.abs(new DOMMatrix(getComputedStyle(element).transform).a - .975) < .001))
  console.log('PASS: normal mouse hover remains available after focus restoration')
} finally { await browser.close() }
