import assert from 'node:assert/strict'

export async function runNavbarMobileChecks(browser, baseURL, pass) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    sessionStorage.setItem('jordnary-theme', 'light')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const panel = page.locator('.mobile-nav-panel')
  const opened = () => page.waitForFunction(() => {
    const panel = document.querySelector('.mobile-nav-panel')
    return !panel.inert && panel.getBoundingClientRect().x === 0
  })
  const returned = () => page.waitForFunction(() => getComputedStyle(document.querySelector('.mobile-nav-panel')).visibility === 'hidden')
  const openMenu = async () => {
    await page.locator('.nav-menu-button').click()
    await page.waitForFunction(() => {
      const dialog = document.querySelector('#mobile-navigation')
      return dialog.open && getComputedStyle(dialog, '::before').opacity === '1' && dialog.getBoundingClientRect().top === 0
    })
    assert.equal(await page.locator('.mobile-nav-primary').evaluate(el => el.inert), false)
  }
  const sampleSlide = action => page.evaluate(async action => {
    const panel = document.querySelector('.mobile-nav-panel')
    const root = document.querySelector('.mobile-nav-primary')
    const header = document.querySelector('.mobile-nav-header')
    const measure = () => ({
      x: panel.getBoundingClientRect().x,
      width: panel.getBoundingClientRect().width,
      rootX: root.getBoundingClientRect().x,
      headerY: header.getBoundingClientRect().y,
      rootInert: root.inert,
      panelInert: panel.inert,
      opacity: Number(getComputedStyle(panel).opacity),
    })
    const frames = [measure()]
    document.querySelector(action === 'open' ? '#mobile-nav-toggle-learning' : '.mobile-nav-back').click()
    const start = performance.now()
    while (performance.now() - start < 440) {
      await new Promise(resolve => requestAnimationFrame(resolve))
      frames.push(measure())
    }
    return frames
  }, action)
  try {
    await page.goto(new URL('about/', baseURL).href)
    await openMenu()
    for (const action of ['open', 'back']) {
      const frames = await sampleSlide(action)
      assert.ok(frames.filter(frame => frame.x > 1 && frame.x < frame.width - 1).length >= 3, `${action}: the submenu slides through intermediate horizontal positions`)
      assert.ok(frames.every(frame => frame.rootX === 0 && frame.headerY === 0 && frame.opacity === 1), 'The primary menu and header stay still beneath an opaque sliding panel')
      assert.ok(frames.slice(2).every(frame => action === 'open' ? frame.rootInert && !frame.panelInert : !frame.rootInert && frame.panelInert), 'Only the active level is interactive during the slide')
      assert.equal(frames.at(-1).x, action === 'open' ? 0 : frames.at(-1).width)
    }
    assert.equal(await page.locator('#mobile-nav-toggle-learning').evaluate(el => el === document.activeElement), true)
    pass('Mobile submenus slide in from the right and back over a stationary primary menu, restoring focus to the selected row')

    for (const section of ['about', 'learning', 'projects']) {
      await page.locator(`#mobile-nav-toggle-${section}`).tap()
      await opened()
      assert.equal(await panel.getAttribute('aria-label'), `${{ about: '关于', learning: '学习', projects: '项目' }[section]}导航`)
      assert.equal(await page.locator('.mobile-nav-back').evaluate(el => el === document.activeElement), true)
      assert.equal(await panel.locator('.mobile-nav-overview').getAttribute('href'), `/${section}/`)
      assert.ok(await panel.locator('.mobile-nav-feature').count() >= 2)
      await panel.locator('a').last().focus()
      await page.keyboard.press('Tab')
      assert.equal(await page.locator('.mobile-nav-header .nav-brand').evaluate(el => el === document.activeElement), true, 'Tab wraps past the inactive primary menu')
      await page.keyboard.press('Shift+Tab')
      assert.equal(await panel.locator('a').last().evaluate(el => el === document.activeElement), true)
      await page.locator('.mobile-nav-back').tap()
      await returned()
    }
    pass('All three mobile sections expose their real overview, feature and related links, with keyboard focus contained in the active level')

    for (const [width, height] of [[320, 568], [768, 1024], [844, 390]]) {
      await page.setViewportSize({ width, height })
      await page.locator('#mobile-nav-toggle-projects').tap()
      await opened()
      await panel.locator('a').last().focus()
      const geometry = await panel.evaluate(el => {
        const rect = el.getBoundingClientRect()
        const focused = document.activeElement.getBoundingClientRect()
        const primary = document.querySelector('.mobile-nav-link').getBoundingClientRect()
        const secondary = el.querySelector('.mobile-nav-intro').getBoundingClientRect()
        return {
          overflow: el.scrollWidth > el.clientWidth,
          focusedVisible: focused.top >= rect.top && focused.bottom <= rect.bottom + 1,
          headerTop: document.querySelector('.mobile-nav-header').getBoundingClientRect().top,
          headerBottom: document.querySelector('.mobile-nav-header').getBoundingClientRect().bottom,
          panelTop: rect.top,
          panelBottom: rect.bottom,
          documentScroll: scrollY,
          panelScroll: el.scrollTop,
          alignedContent: Math.abs(primary.left - secondary.left) < 1 && Math.abs(primary.right - secondary.right) < 1,
        }
      })
      assert.equal(geometry.overflow, false)
      assert.equal(geometry.alignedContent, true, 'Primary and secondary content share the same left and right insets, even when the submenu scrolls')
      assert.equal(geometry.focusedVisible, true)
      assert.equal(geometry.headerTop, 0)
      assert.equal(geometry.headerBottom, geometry.panelTop)
      assert.equal(geometry.panelBottom, height)
      assert.equal(geometry.documentScroll, 0)
      if (height < 600) assert.ok(geometry.panelScroll > 0)
      await page.locator('.mobile-nav-back').tap()
      await returned()
      await page.locator('#mobile-nav-toggle-projects').tap()
      await opened()
      assert.equal(await panel.evaluate(el => el.scrollTop), 0, 'Each new visit starts at the top of the submenu')
      await page.locator('.mobile-nav-back').tap()
      await returned()
    }
    pass('Phone, tablet and landscape layouts scroll only the submenu, keep the header visible and reset the submenu scroll on re-entry')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('#mobile-nav-toggle-learning').tap()
    await opened()
    await panel.locator('a[href="/learning/#notes"]').tap()
    await page.waitForFunction(() => location.hash === '#notes' && document.body.dataset.page === 'learning')
    assert.equal(await page.locator('#mobile-navigation').evaluate(el => el.open), false)
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
    assert.equal(await page.locator('main').evaluate(el => el === document.activeElement), true)
    await openMenu()
    await page.locator('#mobile-nav-toggle-projects').tap()
    await opened()
    await panel.locator('.mobile-nav-feature').first().tap()
    await page.waitForURL('**/projects/briefing-atlas/')
    await page.locator('.project-reader').waitFor()
    assert.equal(await page.locator('#mobile-navigation').evaluate(el => el.open), false)
    pass('Mobile section anchors and featured projects navigate correctly, dismiss the dialog and release background scrolling')

    await openMenu()
    await page.locator('#mobile-nav-toggle-about').tap()
    await opened()
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('#mobile-navigation').open)
    assert.equal(await page.locator('.nav-menu-button').evaluate(el => el === document.activeElement), true)
    await openMenu()
    await page.locator('#mobile-nav-toggle-learning').tap()
    await opened()
    await page.keyboard.press('Control+k')
    await page.locator('.site-search-backdrop').waitFor()
    assert.equal(await page.locator('#mobile-navigation').evaluate(el => el.open), false)
    await page.keyboard.press('Escape')
    await page.locator('.site-search-backdrop').waitFor({ state: 'hidden' })
    pass('Escape closes nested navigation and the search shortcut hands off cleanly from the submenu')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openMenu()
    await page.locator('#mobile-nav-toggle-about').tap()
    await opened()
    assert.equal(await panel.evaluate(el => el.getAnimations().length), 0)
    await page.locator('.mobile-nav-back').tap()
    await returned()
    assert.equal(await panel.evaluate(el => el.getAnimations().length), 0)
    await page.locator('#mobile-nav-toggle-about').tap()
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.waitForFunction(() => !document.querySelector('#mobile-navigation').open && document.body.style.overflow !== 'hidden')
    assert.deepEqual(errors, [])
    pass('Reduced motion switches levels immediately, and resizing to desktop releases the nested modal without browser errors')
  } finally {
    await context.close()
  }
}
