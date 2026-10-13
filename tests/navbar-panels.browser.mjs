import assert from 'node:assert/strict'

export async function runNavbarPanelChecks(browser, baseURL, pass) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('jordnary-theme', 'light')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const open = async section => {
    await page.locator(`#nav-toggle-${section}`).focus()
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(id => {
      const panel = document.querySelector(`#nav-panel-${id}`)
      return !panel.hidden && getComputedStyle(panel.querySelector('.nav-mega-content')).opacity === '1'
    }, section)
  }
  try {
    await page.goto(new URL('about/', baseURL).href)
    for (const section of ['about', 'projects']) {
      await open(section)
      const photos = await page.locator(`#nav-panel-${section} img`).evaluateAll(async images => {
        await Promise.all(images.map(image => image.decode()))
        return images.map(image => ({
          local: new URL(image.currentSrc).origin === location.origin,
          loaded: image.complete && image.naturalWidth > 0,
          highResolution: image.srcset.includes('-1920.webp 1920w'),
          ratio: image.getBoundingClientRect().width / image.getBoundingClientRect().height,
        }))
      })
      assert.equal(photos.length, section === 'about' ? 1 : 3)
      assert.ok(photos.every(photo => photo.local && photo.loaded && photo.highResolution && photo.ratio > 1))
    }
    assert.equal(await page.locator('#nav-panel-learning img').count(), 0)
    const storyHref = await page.locator('#nav-panel-about .nav-story-link').getAttribute('href')
    assert.equal(storyHref, '/about/#journey-start')
    pass('Editorial photographs load locally on a high-density screen; learning remains text-only and image links have real destinations')

    await open('about')
    await page.locator('.nav-link[href="/projects/"]').hover()
    await page.waitForTimeout(450)
    assert.equal(await page.locator('#nav-toggle-projects').getAttribute('aria-expanded'), 'true', 'Hover can take over from a keyboard-focused panel without an inert focusout dismissing it')
    await open('about')
    const frames = await page.evaluate(async () => {
      const panels = [...document.querySelectorAll('.nav-mega-panel')]
      const header = document.querySelector('.nav-shell')
      const frames = []
      const start = performance.now()
      const changes = [{ time: 0, section: 'projects' }, { time: 70, section: 'learning' }, { time: 140, section: 'about' }, { time: 210, section: 'projects' }]
      let next = 0
      while (performance.now() - start < 620) {
        const time = performance.now() - start
        if (next < changes.length && time >= changes[next].time) {
          document.querySelector(`#nav-toggle-${changes[next++].section}`).click()
        }
        await new Promise(resolve => requestAnimationFrame(resolve))
        frames.push({
          painted: panels.filter(panel => getComputedStyle(panel).display !== 'none').length,
          interactive: panels.filter(panel => !panel.inert).length,
          surfaceOpacity: Number(getComputedStyle(header, '::after').opacity),
          documentTop: document.querySelector('main').getBoundingClientRect().top + scrollY,
        })
      }
      return frames
    })
    assert.ok(frames.every(frame => frame.painted === 1 && frame.interactive === 1), 'Rapid switching never superimposes outgoing and incoming links')
    assert.ok(frames.every(frame => frame.surfaceOpacity === 1), 'The shared background stays opaque during rapid switching')
    assert.ok(frames.every(frame => Math.abs(frame.documentTop - frames[0].documentTop) < 1), 'Changing photo layouts never shifts document content')
    assert.equal(await page.locator('#nav-toggle-projects').getAttribute('aria-expanded'), 'true')
    pass('Hover takes over from keyboard focus; rapid photo/text switching keeps one set of links, a continuous background and stable page layout')

    await page.setViewportSize({ width: 1024, height: 320 })
    await open('projects')
    await page.locator('#nav-panel-projects a').last().focus()
    const geometry = await page.locator('#nav-panel-projects').evaluate(panel => {
      const rect = panel.getBoundingClientRect()
      const focused = document.activeElement.getBoundingClientRect()
      return {
        horizontalOverflow: panel.scrollWidth > panel.clientWidth,
        visibleBottom: rect.bottom <= innerHeight + 1,
        scrollable: panel.scrollHeight > panel.clientHeight,
        focusedVisible: focused.top >= rect.top && focused.bottom <= rect.bottom + 1,
        documentScroll: scrollY,
      }
    })
    assert.equal(geometry.horizontalOverflow, false)
    assert.equal(geometry.visibleBottom, true)
    assert.equal(geometry.scrollable, true)
    assert.equal(geometry.focusedVisible, true)
    assert.equal(geometry.documentScroll, 0)
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('#nav-toggle-projects').evaluate(el => el === document.activeElement), true)
    assert.deepEqual(errors, [])
    pass('A short desktop viewport scrolls within the panel, keeps its last link reachable and restores focus on Escape')
  } finally {
    await context.close()
  }
}
