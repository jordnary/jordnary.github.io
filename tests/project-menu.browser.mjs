import assert from 'node:assert/strict'

const menuSelector = '.archive-menu'
const openMenu = page => page.getByRole('button', { name: 'Open menu', exact: true })
const closeMenu = page => page.getByRole('button', { name: 'Close menu', exact: true })

async function waitForMenuState(page, state) {
  await page.waitForFunction(state => {
    const menu = document.querySelector('.archive-menu')
    return menu?.dataset.state === state && menu.open === (state !== 'closed')
  }, state)
}

async function recordMenu(page) {
  const recorder = await page.evaluateHandle(() => {
    const samples = []
    let frame
    const sample = () => {
      const menu = document.querySelector('.archive-menu')
      const content = menu?.querySelector('.archive-menu-content')
      const opacityInsideMenu = element => {
        if (!element) return null
        let opacity = 1
        for (let current = element; current && current !== menu; current = current.parentElement)
          opacity *= Number(getComputedStyle(current).opacity)
        return opacity
      }
      samples.push({
        state: menu?.dataset.state,
        open: menu?.open,
        modal: menu?.matches(':modal'),
        panel: menu ? Number(getComputedStyle(menu).opacity) : null,
        content: opacityInsideMenu(content),
        wordmark: opacityInsideMenu(content?.querySelector('.archive-wordmark')),
        navigation: opacityInsideMenu(content?.querySelector('nav')),
        close: opacityInsideMenu(content?.querySelector('[aria-label="Close menu"]')),
        overflow: getComputedStyle(document.body).overflowY,
      })
    }
    const tick = () => { sample(); frame = requestAnimationFrame(tick) }
    tick()
    return { stop: () => { cancelAnimationFrame(frame); sample(); return samples } }
  })
  return async () => {
    try { return await recorder.evaluate(recorder => recorder.stop()) }
    finally { await recorder.dispose() }
  }
}

function assertSharedContentFade(samples, phase) {
  const frames = samples.filter(sample => sample.state === phase && sample.open)
  assert.ok(frames.length > 2, `${phase}: the menu exposes intermediate animation frames`)
  for (const sample of frames) {
    for (const element of ['wordmark', 'navigation', 'close']) {
      assert.notEqual(sample[element], null, `${phase}: ${element} belongs to the menu content`)
      assert.ok(Math.abs(sample[element] - sample.content) < 0.01,
        `${phase}: ${element} fades together with the menu content`)
    }
    assert.equal(sample.modal, true, `${phase}: the native dialog remains modal throughout the animation`)
    assert.equal(sample.overflow, 'hidden', `${phase}: background scrolling stays locked throughout the animation`)
  }
  assert.ok(frames.some(sample => sample.panel >= 0.94 && sample.content <= 0.06),
    `${phase}: a solid panel appears between the background and menu content`)
  assert.ok(frames.some(sample => sample.panel >= 0.98 && sample.content > 0.05 && sample.content < 0.95),
    `${phase}: the content fades while the panel is opaque`)
  assert.ok(frames.some(sample => sample.panel > 0.05 && sample.panel < 0.95 && sample.content <= 0.02),
    `${phase}: the panel fades independently while the content is hidden`)
}

async function assertMenuReleased(page, previousOverflow) {
  await waitForMenuState(page, 'closed')
  assert.equal(await page.evaluate(() => document.body.style.overflow), previousOverflow,
    'Closing the menu restores the original body overflow')
  assert.ok(await openMenu(page).evaluate(element => element === document.activeElement),
    'Closing the menu restores focus to its trigger')
  assert.equal(await openMenu(page).getAttribute('aria-expanded'), 'false')
}

async function assertMenuLayout(page, width, height) {
  await page.setViewportSize({ width, height })
  await page.evaluate(() => document.fonts.ready)
  const layout = await page.locator(menuSelector).evaluate(menu => {
    const content = menu.querySelector('.archive-menu-content')
    const rect = element => {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect()
      return { x, y, width, height, right, bottom }
    }
    const groups = [
      ['wordmark', content.querySelector('.archive-wordmark')],
      ['navigation', content.querySelector('nav')],
      ['close', content.querySelector('[aria-label="Close menu"]')],
    ].map(([name, element]) => ({ name, ...rect(element) }))
    return {
      groups,
      items: [...content.querySelectorAll('nav a, nav a > span')].map(rect),
      overflowX: menu.scrollWidth - menu.clientWidth,
      overflowY: menu.scrollHeight - menu.clientHeight,
      documentOverflow: document.documentElement.scrollWidth - innerWidth,
    }
  })
  const size = `${width}x${height}`
  assert.ok(layout.overflowX <= 1 && layout.overflowY <= 1 && layout.documentOverflow <= 1,
    `${size}: the open menu fits without horizontal or vertical overflow`)
  for (const item of [...layout.groups, ...layout.items]) {
    assert.ok(item.width > 0 && item.height > 0 && item.x >= -1 && item.y >= -1
      && item.right <= width + 1 && item.bottom <= height + 1,
    `${size}: every menu element stays inside the viewport`)
  }
  for (let index = 0; index < layout.groups.length; index++) {
    for (const other of layout.groups.slice(index + 1)) {
      const group = layout.groups[index]
      const overlapWidth = Math.min(group.right, other.right) - Math.max(group.x, other.x)
      const overlapHeight = Math.min(group.bottom, other.bottom) - Math.max(group.y, other.y)
      assert.ok(overlapWidth <= 1 || overlapHeight <= 1,
        `${size}: ${group.name} and ${other.name} do not overlap`)
    }
  }
}

