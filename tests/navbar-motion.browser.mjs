import assert from 'node:assert/strict'

export async function runNavbarMotionChecks(browser, baseURL, pass) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 844 } })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const samplePanel = (section, action) => page.evaluate(async ({ section, action }) => {
    const header = document.querySelector('.nav-shell')
    const panel = document.querySelector(`#nav-panel-${section}`)
    const frames = []
    const sample = () => ({
      height: parseFloat(getComputedStyle(header).getPropertyValue('--nav-panel-height')),
      targetHeight: panel.getBoundingClientRect().height,
      surface: parseFloat(getComputedStyle(header, '::after').height),
      headerHeight: header.getBoundingClientRect().height,
      panelStart: panel.getBoundingClientRect().top - header.getBoundingClientRect().top,
      surfaceOpacity: Number(getComputedStyle(header, '::after').opacity),
      opacity: Number(getComputedStyle(panel.querySelector('.nav-mega-content')).opacity),
      display: getComputedStyle(panel).display,
      hidden: panel.hidden,
      inert: panel.inert,
      documentTop: document.querySelector('main').getBoundingClientRect().top + scrollY,
    })
    frames.push(sample())
    document.querySelector(`#nav-toggle-${section}`).click()
    const start = performance.now()
    let reversed = false
    while (performance.now() - start < 480) {
      await new Promise(resolve => requestAnimationFrame(resolve))
      frames.push(sample())
      if (action === 'reverse' && !reversed && performance.now() - start > 65) {
        document.querySelector(`#nav-toggle-${section}`).click()
        reversed = true
      }
    }
    return frames
  }, { section, action })
  const boundedSteps = frames => {
    const largest = Math.max(...frames.map(frame => frame.height))
    return frames.slice(1).every((frame, index) => Math.abs(frame.height - frames[index].height) < Math.max(4, largest * 0.65))
  }
  try {
    await page.goto(new URL('about/', baseURL).href)
    await page.locator('.nav-shell').waitFor()
    const opening = await samplePanel('learning', 'open')
    const expandedHeight = opening.at(-1).height
    assert.ok(expandedHeight > 100 && opening.some(frame => frame.height > 5 && frame.height < expandedHeight - 5), 'Dropdown height interpolates instead of appearing in one step')
    assert.ok(opening.some(frame => frame.opacity > 0.05 && frame.opacity < 0.95), 'Dropdown content fades as its surface expands')
    assert.ok(opening.every(frame => Math.abs(frame.documentTop - opening[0].documentTop) < 1), 'Dropdown animation never moves document layout')
    assert.ok(opening.every(frame => frame.surface >= frame.panelStart + Math.min(frame.height, frame.targetHeight) - 0.1), 'The shared surface covers the clipped panel on every frame')
    pass('Dropdown opening smoothly expands a continuous surface without moving the page')

    const switching = await samplePanel('about', 'open')
    assert.ok(switching.every(frame => frame.surfaceOpacity === 1), 'Switching sections does not fade the shared background')
    assert.ok(boundedSteps(switching), 'A differently sized menu transitions from the current height')
    assert.equal(await page.locator('#nav-panel-learning').getAttribute('inert'), '', 'Outgoing content cannot take focus or clicks')
    const reversed = await samplePanel('about', 'reverse')
    assert.ok(reversed.some(frame => frame.hidden && frame.display !== 'none' && frame.inert && frame.opacity > 0 && frame.opacity < 1), 'Closing content stays painted but inert during its exit')
    assert.ok(boundedSteps(reversed), 'Reopening during exit reverses smoothly from the current height')
    assert.equal(reversed.at(-1).hidden, false)
    assert.equal(reversed.at(-1).opacity, 1)
    const closing = await samplePanel('about', 'close')
    assert.ok(closing.some(frame => frame.height > 1 && frame.height < closing[0].height - 1), 'Closing contracts the surface instead of removing it abruptly')
    assert.equal(closing.at(-1).display, 'none')
    assert.equal(closing.at(-1).height, 0)
    pass('Switching, closing and interrupted reopening keep the background continuous and retiring links inert')

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.mouse.click(20, 500)
      const beforeWheel = await page.evaluate(() => scrollY)
      await page.mouse.wheel(0, 450)
      await page.waitForFunction(value => scrollY >= value + 400, beforeWheel)
      await page.waitForFunction(() => document.querySelector('.nav-shell').getBoundingClientRect().bottom <= 0)
      const sampleHeader = (amount, reverse = false) => page.evaluate(async ({ amount, reverse }) => {
        const header = document.querySelector('.nav-shell')
        const start = performance.now()
        const measure = () => {
          const style = getComputedStyle(header)
          const matrix = new DOMMatrixReadOnly(style.transform)
          return {
            time: performance.now() - start,
            top: header.getBoundingClientRect().top,
            height: header.offsetHeight,
            hidden: header.classList.contains('is-hidden'),
            opacity: Number(style.opacity),
            scaleX: matrix.a, scaleY: matrix.d,
            page: scrollY,
            documentTop: document.querySelector('main').getBoundingClientRect().top + scrollY,
          }
        }
        const frames = [measure()]
        scrollBy({ top: amount, behavior: 'instant' })
        let reverseAt = null
        while (performance.now() - start < 430) {
          await new Promise(resolve => requestAnimationFrame(resolve))
          const frame = measure()
          frames.push(frame)
          if (reverse && reverseAt === null && frame.time > 80 && frame.hidden) {
            reverseAt = frame.time
            scrollBy({ top: -12, behavior: 'instant' })
          }
        }
        return { frames, reverseAt }
      }, { amount, reverse })
      const checkSlide = ({ frames }, hiding) => {
        const start = frames.find(frame => frame.hidden === hiding)
        const initialTop = frames[0].top
        const endTop = hiding ? -start.height - 1 : 0
        const progress = frame => (frame.top - initialTop) / (endTop - initialTop)
        const finish = frames.find(frame => progress(frame) >= 0.999)
        const duration = finish.time - start.time
        assert.ok(duration >= 180 && duration <= 340, `${width}px: a slide completes in about a quarter second (${duration.toFixed(1)}ms)`)
        assert.ok(frames.filter(frame => progress(frame) > 0.05 && progress(frame) < 0.95).length >= 3, `${width}px: movement passes through intermediate positions`)
        const firstMove = frames.find(frame => progress(frame) > 0.01)
        assert.ok(firstMove.time - start.time < 75, `${width}px: sliding starts without waiting for scroll to stop`)
        const at = fraction => frames.reduce((nearest, frame) => Math.abs(frame.time - start.time - duration * fraction) < Math.abs(nearest.time - start.time - duration * fraction) ? frame : nearest)
        assert.ok(progress(at(0.25)) < 0.25 && progress(at(0.75)) > 0.75, `${width}px: the slide accelerates gently and decelerates at the end`)
        assert.ok(frames.every(frame => frame.opacity === 1 && frame.scaleX === 1 && frame.scaleY === 1), 'The whole bar slides without fading or scaling')
        assert.ok(frames.every(frame => frame.top <= 0.1 && frame.top >= -frame.height - 1.1), 'The bar does not overshoot either endpoint')
        assert.ok(frames.every(frame => Math.abs(frame.documentTop - frames[0].documentTop) < 1), 'Sliding does not move document layout')
        assert.ok(frames.slice(2).every(frame => frame.page === frames.at(-1).page), 'The animation finishes while the page is stationary')
        assert.ok(Math.abs(frames.at(-1).top - endTop) < 0.1)
      }
      checkSlide(await sampleHeader(-12), false)
      checkSlide(await sampleHeader(220), true)
      pass(`${width}px header slides as one solid bar with a gentle start and finish, independently of further scrolling`)

      await sampleHeader(-12)
      const { frames, reverseAt } = await sampleHeader(220, true)
      const reversing = frames.filter(frame => frame.time >= reverseAt)
      assert.ok(reversing.some(frame => frame.top < -1 && frame.top > -frame.height), 'Reversing preserves a partially visible position')
      for (let index = 1; index < frames.length; index++) {
        const previous = frames[index - 1]
        const current = frames[index]
        if (current.time - previous.time < 40) {
          assert.ok(Math.abs(current.top - previous.top) < current.height * 0.3, 'A mid-slide reversal does not jump to an endpoint')
        }
      }
      assert.equal(frames.at(-1).hidden, false)
      assert.equal(frames.at(-1).top, 0)
      pass(`${width}px an upward reversal returns smoothly from the current position without a jump`)
    }

    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForFunction(() => document.querySelector('.nav-shell').getBoundingClientRect().top === 0)
    const mobileFrames = await page.evaluate(async () => {
      const dialog = document.querySelector('#mobile-navigation')
      const triggerIcon = document.querySelector('.nav-menu-button .menu-icon')
      const modalIcon = dialog.querySelector('.menu-icon')
      const initialIcon = triggerIcon.getBoundingClientRect()
      const frames = []
      const record = async phase => {
        const start = performance.now()
        while (performance.now() - start < 480) {
          await new Promise(resolve => requestAnimationFrame(resolve))
          const style = getComputedStyle(dialog)
          const matrix = new DOMMatrixReadOnly(getComputedStyle(modalIcon.querySelector('.menu-line-top')).transform)
          const icon = modalIcon.getBoundingClientRect()
          const trigger = triggerIcon.getBoundingClientRect()
          frames.push({
            phase, opacity: Number(getComputedStyle(dialog, '::before').opacity),
            open: dialog.open, inert: dialog.inert, display: style.display,
            top: dialog.getBoundingClientRect().top,
            headerOpacity: Number(style.opacity) * Number(getComputedStyle(dialog.querySelector('.mobile-nav-header')).opacity),
            angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
            middleOpacity: Number(getComputedStyle(modalIcon.querySelector('.menu-line-middle')).opacity),
            aligned: Math.abs(icon.x - initialIcon.x) < 1 && Math.abs(icon.y - initialIcon.y) < 1
              && Math.abs(trigger.x - initialIcon.x) < 1 && Math.abs(trigger.y - initialIcon.y) < 1,
          })
        }
      }
      document.querySelector('.nav-menu-button').click()
      await record('opening')
      dialog.querySelector('.mobile-nav-close').click()
      await record('closing')
      return frames
    })
    for (const phase of ['opening', 'closing']) {
      assert.ok(mobileFrames.some(frame => frame.phase === phase && frame.opacity > 0.05 && frame.opacity < 0.95), `Mobile ${phase} uses a visible transition`)
      const painted = mobileFrames.filter(frame => frame.phase === phase && frame.display !== 'none')
      assert.ok(painted.filter(frame => frame.angle < -5 && frame.angle > -130).length >= 3, `${phase}: the hamburger rotates through intermediate angles`)
      assert.ok(painted.some(frame => frame.middleOpacity > 0.05 && frame.middleOpacity < 0.95), `${phase}: the middle stroke fades smoothly`)
      assert.ok(painted.every(frame => frame.top === 0 && frame.headerOpacity === 1 && frame.aligned), `${phase}: the solid header and icon stay in place`)
    }
    const fullyOpen = mobileFrames.filter(frame => frame.phase === 'opening').at(-1)
    assert.ok(Math.abs(fullyOpen.angle + 135) < 0.1)
    assert.equal(fullyOpen.middleOpacity, 0)
    assert.ok(mobileFrames.filter(frame => frame.phase === 'closing' && !frame.open).every(frame => frame.inert))
    assert.equal(mobileFrames.at(-1).display, 'none')
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
    pass('The mobile surface fades while the stationary hamburger rotates into a cross and back, releasing focus and scroll on close')

    const interrupted = await page.evaluate(async () => {
      const dialog = document.querySelector('#mobile-navigation')
      const trigger = document.querySelector('.nav-menu-button')
      const icon = dialog.querySelector('.menu-line-top')
      const sample = () => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(icon).transform)
        return { time: performance.now(), angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, open: dialog.open }
      }
      const frames = []
      const record = async duration => {
        const start = performance.now()
        while (performance.now() - start < duration) {
          await new Promise(resolve => requestAnimationFrame(resolve))
          frames.push(sample())
        }
      }
      trigger.click()
      await record(120)
      dialog.querySelector('.mobile-nav-close').click()
      await record(50)
      trigger.click()
      await record(480)
      return frames
    })
    assert.equal(interrupted.at(-1).open, true, 'Reopening survives any queued close event')
    assert.ok(Math.abs(interrupted.at(-1).angle + 135) < 0.1)
    for (let index = 1; index < interrupted.length; index++) {
      const previous = interrupted[index - 1]
      const current = interrupted[index]
      if (current.time - previous.time < 40) assert.ok(Math.abs(current.angle - previous.angle) < 40, 'Interrupting the icon never jumps to an endpoint')
    }
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#mobile-navigation')).display === 'none')
    pass('Rapid open, close and reopen reverses the icon continuously without losing the reopened menu')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.locator('.nav-menu-button').click()
    assert.equal(await page.locator('#mobile-navigation').evaluate(el => getComputedStyle(el, '::before').opacity), '1')
    assert.equal(await page.locator('#mobile-navigation').evaluate(el => el.getAnimations({ subtree: true }).length), 0)
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 1440, height: 844 })
    await page.locator('#nav-toggle-learning').click()
    assert.equal(await page.locator('.nav-shell').evaluate(el => el.getAnimations({ subtree: true }).length), 0)
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('#nav-panel-learning').evaluate(el => getComputedStyle(el).display), 'none')
    await page.mouse.click(20, 500)
    await page.mouse.wheel(0, 450)
    await page.waitForFunction(() => document.querySelector('.nav-shell').classList.contains('is-hidden'))
    assert.ok(await page.locator('.nav-shell').evaluate(el => el.getBoundingClientRect().bottom <= 0 && el.getAnimations().every(animation => animation.transitionProperty !== 'transform')))
    await page.mouse.wheel(0, -12)
    await page.waitForFunction(() => !document.querySelector('.nav-shell').classList.contains('is-hidden'))
    assert.equal(await page.locator('.nav-shell').evaluate(el => el.getBoundingClientRect().top), 0)
    assert.deepEqual(errors, [])
    pass('Reduced motion disables both header sliding and dropdown transitions')
  } finally {
    await context.close()
  }
}
