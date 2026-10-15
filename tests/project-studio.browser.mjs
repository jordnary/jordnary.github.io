import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { projects } from '../src/data/projects.ts'
import { studioArtworks } from '../src/data/project-studio.ts'

const studioPath = 'projects/studio/'
const filteredProjects = projects.filter(project => project.category === '机器学习')

async function waitForStudio(page) {
  await page.locator('.project-studio').waitFor({ state: 'visible' })
  await page.evaluate(() => document.fonts.ready)
}

function themeButton(page, theme) {
  return page.getByRole('group', { name: 'Color theme', exact: true })
    .getByRole('button', { name: theme === 'light' ? 'Light' : 'Dark', exact: true })
}

async function assertTheme(page, theme) {
  await page.waitForFunction(expected => {
    const root = document.querySelector('.project-studio')
    if (!root) return false
    const style = getComputedStyle(root)
    return root.dataset.theme === expected && style.colorScheme === expected
      && style.backgroundColor === (expected === 'light' ? 'rgb(242, 242, 242)' : 'rgb(0, 0, 0)')
      && style.color === (expected === 'light' ? 'rgb(23, 23, 23)' : 'rgb(242, 242, 242)')
  }, theme)
  for (const choice of ['light', 'dark']) {
    assert.equal(await themeButton(page, choice).getAttribute('aria-pressed'), String(choice === theme))
  }
}

async function readThemeIsolation(page) {
  return page.evaluate(() => ({
    document: [document.documentElement, document.body].map(element => ({
      theme: element.getAttribute('data-theme'),
      className: element.className,
      inlineStyle: element.getAttribute('style'),
      scheme: getComputedStyle(element).colorScheme,
      background: getComputedStyle(element).backgroundColor,
      siteBackground: getComputedStyle(element).getPropertyValue('--color-bg').trim(),
    })),
    meta: document.querySelector('meta[name="color-scheme"]')?.content,
    local: Object.entries(localStorage).sort(),
    session: Object.entries(sessionStorage).sort(),
  }))
}

async function waitForArchive(page, expected = projects) {
  await page.waitForFunction(ids => {
    const rows = [...document.querySelectorAll('.archive-project')]
    return document.querySelector('.archive-list')?.dataset.phase === 'idle'
      && JSON.stringify(rows.map(row => row.id)) === JSON.stringify(ids)
  }, expected.map(project => project.id))
}

async function waitForArtworkFilter(page, activeIndex = -1) {
  await page.waitForFunction(index => [...document.querySelectorAll('.studio-gallery-frame img')]
    .every((image, imageIndex) => getComputedStyle(image).filter === `grayscale(${imageIndex === index ? 0 : 1})`), activeIndex)
}

async function assertArtworkLayout(page) {
  const displayed = await page.locator('.studio-gallery-frame').evaluateAll(frames => frames.map(frame => {
    const image = frame.querySelector('img')
    const box = frame.getBoundingClientRect()
    const imageBox = image.getBoundingClientRect()
    return {
      complete: image.complete,
      file: decodeURIComponent(new URL(image.currentSrc).pathname).split('/').at(-1),
      alt: image.alt,
      width: image.naturalWidth,
      height: image.naturalHeight,
      frameRatio: box.width / box.height,
      imageRatio: imageBox.width / imageBox.height,
      objectFit: getComputedStyle(image).objectFit,
    }
  }))
  assert.equal(displayed.length, studioArtworks.length)
  for (const [index, image] of displayed.entries()) {
    const artwork = studioArtworks[index]
    assert.equal(image.complete, true, `${artwork.file}: the image finishes loading`)
    assert.equal(image.file, artwork.file.split('/').at(-1))
    assert.equal(image.alt, artwork.alt)
    assert.ok(image.alt.trim().length > 0 && !/[\u3400-\u9fff]/u.test(image.alt), 'Artwork has descriptive English alternative text')
    assert.equal(image.width, artwork.width)
    assert.equal(image.height, artwork.height)
    assert.ok(['contain', 'cover'].includes(image.objectFit), 'Artwork preserves its intrinsic shape')
    assert.ok(Math.abs(image.frameRatio - artwork.width / artwork.height) < 0.02,
      `${artwork.file}: the frame follows the artwork aspect ratio`)
    assert.ok(Math.abs(image.imageRatio - artwork.width / artwork.height) < 0.02,
      `${artwork.file}: the image is not stretched or substantially cropped`)
  }
}

