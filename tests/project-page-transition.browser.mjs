import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { projects } from '../src/data/projects.ts'

const overlaySelector = '.project-page-transition'

async function recordTransition(page) {
  const recorder = await page.evaluateHandle(() => {
    const source = document.querySelector('main')?.firstElementChild
    const samples = []
    let frame
    const sample = () => {
      const overlay = document.querySelector('.project-page-transition')
      const paper = overlay?.querySelector('.project-page-transition-paper')
      const copy = overlay?.querySelector('.project-page-transition-copy')
      const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
      const displayed = Boolean(overlay && getComputedStyle(overlay).display !== 'none')
      const box = displayed ? overlay.getBoundingClientRect() : null
      samples.push({
        phase: overlay?.dataset.phase ?? null,
        opacity: paper ? Number(getComputedStyle(paper).opacity) : null,
        copyOpacity: copy ? Number(getComputedStyle(copy).opacity) : 0,
        oldPage: source?.isConnected ?? false,
        heading: document.querySelector('main h1')?.textContent,
        pathname: location.pathname,
        inert: document.querySelector('.app-shell')?.inert,
        displayed,
        modal: Boolean(overlay?.matches(':modal') && overlay.open),
        onTop: Boolean(overlay && (hit === overlay || overlay.contains(hit))),
        viewport: { width: innerWidth, height: innerHeight },
        box: box && { x: box.x, y: box.y, width: box.width, height: box.height },
        lineXs: displayed ? [...overlay.querySelectorAll('.project-page-transition-line')].map(line => line.getBoundingClientRect().x) : [],
        labelXs: displayed ? [...overlay.querySelectorAll('.project-page-transition-label')].map(label => label.getBoundingClientRect().x) : [],
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

function assertStableGeometry(samples) {
  const groups = new Map()
  for (const sample of samples.filter(sample => sample.displayed)) {
    const key = `${sample.viewport.width}x${sample.viewport.height}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(sample)
  }
  const stable = (values, label) => {
    const min = Math.min(...values)
    const max = Math.max(...values)
    assert.ok(max - min <= 0.1, `${label} must stay fixed within one viewport; observed ${min} to ${max}px`)
  }
  for (const [viewport, frames] of groups) {
    assert.ok(frames.every(frame => frame.lineXs.length === 13 && frame.labelXs.length === 3),
      'Every transition frame retains all 13 rules and three English labels')
    for (const property of ['x', 'y', 'width', 'height'])
      stable(frames.map(frame => frame.box[property]), `${viewport} overlay ${property}`)
    for (let index = 0; index < 13; index++)
      stable(frames.map(frame => frame.lineXs[index]), `${viewport} lineXs[${index}]`)
    // The font can be chosen while the copy is transparent, before its entrance.
    const visibleCopy = frames.filter(frame => frame.copyOpacity > 0.01)
    if (visibleCopy.length) {
      for (let index = 0; index < 3; index++)
        stable(visibleCopy.map(frame => frame.labelXs[index]), `${viewport} visible labelXs[${index}]`)
    }
  }
}

async function temporaryLink(page, href) {
  await page.evaluate(href => {
    const link = document.createElement('a')
    link.href = href
    document.body.append(link)
    link.click()
    link.remove()
  }, href)
}

async function assertReleased(page) {
  await page.locator(overlaySelector).waitFor({ state: 'detached' })
  assert.equal(await page.locator('.app-shell').evaluate(shell => shell.inert), false)
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('main')), true,
    'Navigation returns focus to the newly rendered main content')
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden',
    'Transition and menu cleanup release the scroll lock')
}

async function transition(page, action, destination, { history = false, during } = {}) {
  const before = new URL(page.url()).pathname
  const stop = await recordTransition(page)
  let samples
  try {
    await action()
    await page.locator(`${overlaySelector}[data-phase="covering"]`).waitFor()
    if (during) await during()
    await destination.waitFor({ state: 'visible' })
    await assertReleased(page)
  } finally { samples = await stop() }
  const covering = samples.filter(sample => sample.phase === 'covering')
  assert.ok(covering.some(sample => sample.opacity > 0.01 && sample.opacity < 0.98),
    'The paper fades through intermediate opacity before the route changes')
  assert.ok(covering.every(sample => sample.oldPage), 'The previous page stays rendered during cover')
  if (!history) assert.ok(covering.every(sample => sample.pathname === before),
    'Ordinary clicks defer the URL change until the paper is opaque')
  else assert.ok(covering.some(sample => sample.pathname !== before),
    'History updates the URL immediately while the previous page stays rendered')
  const firstNewPage = samples.find(sample => !sample.oldPage)
  assert.ok(firstNewPage && firstNewPage.opacity >= 0.999,
    'The destination first renders behind fully opaque paper')
  assert.ok(samples.some(sample => sample.phase === 'covered' && sample.opacity >= 0.999))
  assert.ok(samples.some(sample => sample.phase === 'revealing' && sample.opacity > 0 && sample.opacity < 1))
  assert.ok(samples.filter(sample => sample.phase).every(sample => sample.inert),
    'The shell remains inert until the overlay is removed')
  assert.ok(samples.filter(sample => sample.displayed).every(sample => sample.modal),
    'Every displayed overlay frame belongs to the browser top layer')
  assertStableGeometry(samples)
  return samples
}

async function noTransition(page, action, settled) {
  const stop = await recordTransition(page)
  let samples
  try {
    await action()
    await settled()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  } finally { samples = await stop() }
  assert.ok(samples.every(sample => !sample.phase), 'Page-local actions do not create a page transition')
  assert.equal(await page.locator(overlaySelector).count(), 0)
}

export async function runProjectPageTransitionMobileChecks(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 320, height: 844 },
    isMobile: true, hasTouch: true, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const errors = []
  const url = path => new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href
  page.on('pageerror', error => errors.push(error.message))
  try {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(url('contact/'))
      await page.locator('main h1').waitFor()
      await transition(page, () => temporaryLink(page, url('projects/')), page.locator('.projects-archive'), {
        during: async () => {
          const layout = await page.locator(overlaySelector).evaluate(overlay => {
            const box = overlay.getBoundingClientRect()
            const viewportWidth = document.documentElement.clientWidth
            return {
              fits: Math.abs(box.left) < 1 && Math.abs(box.top) < 1
                && Math.abs(box.width - viewportWidth) < 1 && Math.abs(box.height - innerHeight) < 1,
              labels: [...overlay.querySelectorAll('.project-page-transition-label')].map(label => {
                const rect = label.getBoundingClientRect()
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, text: label.textContent }
              }),
              width: viewportWidth,
              height: innerHeight,
              box: { left: box.left, top: box.top, width: box.width, height: box.height },
            }
          })
          assert.ok(layout.fits, `The paper covers the entire mobile viewport: ${JSON.stringify(layout)}`)
          assert.ok(layout.labels.every(label => label.left >= 0 && label.right <= layout.width
            && label.top >= 0 && label.bottom <= layout.height && /^[A-Z &]+$/.test(label.text)),
          'English transition labels stay inside the mobile viewport')
          for (let index = 1; index < layout.labels.length; index++)
            assert.ok(layout.labels[index - 1].right < layout.labels[index].left, 'Mobile labels do not overlap')
        },
      })
    }
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

export async function runProjectPageTransitionViewportChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    isMobile: false, hasTouch: false, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const errors = []
  const url = path => new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href
  const archive = page.locator('.projects-archive')
  const about = page.locator('#about')
  const fillsViewport = samples => assert.ok(samples.filter(sample => sample.displayed).every(sample =>
    Math.abs(sample.box.x) < 0.1 && Math.abs(sample.box.y) < 0.1
      && Math.abs(sample.box.width - sample.viewport.width) < 0.1
      && Math.abs(sample.box.height - sample.viewport.height) < 0.1),
  'The transition covers the full viewport even when the route changes its native scrollbar gutter')
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.goto(url('about/'))
    await about.waitFor()
    await page.waitForFunction(() => getComputedStyle(document.documentElement).scrollbarGutter === 'stable')
    fillsViewport(await transition(page, () => temporaryLink(page, url('projects/')), archive))
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth), 'none')
    report('Narrow desktop entry keeps the overlay, all 13 rules and English labels fixed across the route commit')

    await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.archive-menu')?.dataset.state === 'open')
    fillsViewport(await transition(page,
      () => page.locator('.archive-menu').getByRole('link', { name: 'About', exact: true }).click(), about))
    report('Narrow desktop exit stays fixed when the destination restores a stable native scrollbar gutter')

    fillsViewport(await transition(page, () => page.evaluate(() => history.back()), archive, { history: true }))
    fillsViewport(await transition(page, () => page.evaluate(() => history.back()), about, { history: true }))
    report('Browser Back preserves geometry in both directions through the same narrow desktop routes')

    const resized = await transition(page, () => temporaryLink(page, url('projects/')), archive, {
      during: async () => {
        await page.waitForFunction(() => {
          const paper = document.querySelector('.project-page-transition-paper')
          return paper && Number(getComputedStyle(paper).opacity) > 0.15
        })
        await page.setViewportSize({ width: 844, height: 390 })
        await page.waitForFunction(() => {
          const box = document.querySelector('.project-page-transition')?.getBoundingClientRect()
          return box && Math.abs(box.width - innerWidth) < 0.1 && Math.abs(box.height - innerHeight) < 0.1
        }, undefined, { timeout: 1000 })
      },
    })
    assert.deepEqual([...new Set(resized.filter(sample => sample.displayed)
      .map(sample => `${sample.viewport.width}x${sample.viewport.height}`))], ['390x844', '844x390'])
    fillsViewport(resized)
    report('A real resize updates coverage from portrait to landscape and keeps geometry stable within each viewport')
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

export async function runProjectPageTransitionFontChecks(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const errors = []
  const url = path => new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href
  let delayedRequests = 0
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/fonts/projects-instrument-serif.ttf', async route => {
    delayedRequests++
    await new Promise(resolve => setTimeout(resolve, 650))
    await route.continue()
  })
  try {
    await page.goto(url('about/'))
    await page.locator('#about').waitFor()
    await transition(page, () => temporaryLink(page, url('projects/')), page.locator('.projects-archive'), {
      during: async () => {
        await page.waitForFunction(() => {
          const copy = document.querySelector('.project-page-transition-copy')
          return copy && Number(getComputedStyle(copy).opacity) > 0.1
        })
        assert.equal(await page.evaluate(() => document.fonts.check('16px "Projects Serif"')), false,
          'The labels become visible while their web font is still delayed')
        await page.waitForFunction(() => document.fonts.check('16px "Projects Serif"'), undefined, { timeout: 2000 })
        assert.ok(await page.locator('.project-page-transition-copy').evaluate(copy => Number(getComputedStyle(copy).opacity) > 0.01),
          'The delayed font arrives while the transition labels are still visible')
      },
    })
    assert.ok(delayedRequests > 0, 'The regression exercised an actual delayed font request')
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

export async function runProjectPageTransitionChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const checks = []
  const errors = []
  const pass = name => { checks.push(name); report(name) }
  const url = path => new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href
  const archive = () => page.locator('.projects-archive')
  const studio = () => page.locator('.project-studio')
  const detail = project => page.locator('.project-reader h1').filter({ hasText: project.title })
  const first = projects.find(project => project.id === 'vae-gan-digits')
  const second = projects.find(project => project.id !== first.id && project.category === first.category)
  const filtered = projects.filter(project => project.category === first.category)
  const waitForFilter = () => page.waitForFunction(ids => {
    const list = document.querySelector('.archive-list')
    return list?.dataset.phase === 'idle'
      && JSON.stringify([...list.children].map(row => row.id)) === JSON.stringify(ids)
  }, filtered.map(project => project.id))
  page.on('pageerror', error => errors.push(error.message))

  try {
    await page.goto(url('contact/'))
    await page.locator('main h1').waitFor()
    await transition(page, () => page.locator('.nav-link').filter({ hasText: '项目' }).click(), archive())
    pass('Entering Projects keeps the old page and URL until opaque paper, then releases input and focus')

    await noTransition(page, () => page.getByRole('button', { name: 'Open menu', exact: true }).click(),
      () => page.waitForFunction(() => document.querySelector('.archive-menu')?.dataset.state === 'open'))
    await noTransition(page, () => page.getByRole('button', { name: 'Close menu', exact: true }).click(),
      () => page.waitForFunction(() => document.querySelector('.archive-menu')?.dataset.state === 'closed'))
    await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.archive-menu')?.dataset.state === 'open')
    const menuSamples = await transition(page,
      () => page.locator('.archive-menu').getByRole('link', { name: 'Contact', exact: true }).click(),
      page.locator('main').filter({ has: page.locator('#contact') }))
    assert.ok(menuSamples.filter(sample => sample.phase === 'covering').every(sample => sample.onTop),
      'A navigation transition receives pointer input above the open modal menu')
    pass('Opening and closing the Projects menu do not animate navigation; a menu destination covers the modal')

    await temporaryLink(page, url('projects/'))
    await archive().waitFor()
    await assertReleased(page)
    await transition(page, () => page.getByRole('link', { name: 'About the studio', exact: true }).click(), studio())
    await transition(page, () => temporaryLink(page, url(`projects/${first.id}/`)), detail(first))
    await transition(page, () => temporaryLink(page, url('projects/studio/')), studio())
    await transition(page, () => page.getByRole('link', { name: 'Back to projects', exact: true }).click(), archive(), { history: true })
    pass('Archive, Studio and project details animate between pages; the Studio return link restores the archive')

    await noTransition(page, () => page.getByRole('group', { name: 'Filter projects' }).getByRole('button', { name: 'AI & ML', exact: true }).click(), waitForFilter)
    await transition(page, () => page.evaluate(() => history.back()),
      page.locator('main').filter({ has: page.locator('#contact') }), {
        history: true,
        during: async () => assert.deepEqual(await page.locator('.archive-project').evaluateAll(rows => rows.map(row => row.id)),
          filtered.map(project => project.id), 'Back keeps the filtered archive intact while it is being covered'),
      })
    await transition(page, () => page.evaluate(() => history.forward()), archive(), { history: true })
    await waitForFilter()
    pass('Back from a filtered archive preserves the old collection during cover and restores its filter on Forward')
    const projectLink = page.getByRole('link', { name: `${first.title} — View project`, exact: true })
    await projectLink.scrollIntoViewIfNeeded()
    const archiveScroll = await page.evaluate(() => scrollY)
    await transition(page, () => projectLink.click(), detail(first), {
      during: async () => {
        const before = await page.evaluate(() => scrollY)
        await page.mouse.wheel(0, 500)
        await page.keyboard.press('Escape')
        await temporaryLink(page, url('contact/'))
        assert.equal(await page.evaluate(() => scrollY), before, 'Wheel input cannot move the old page during cover')
      },
    })
    assert.equal(new URL(page.url()).pathname, new URL(url(`projects/${first.id}/`)).pathname)
    await transition(page, () => temporaryLink(page, url(`projects/${second.id}/`)), detail(second))
    await transition(page, () => page.evaluate(() => history.back()), detail(first), { history: true })
    await transition(page, () => page.evaluate(() => history.forward()), detail(second), { history: true })
    const cancelled = await transition(page, async () => {
      await page.evaluate(() => history.back())
      await page.locator(`${overlaySelector}[data-phase="covering"]`).waitFor()
      await page.evaluate(() => history.back())
    }, archive(), { history: true })
    assert.ok(cancelled.every(sample => sample.heading !== first.title),
      'A second Back request cancels the intermediate project before it can commit')
    await waitForFilter()
    await page.waitForFunction(y => Math.abs(scrollY - y) < 8, archiveScroll)
    assert.equal(await page.getByRole('button', { name: 'AI & ML', exact: true }).getAttribute('aria-pressed'), 'true')
    pass('Archive, detail and detail-to-detail navigation supports Back/Forward; rapid Back cancels stale commits and restores filter and scroll')

    await transition(page, () => projectLink.click(), detail(first))
    await noTransition(page, () => page.getByRole('button', { name: '本页目录', exact: true }).click(),
      () => page.locator('dialog.project-reader-toc').waitFor({ state: 'visible' }))
    const chapter = page.locator('#project-toc-links a').nth(1)
    const chapterHash = await chapter.getAttribute('href')
    await noTransition(page, () => chapter.click(), () => page.waitForFunction(hash => location.hash === hash, chapterHash))
    const alias = `${url(`projects/${first.id}/`)}index.html?source=transition-test${chapterHash}`
    await noTransition(page, () => temporaryLink(page, alias), () => page.waitForURL(alias))
    assert.equal(await detail(first).count(), 1)
    pass('Project filters, chapter anchors, query parameters and static HTML aliases never trigger page transitions')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await noTransition(page, () => temporaryLink(page, url('projects/')), () => archive().waitFor())
    await noTransition(page, () => page.getByRole('link', { name: 'About the studio', exact: true }).click(), () => studio().waitFor())
    await assertReleased(page)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await temporaryLink(page, url(`projects/${first.id}/`))
    await page.locator(`${overlaySelector}[data-phase="covering"]`).waitFor()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await detail(first).waitFor({ timeout: 1500 })
    await page.locator(overlaySelector).waitFor({ state: 'detached', timeout: 1500 })
    await assertReleased(page)
    pass('Reduced motion skips the overlay, and enabling it mid-transition completes navigation without leaving locks')

    await runProjectPageTransitionMobileChecks(browser, baseURL)
    pass('The overlay covers narrow mobile viewports and keeps its English labels within the screen')
    await runProjectPageTransitionViewportChecks(browser, baseURL)
    pass('Narrow desktop route changes and Back preserve geometry; real resizing updates the overlay coverage')
    await runProjectPageTransitionFontChecks(browser, baseURL)
    pass('A web font arriving after the labels become visible cannot move their text or delay transition completion')
    assert.deepEqual(errors, [])
    return checks
  } finally { await context.close() }
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.PROJECT_TRANSITION_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECT_TRANSITION_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.PROJECT_TRANSITION_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runProjectPageTransitionChecks(browser, process.env.PROJECT_TRANSITION_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} project page transition checks passed`)
  } catch (error) {
    console.error('Project page transition checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