export async function runProjectMenuChecks(page, { url, waitForProjects, report }) {
  await page.goto(url('projects/'))
  await waitForProjects(page)
  await page.mouse.move(1, 1)
  const previousOverflow = await page.evaluate(() => document.body.style.overflow)
  let stopRecording = await recordMenu(page)
  await openMenu(page).click()
  await waitForMenuState(page, 'open')
  const opening = await stopRecording()
  assertSharedContentFade(opening, 'opening')
  assert.equal(await openMenu(page).getAttribute('aria-expanded'), 'true')
  assert.ok(await page.locator(menuSelector).evaluate(menu => {
    const style = getComputedStyle(menu)
    const color = style.backgroundColor.match(/[\d.]+/g)?.map(Number)
    return style.backgroundImage === 'none' && color && (color.length === 3 || color[3] === 1)
  }), 'The menu uses an opaque solid background without the project artwork')

  await page.mouse.move(1300, 850)
  const opacities = await page.locator(`${menuSelector} nav a`).evaluateAll(links =>
    links.map(link => Number(getComputedStyle(link).opacity)))
  assert.equal(opacities.length, 5)
  assert.ok(opacities.every(opacity => Math.abs(opacity - 1) < 0.01),
    'All five menu destinations have the same resting opacity, including Projects')
  assert.equal(await page.locator(menuSelector).getByRole('link', { name: 'Projects', exact: true })
    .getAttribute('aria-current'), 'page', 'The current page keeps its accessible navigation semantics')

  const backgroundScroll = await page.evaluate(() => scrollY)
  await page.mouse.wheel(0, 350)
  await page.locator('.archive-project-link').first().evaluate(element => element.focus())
  assert.ok(await page.locator(menuSelector).evaluate(menu => menu.contains(document.activeElement)),
    'Programmatic focus cannot reach the background while the menu is open')
  assert.equal(await page.evaluate(() => scrollY), backgroundScroll,
    'Scrolling over the menu does not move the project list')
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab')
    assert.ok(await page.locator(menuSelector).evaluate(menu => !document.hasFocus() || menu.contains(document.activeElement)),
      'Keyboard focus remains inside the open menu')
  }

  stopRecording = await recordMenu(page)
  await closeMenu(page).click()
  await assertMenuReleased(page, previousOverflow)
  const closing = await stopRecording()
  assertSharedContentFade(closing, 'closing')
  report('The menu and its wordmark, links and Close control use a two-stage fade through a solid panel and retain modal focus until dismissal finishes')

  stopRecording = await recordMenu(page)
  await openMenu(page).click()
  await waitForMenuState(page, 'opening')
  await page.keyboard.press('Escape')
  await assertMenuReleased(page, previousOverflow)
  const interrupted = await stopRecording()
  assert.ok(interrupted.some(sample => sample.state === 'opening')
    && interrupted.some(sample => sample.state === 'closing'),
  'Escape during opening starts dismissal and reaches the closed state')
  assert.ok(interrupted.filter(sample => sample.open).every(sample => sample.modal && sample.overflow === 'hidden'),
    'An interrupted opening retains modal focus and the scroll lock until it closes')

  await openMenu(page).click()
  await waitForMenuState(page, 'open')
  await closeMenu(page).evaluate(async button => {
    for (let index = 0; index < 3; index++) {
      button.click()
      await new Promise(requestAnimationFrame)
    }
  })
  await assertMenuReleased(page, previousOverflow)
  await openMenu(page).click()
  await waitForMenuState(page, 'open')
  assert.equal(await page.locator(menuSelector).evaluate(menu =>
    menu.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0,
  'Reopening settles without stale menu animations')
  report('Escape can interrupt opening, repeated Close requests finish safely, and the menu can open again')

  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 1000], [1440, 560], [844, 390]])
    await assertMenuLayout(page, width, height)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await closeMenu(page).click()
  await assertMenuReleased(page, previousOverflow)
  report('The open menu fits narrow, tablet, desktop and short viewports without overlapping the wordmark, navigation or Close control')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  try {
    stopRecording = await recordMenu(page)
    await openMenu(page).click()
    await waitForMenuState(page, 'open')
    assert.equal(await page.locator(menuSelector).evaluate(menu =>
      menu.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0)
    await page.keyboard.press('Escape')
    await assertMenuReleased(page, previousOverflow)
    const reduced = await stopRecording()
    assert.ok(reduced.every(sample => ['closed', 'open'].includes(sample.state)),
      'Reduced motion opens and closes without transitional menu frames')
  } finally { await page.emulateMedia({ reducedMotion: 'no-preference' }) }
  report('Reduced motion switches the menu immediately and still restores focus and background scrolling')

  await openMenu(page).click()
  await waitForMenuState(page, 'open')
  await page.locator(menuSelector).getByRole('link', { name: 'About', exact: true }).click()
  await page.waitForURL(url('about/'))
  await page.locator('.projects-archive').waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => document.body.style.overflow), previousOverflow,
    'Navigating from the menu restores the original body overflow')
  assert.equal(await page.locator(menuSelector).count(), 0,
    'Navigating from the menu leaves no modal or animation layer behind')
  await page.goBack()
  await waitForProjects(page)
  await waitForMenuState(page, 'closed')
  assert.equal(await page.evaluate(() => document.body.style.overflow), previousOverflow)
  report('Menu navigation releases the body scroll lock, removes the dialog and returns to a closed menu on browser Back')
}