async function sampleGallery(page, duration = 500) {
  return page.locator('.studio-gallery').evaluate(async (gallery, milliseconds) => {
    const frame = gallery.querySelector('.studio-gallery-frame')
    const samples = []
    const start = performance.now()
    do {
      samples.push({ left: gallery.scrollLeft, top: frame.getBoundingClientRect().top })
      await new Promise(requestAnimationFrame)
    } while (performance.now() - start < milliseconds)
    return samples
  }, duration)
}

async function waitForGalleryPosition(page, fraction) {
  await page.waitForFunction(value => {
    const gallery = document.querySelector('.studio-gallery')
    return gallery && Math.abs(gallery.scrollLeft - (gallery.scrollWidth - gallery.clientWidth) * value) < 0.6
  }, fraction, { timeout: 6000 })
}

function assertStableHeight(samples) {
  assert.ok(Math.max(...samples.map(sample => sample.top)) - Math.min(...samples.map(sample => sample.top)) < 1,
    'Horizontal pointer movement does not move the gallery vertically')
}

export async function runProjectStudioChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const errors = []
  const pass = name => { checks.push(name); report(name) }
  const url = path => new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href
  const contexts = []
  const createPage = async options => {
    const context = await browser.newContext(options)
    contexts.push(context)
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    return page
  }

  try {
    const page = await createPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', colorScheme: 'dark' })
    await page.addInitScript(() => {
      localStorage.setItem('jordnary-theme', 'dark')
      sessionStorage.setItem('jordnary-theme', 'dark')
    })
    const imageRequests = []
    page.on('request', request => {
      if (request.resourceType() === 'image') imageRequests.push(new URL(request.url()).pathname)
    })
    const response = await page.goto(url(studioPath))
    assert.equal(response.status(), 200)
    await waitForStudio(page)
    const root = page.locator('.project-studio')
    const gallery = page.locator('.studio-gallery')
    const heading = page.getByRole('heading', { level: 1 })
    assert.equal(await heading.count(), 1)
    assert.deepEqual((await heading.innerText()).split(/\r?\n/).map(line => line.trim()).filter(Boolean),
      ['CREATIVE', 'DEVELOPMENT', 'PORTFOLIO'])
    assert.equal(await page.locator('.nav-shell, #site-footer, .live2d-companion, .archive-menu, .archive-menu-toggle').count(), 0)
    assert.equal(await page.getByRole('button', { name: /menu/i }).count(), 0)
    const themeGroup = page.getByRole('group', { name: 'Color theme', exact: true })
    assert.equal(await themeGroup.getByRole('button').count(), 2)
    const lightButton = themeButton(page, 'light')
    const darkButton = themeButton(page, 'dark')
    assert.equal((await lightButton.innerText()).trim(), 'LIGHT')
    assert.equal((await darkButton.innerText()).trim(), 'DARK')
    assert.ok(await themeGroup.getByRole('button').evaluateAll(buttons => buttons.every(button =>
      button instanceof HTMLButtonElement && button.type === 'button' && button.tabIndex === 0)))
    await assertTheme(page, 'light')
    assert.ok(!/[\u3400-\u9fff]/u.test(await root.innerText()), 'Visible studio content is English')
    assert.equal(await page.locator('html').getAttribute('lang'), 'en')
    const back = page.getByRole('link', { name: 'Back to projects', exact: true })
    assert.match((await back.innerText()).trim(), /(?:^|\s)back$/i)
    assert.equal(await back.getAttribute('href'), new URL(url('projects/')).pathname)
    assert.ok(await back.evaluate(link => link.hasAttribute('data-project-return')))
    assert.equal(await gallery.getAttribute('tabindex'), '0')
    const frames = page.locator('.studio-gallery-frame')
    const images = frames.locator('img')
    assert.equal(await frames.count(), studioArtworks.length)
    assert.equal(await images.count(), studioArtworks.length)
    assert.notEqual(await page.locator('.studio-gallery-track').getAttribute('aria-hidden'), 'true')
    assert.ok(await frames.evaluateAll(elements => elements.every(element => element.tabIndex === 0)),
      'Every artwork is reachable by keyboard')
    await page.waitForFunction(() => [...document.querySelectorAll('.studio-gallery-frame img')]
      .every(image => image.complete && image.naturalWidth > 0))
    await assertArtworkLayout(page)
    await waitForArtworkFilter(page)
    assert.equal(await root.evaluate(element => element.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running' || animation.pending).length), 0,
    'The studio has no entrance animation')
    const initialSamples = await sampleGallery(page, 250)
    assert.ok(Math.max(...initialSamples.map(sample => sample.left)) - Math.min(...initialSamples.map(sample => sample.left)) < 1)
    assertStableHeight(initialSamples)
    const requestedFiles = new Set(imageRequests.map(path => decodeURIComponent(path).split('/').at(-1)))
    assert.ok(studioArtworks.every(artwork => requestedFiles.has(artwork.file.split('/').at(-1))),
      'Every configured artwork is requested from local image assets')
    pass(`The independent English studio loads all ${studioArtworks.length} accessible artworks at their native proportions without shared controls or an entrance animation`)

    const isolatedAppearance = await readThemeIsolation(page)
    assert.equal(isolatedAppearance.document[0].scheme, 'light')
    assert.equal(isolatedAppearance.meta, 'light')
    await darkButton.click()
    const themeTransition = await root.evaluate(element => {
      const style = getComputedStyle(element)
      return { properties: style.transitionProperty.split(',').map(value => value.trim()),
        durations: style.transitionDuration.split(',').map(value => value.trim()),
        easing: style.transitionTimingFunction.split(',').map(value => value.trim()) }
    })
    for (const property of ['background-color', 'color']) {
      const index = themeTransition.properties.indexOf(property)
      assert.ok(index >= 0, `${property} participates in the theme fade`)
      assert.equal(themeTransition.durations[index % themeTransition.durations.length], '0.6s')
      assert.equal(themeTransition.easing[index % themeTransition.easing.length], 'ease-out')
    }
    const fadeSamples = await root.evaluate(async element => {
      const samples = []
      const start = performance.now()
      do {
        samples.push(getComputedStyle(element).backgroundColor)
        await new Promise(requestAnimationFrame)
      } while (performance.now() - start < 650)
      return samples
    })
    assert.ok(fadeSamples.some(color => !['rgb(242, 242, 242)', 'rgb(0, 0, 0)'].includes(color)),
      'The theme passes through intermediate colors instead of changing abruptly')
    await assertTheme(page, 'dark')
    await page.mouse.move(1, 1)
    await page.waitForFunction(() => {
      const cursor = document.querySelector('.project-studio .projects-cursor')
      return cursor?.dataset.active === 'true' && cursor.dataset.mode === 'default'
        && getComputedStyle(cursor).backgroundColor === 'rgb(242, 242, 242)'
        && getComputedStyle(cursor).borderTopColor === 'rgb(242, 242, 242)'
    })
    await darkButton.hover()
    await page.waitForFunction(() => {
      const cursor = document.querySelector('.project-studio .projects-cursor')
      return cursor?.dataset.mode === 'interactive'
        && getComputedStyle(cursor).backgroundColor === 'rgba(0, 0, 0, 0)'
        && getComputedStyle(cursor).borderTopColor === 'rgb(242, 242, 242)'
    })
    await waitForArtworkFilter(page)
    assert.equal(await gallery.evaluate(element => getComputedStyle(element).filter), 'none',
      'Theme switching does not invert the gallery')
    assert.deepEqual(await readThemeIsolation(page), isolatedAppearance,
      'Dark mode leaves document styles, metadata and both storage areas unchanged')
    await lightButton.click()
    await assertTheme(page, 'light')
    await darkButton.focus()
    await page.keyboard.press('Enter')
    await assertTheme(page, 'dark')
    assert.ok(await darkButton.evaluate(button => button.matches(':focus-visible')
      && getComputedStyle(button).outlineStyle !== 'none' && parseFloat(getComputedStyle(button).outlineWidth) > 0),
    'Keyboard theme activation has a visible focus indicator')
    await lightButton.focus()
    await page.keyboard.press('Space')
    await assertTheme(page, 'light')
    await darkButton.click()
    await lightButton.click()
    await darkButton.click()
    await assertTheme(page, 'dark')
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
    await assertTheme(page, 'light')
    assert.deepEqual(await readThemeIsolation(page), isolatedAppearance)
    await darkButton.evaluate(button => button.blur())
    await page.mouse.move(1, 1)
    pass('The studio starts light despite dark system and saved preferences; mouse, keyboard and rapid changes fade locally, the cursor stays visible, and a simulated cache restore resets light')

    const firstGalleryBox = await gallery.boundingBox()
    await page.mouse.move(firstGalleryBox.x + 8, firstGalleryBox.y + firstGalleryBox.height / 2)
    await waitForGalleryPosition(page, 0)
    await waitForArtworkFilter(page, 0)
    assert.ok(await frames.first().evaluate(frame => frame.matches(':hover')))
    await page.mouse.move(1, 1)
    await waitForArtworkFilter(page)
    await gallery.focus()
    await page.keyboard.press('Tab')
    assert.ok(await frames.first().evaluate(frame => frame.matches(':focus-visible')))
    await waitForArtworkFilter(page, 0)
    await page.keyboard.press('Tab')
    assert.ok(await frames.nth(1).evaluate(frame => frame.matches(':focus-visible')))
    await waitForArtworkFilter(page, 1)
    await back.focus()
    await waitForArtworkFilter(page)
    await back.hover()
    const backStyle = await back.evaluate(link => ({
      gap: getComputedStyle(link).gap,
      decoration: getComputedStyle(link).textDecorationLine,
      childDecorations: [...link.children].map(child => getComputedStyle(child).textDecorationLine),
    }))
    assert.equal(backStyle.gap, '11px')
    assert.equal(backStyle.decoration, 'none')
    assert.ok(backStyle.childDecorations.every(decoration => decoration === 'none'))
    assert.equal(await back.locator('svg').count(), 1)
    assert.ok(await back.locator('svg').evaluate(svg => {
      const strokes = [...svg.querySelectorAll('path, line, polyline')]
      return strokes.length > 0 && strokes.every(stroke => getComputedStyle(stroke).strokeWidth === '1px')
    }), 'Back uses a thin line arrow')
    await back.evaluate(link => link.blur())
    await page.mouse.move(1, 1)
    pass('Only the hovered or keyboard-focused artwork gains color, leaving restores grayscale, and Back keeps an undecorated thin arrow with an 11px gap')

    for (const path of [studioPath.slice(0, -1), studioPath, `${studioPath}index.html`]) {
      const directResponse = await page.goto(url(path))
      assert.equal(directResponse.status(), 200)
      await waitForStudio(page)
      await assertTheme(page, 'light')
      await themeButton(page, 'dark').click()
      await assertTheme(page, 'dark')
      await page.reload()
      await waitForStudio(page)
      await assertTheme(page, 'light')
      assert.equal(await heading.count(), 1)
    }
    pass('The studio URL and index.html alias open in light mode and reset to light after refreshing a dark page')

    for (const [width, height] of [[320, 568], [390, 844], [768, 900], [1440, 900],
      [768, 600], [1440, 600], [667, 375], [390, 320]]) {
      await page.setViewportSize({ width, height })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${width}px: the document has no horizontal overflow`)
      assert.ok(await gallery.evaluate(element => element.scrollWidth > element.clientWidth
        && ['auto', 'scroll'].includes(getComputedStyle(element).overflowX)),
      `${width}px: the gallery retains native horizontal scrolling`)
      for (const element of [heading, gallery, back, page.locator('.studio-introduction'), themeGroup, lightButton, darkButton]) {
        const box = await element.boundingBox()
        assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1
          && box.y >= -1 && box.y + box.height <= height + 1,
        `${width}x${height}: studio content remains inside the viewport`)
      }
      const titleBox = await heading.boundingBox()
      const stripBox = await gallery.boundingBox()
      const themeBox = await themeGroup.boundingBox()
      assert.ok(titleBox.y + titleBox.height < stripBox.y,
        `${width}x${height}: the title stays above the gallery`)
      assert.ok(themeBox.y + themeBox.height <= stripBox.y + 1,
        `${width}x${height}: theme controls stay above the gallery`)
      assert.ok(themeBox.x >= titleBox.x + titleBox.width || themeBox.y >= titleBox.y + titleBox.height
        || themeBox.x + themeBox.width <= titleBox.x || themeBox.y + themeBox.height <= titleBox.y,
      `${width}x${height}: theme controls do not overlap the title`)
      await assertArtworkLayout(page)
    }
    pass('Narrow, desktop and short landscape layouts fit without title overlap and keep overflow inside the gallery')

    await page.setViewportSize({ width: 1440, height: 1000 })
    const galleryBox = await gallery.boundingBox()
    const pointerY = Math.max(1, Math.min(999, galleryBox.y + galleryBox.height / 2))
    await page.mouse.move(1440 * 0.2, pointerY)
    await waitForGalleryPosition(page, 0)
    const maximum = await gallery.evaluate(element => element.scrollWidth - element.clientWidth)
    const rightSamplesPromise = sampleGallery(page, 900)
    await page.mouse.move(1440 * 0.8, pointerY)
    const rightSamples = await rightSamplesPromise
    await waitForGalleryPosition(page, 1)
    assert.ok(rightSamples.some(sample => sample.left > 2 && sample.left < maximum - 2),
      'Pointer following has intermediate frames instead of jumping to the target')
    assert.ok(rightSamples.every((sample, index) => index === 0 || sample.left >= rightSamples[index - 1].left - 1),
      'The gallery approaches the right target without reversing')
    assertStableHeight(rightSamples)
    const stoppedSamples = await sampleGallery(page, 300)
    assert.ok(Math.max(...stoppedSamples.map(sample => sample.left)) - Math.min(...stoppedSamples.map(sample => sample.left)) < 1,
      'The gallery stops moving after reaching a stationary pointer')
    await page.mouse.move(1440 * 0.5, pointerY)
    await waitForGalleryPosition(page, 0.5)
    const middleTop = await gallery.locator('.studio-gallery-frame').first().evaluate(element => element.getBoundingClientRect().top)
    await page.mouse.move(1440 * 0.5, Math.max(1, pointerY - 100))
    const verticalSamples = await sampleGallery(page, 200)
    assertStableHeight(verticalSamples)
    assert.ok(verticalSamples.every(sample => Math.abs(sample.top - middleTop) < 1
      && Math.abs(sample.left - maximum * 0.5) < 2), 'Moving only vertically preserves the gallery position')
    const leftSamplesPromise = sampleGallery(page, 500)
    await page.mouse.move(1440 * 0.2, pointerY)
    const leftSamples = await leftSamplesPromise
    await waitForGalleryPosition(page, 0)
    assert.ok(leftSamples.some(sample => sample.left > 2 && sample.left < maximum * 0.5 - 2))
    assertStableHeight(leftSamples)
    pass('The pointer eases left and right across the complete gallery, maps the center correctly, settles and never moves frames vertically')

    const navigationPage = await createPage({ viewport: { width: 1440, height: 720 }, reducedMotion: 'reduce' })
    await navigationPage.goto(url('projects/'))
    await waitForArchive(navigationPage)
    const archiveAppearance = await readThemeIsolation(navigationPage)
    const entry = navigationPage.locator('.projects-archive > .archive-wordmark')
    assert.equal(await entry.getAttribute('href'), new URL(url(studioPath)).pathname)
    await entry.click()
    await navigationPage.waitForURL(url(studioPath))
    await waitForStudio(navigationPage)
    await assertTheme(navigationPage, 'light')
    await themeButton(navigationPage, 'dark').click()
    await assertTheme(navigationPage, 'dark')
    await navigationPage.getByRole('link', { name: 'Back to projects', exact: true }).click()
    await waitForArchive(navigationPage)
    assert.equal(await navigationPage.getByRole('group', { name: 'Color theme' }).count(), 0)
    assert.deepEqual(await readThemeIsolation(navigationPage), archiveAppearance,
      'Leaving a dark studio restores the archive without changing global appearance or storage')
    const filter = navigationPage.getByRole('group', { name: 'Filter projects' })
      .getByRole('button', { name: /^AI & ML(?:\s|$)/ })
    await filter.click()
    await waitForArchive(navigationPage, filteredProjects)
    await navigationPage.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    const position = await navigationPage.evaluate(() => scrollY)
    assert.ok(position > 0, 'The restoration check starts with a nonzero archive scroll position')
    // Keep the archive position intact when activating its fixed navigation link.
    await entry.evaluate(element => element.click())
    await waitForStudio(navigationPage)
    await assertTheme(navigationPage, 'light')
    await themeButton(navigationPage, 'dark').click()
    await assertTheme(navigationPage, 'dark')
    await navigationPage.goBack()
    await waitForArchive(navigationPage, filteredProjects)
    await navigationPage.waitForFunction(y => Math.abs(scrollY - y) < 8, position)
    assert.equal(await filter.getAttribute('aria-pressed'), 'true')
    await navigationPage.goForward()
    await waitForStudio(navigationPage)
    await assertTheme(navigationPage, 'light')
    await themeButton(navigationPage, 'dark').click()
    await assertTheme(navigationPage, 'dark')
    await navigationPage.reload()
    await waitForStudio(navigationPage)
    await assertTheme(navigationPage, 'light')
    const keyboardBack = navigationPage.getByRole('link', { name: 'Back to projects', exact: true })
    await keyboardBack.focus()
    await navigationPage.keyboard.press('Enter')
    await navigationPage.waitForURL(url('projects/'))
    await waitForArchive(navigationPage, filteredProjects)
    await navigationPage.waitForFunction(y => Math.abs(scrollY - y) < 8, position)
    assert.equal(await filter.getAttribute('aria-pressed'), 'true')
    pass('Studio re-entry, browser history and refresh reset the theme while Back restores the archive filter, scroll and unchanged global appearance')

    for (const mode of ['reduced motion', 'touch']) {
      const manualPage = await createPage(mode === 'touch'
        ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' }
        : { viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
      await manualPage.goto(url(studioPath))
      await waitForStudio(manualPage)
      await assertTheme(manualPage, 'light')
      if (mode === 'touch') await themeButton(manualPage, 'dark').tap()
      else await themeButton(manualPage, 'dark').click()
      await assertTheme(manualPage, 'dark')
      if (mode === 'reduced motion') {
        assert.ok(await manualPage.locator('.project-studio, .project-studio [role="group"] button')
          .evaluateAll(elements => elements.every(element => getComputedStyle(element).transitionDuration
            .split(',').every(duration => parseFloat(duration) === 0))),
        'Reduced motion disables theme transitions')
      }
      if (mode === 'touch') await themeButton(manualPage, 'light').tap()
      else await themeButton(manualPage, 'light').click()
      await assertTheme(manualPage, 'light')
      const manualGallery = manualPage.locator('.studio-gallery')
      if (mode === 'touch') {
        assert.ok(await manualPage.locator('.studio-gallery-frame img').evaluateAll(artwork => artwork.every(image =>
          ['none', 'grayscale(0)'].includes(getComputedStyle(image).filter))),
        'Touch devices display every artwork in color without requiring hover')
      } else {
        await waitForArtworkFilter(manualPage)
        const firstArtwork = manualPage.locator('.studio-gallery-frame').first()
        await firstArtwork.hover()
        await waitForArtworkFilter(manualPage, 0)
        assert.ok(await manualPage.locator('.studio-gallery-frame img').evaluateAll(artwork => artwork.every(image =>
          getComputedStyle(image).transitionDuration.split(',').every(duration => parseFloat(duration) === 0))),
        'Reduced motion restores color without a filter transition')
        await manualPage.mouse.move(1, 1)
        await waitForArtworkFilter(manualPage)
      }
      assert.ok(await manualGallery.evaluate(element => {
        const style = getComputedStyle(element)
        return ['auto', 'scroll'].includes(style.overflowX) && style.touchAction !== 'none'
      }), `${mode}: native scrolling remains enabled`)
      // A scroll is the browser's native outcome of a touch pan or trackpad gesture.
      await manualGallery.evaluate(element => element.scrollTo({ left: 120, behavior: 'instant' }))
      await manualPage.waitForFunction(() => document.querySelector('.studio-gallery').scrollLeft > 100)
      const manualPosition = await manualGallery.evaluate(element => element.scrollLeft)
      await manualPage.mouse.move(mode === 'touch' ? 380 : 1400, 400)
      if (mode === 'touch') {
        await manualGallery.dispatchEvent('pointermove', { pointerType: 'touch', clientX: 380, clientY: 400, bubbles: true })
      }
      const manualSamples = await sampleGallery(manualPage, 350)
      assert.ok(manualSamples.every(sample => Math.abs(sample.left - manualPosition) < 1),
        `${mode}: pointer movement does not override a manual scroll`)
      if (mode === 'reduced motion') {
        await manualGallery.focus()
        await manualPage.keyboard.press('ArrowRight')
        await manualPage.waitForFunction(previous => document.querySelector('.studio-gallery').scrollLeft > previous + 2, manualPosition)
      }
      assert.ok(await manualPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      pass(`${mode === 'touch' ? 'Touch displays all artworks in color and' : 'Reduced motion switches color without transitions and'} keeps manual horizontal scrolling without mouse following${mode === 'reduced motion' ? ', including keyboard scrolling' : ''}`)
    }

    assert.deepEqual(errors, [])
    pass('No uncaught browser errors during studio interactions')
    return checks
  } finally {
    await Promise.all(contexts.map(context => context.close()))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(
    () => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'),
  )
  const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runProjectStudioChecks(browser,
      process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/',
      name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} project studio checks passed`)
  } catch (error) {
    console.error('Project studio browser checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
