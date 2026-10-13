import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { learningNotes } from '../src/data/notes.ts'
import { learningPhotos, noteCovers } from '../src/data/note-covers.ts'

export async function runLearningChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => sessionStorage.setItem('site-live2d-collapsed-desktop', 'true'))
  const page = await context.newPage()
  const errors = []
  const remoteCovers = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().startsWith('https://images.unsplash.com/')) remoteCovers.push(request.url()) })
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const url = new URL('learning/', baseURL).href
  const gallery = page.locator('#notes')
  const cards = page.locator('.note-cover')
  const position = () => page.evaluate(() => {
    const section = document.querySelector('#notes')
    const track = section.querySelector('.notes-track')
    return {
      y: scrollY,
      x: new DOMMatrixReadOnly(getComputedStyle(track).transform).m41,
      top: section.querySelector('.notes-sticky').getBoundingClientRect().top,
      start: section.getBoundingClientRect().top + scrollY - 80,
      travel: Number.parseFloat(section.style.getPropertyValue('--notes-travel')),
    }
  })
  const jump = async fraction => {
    const current = await position()
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), current.start + current.travel * fraction)
    await page.waitForFunction(() => {
      const section = document.querySelector('#notes')
      const start = section.getBoundingClientRect().top + scrollY - 80
      const x = new DOMMatrixReadOnly(getComputedStyle(section.querySelector('.notes-track')).transform).m41
      return Math.abs(x + scrollY - start) < 2
    })
  }
  try {
    const loadingContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    let releasePhoto
    let releaseTrees
    try {
      const loadingPage = await loadingContext.newPage()
      const photoGate = new Promise(resolve => { releasePhoto = resolve })
      const treeGate = new Promise(resolve => { releaseTrees = resolve })
      const photoRoute = '**/images/learning/hero-campus-sketch.webp'
      const treeRoute = '**/images/learning/hero-campus-trees.webp'
      await loadingPage.route(photoRoute, async route => {
        await photoGate
        await route.continue()
      })
      await loadingPage.route(treeRoute, async route => {
        await treeGate
        await route.continue()
      })
      await loadingPage.goto(url, { waitUntil: 'domcontentloaded' })
      await loadingPage.waitForFunction(() => document.querySelector('.learning-cover-outline')?.tagName.toLowerCase() === 'svg')
      const waiting = await loadingPage.locator('.learning-cover-image').evaluate(element => ({
        ready: element.dataset.ready,
        animations: element.querySelector('.learning-cover-photo-reveal').getAnimations().length,
        photoLoaded: element.querySelector('.learning-cover-photo-reveal img').naturalWidth > 0,
      }))
      assert.equal(waiting.ready, 'false')
      assert.equal(waiting.animations, 0)
      assert.equal(waiting.photoLoaded, false)
      releasePhoto()
      await loadingPage.waitForFunction(() => document.querySelector('.learning-cover-photo-reveal img').naturalWidth > 0)
      assert.equal(await loadingPage.locator('.learning-cover-image').getAttribute('data-ready'), 'false', 'The cover still waits while its separate tree layer is loading')
      assert.equal(await loadingPage.locator('.learning-cover-photo-reveal').evaluate(element => element.getAnimations().length), 0)
      releaseTrees()
      await loadingPage.waitForFunction(() => document.querySelector('.learning-cover-image').dataset.ready === 'true')
      assert.ok(await loadingPage.locator('.learning-cover-photo-reveal').evaluate(element => element.getAnimations().some(animation => animation.animationName === 'learning-cover-reveal')))
      await loadingPage.unroute(photoRoute)
      await loadingPage.unroute(treeRoute)
      await loadingPage.reload()
      await loadingPage.waitForFunction(() => document.querySelector('.learning-cover-image').dataset.ready === 'true')
      assert.ok(await loadingPage.locator('.learning-cover-image img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)))
      assert.ok(await loadingPage.locator('.learning-cover-photo-reveal').evaluate(element => element.getAnimations().some(animation => animation.animationName === 'learning-cover-reveal')))
      pass('The inline structural drawing waits for both architecture and tree images before animating and reloads correctly with caching enabled')
      const hintCover = await loadingPage.locator('.learning-cover-image').boundingBox()
      await loadingPage.mouse.move(hintCover.x + 240, hintCover.y + 160)
      await loadingPage.waitForFunction(() => document.querySelector('.learning-cover-image').dataset.hintVisible === 'true')
      await loadingPage.waitForFunction(() => {
        const hint = getComputedStyle(document.querySelector('.learning-cover-drag-hint'))
        return hint.display !== 'none' && hint.visibility !== 'hidden' && Number(hint.opacity) > 0.99
      })
      await loadingPage.waitForFunction(() => document.querySelector('.learning-cover-image').dataset.hintVisible !== 'true', undefined, { timeout: 4500 })
      await loadingPage.waitForFunction(() => {
        const hint = getComputedStyle(document.querySelector('.learning-cover-drag-hint'))
        return hint.display === 'none' || hint.visibility === 'hidden' || Number(hint.opacity) < 0.01
      })
      pass('The first-hover drag hint appears briefly and expires automatically while the pointer remains over the cover')
    } finally {
      releasePhoto?.()
      releaseTrees?.()
      await loadingContext.close()
    }

    const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    try {
      const reducedPage = await reducedContext.newPage()
      await reducedPage.goto(url)
      await reducedPage.waitForFunction(() => document.querySelector('.learning-cover-image')?.dataset.ready === 'true')
      assert.equal(await reducedPage.locator('.learning-cover-image').getAttribute('data-static'), 'true')
      assert.ok(await reducedPage.locator('.learning-cover-photo-reveal').evaluate(element => getComputedStyle(element).clipPath === 'none' && element.getAnimations().length === 0))
      assert.equal(await reducedPage.locator('.learning-cover-image').evaluate(element => element.getAnimations({ subtree: true }).length), 0, 'Reduced motion disables the complete drawing, loading, scan, and guide sequence')
      assert.ok(await reducedPage.locator('.learning-cover-render').evaluate(element => {
        const transform = getComputedStyle(element).transform
        return transform !== 'none' && Math.abs(new DOMMatrixReadOnly(transform).m11 - 0.9) < 0.01
      }), 'Reduced motion preserves the fixed architectural scale')
      assert.ok(await reducedPage.locator('.learning-ink-character').evaluateAll(lines => lines.every(line => Number(getComputedStyle(line).opacity) === 1)))
      assert.ok(await reducedPage.locator('.learning-cover-trees, .learning-ink-trees').evaluateAll(layers => layers.length === 2 && layers.every(layer => Number(getComputedStyle(layer).opacity) === 1)))
      pass('Entering with reduced motion already enabled immediately shows the complete cover and readable narrative')
    } finally {
      await reducedContext.close()
    }

    await page.goto(url)
    await page.waitForFunction(() => document.querySelector('#notes')?.dataset.pinned === 'true')
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1)
    assert.equal(await cards.count(), learningNotes.length)
    const story = page.locator('.learning-hero-story')
    const heroImages = page.locator('img.learning-cover-panorama, img.learning-ink-outline, img.learning-ink-texture')
    assert.equal(await heroImages.count(), 3)
    await page.waitForFunction(() => [...document.querySelectorAll('.learning-cover-image img, .learning-ink-art img')].every(image => image.complete && image.naturalWidth > 0))
    assert.ok(await heroImages.evaluateAll(images => images.every(image => {
      const source = new URL(image.currentSrc)
      return source.origin === location.origin && /\/images\/learning\/hero-(campus|tower)-(outline\.svg|sketch\.webp)$/.test(source.pathname)
    })))
    assert.equal(await heroImages.evaluateAll(images => new Set(images.map(image => new URL(image.currentSrc).pathname)).size), 3)
    assert.equal(await page.locator('svg.learning-cover-outline').count(), 1)
    assert.ok(await page.locator('.learning-cover-stroke').evaluateAll(paths => paths.length > 20 && paths.every(path => path.getAttribute('pathLength') === '1' && getComputedStyle(path).fill === 'none')), 'The cover has individual unfilled, normalized structural strokes')
    assert.ok(await page.locator('.learning-cover-photo-reveal img.learning-cover-panorama').evaluate(image => image.naturalWidth > image.naturalHeight), 'The cover uses a landscape campus illustration')
    assert.ok(await page.locator('.learning-ink-texture').evaluate(image => image.naturalHeight > image.naturalWidth), 'The scrolling scene uses a distinct portrait tower illustration')
    assert.equal(await page.locator('.learning-ink-reveal > .learning-ink-composition > .learning-ink-sun').count(), 1, 'The sun develops within the same reveal as the tower')
    assert.equal(await page.locator('.learning-ink-reveal > .learning-ink-composition > .learning-ink-trees').count(), 1, 'The original trees share the tower and sun reveal mask and counter-transform')
    assert.ok(await page.locator('.learning-ink-trees').evaluate(element => element.childElementCount === 1 && element.firstElementChild.matches('img.learning-ink-landscape')), 'The tree artwork remains a single original image without added outline strokes')
    assert.ok(await page.locator('.learning-ink-reveal').evaluate(element => {
      const mask = getComputedStyle(element).maskImage
      return mask.includes('hero-ink-edge-atlas.png')
    }), 'The tower reveal uses the scroll-driven ink atlas')
    const heroTrees = page.locator('.learning-cover-trees > img, .learning-ink-trees > img')
    assert.equal(await heroTrees.count(), 2, 'Each architectural scene has its own aligned landscape tree layer')
    assert.ok(await heroTrees.evaluateAll(images => images.every(image => {
      const source = new URL(image.currentSrc)
      return source.origin === location.origin && /\/images\/learning\/hero-(campus|tower)-trees\.webp$/.test(source.pathname) && image.complete && image.naturalWidth > 0
    })))
    assert.equal(await page.locator('#skills img, #timeline img').count(), 0)
    pass('Distinct landscape and portrait artwork load locally; the original trees and sun share the tower reveal without new tree outlines')

    const cover = page.locator('.learning-cover-image')
    await page.waitForFunction(() => document.querySelector('.learning-cover-image').dataset.ready === 'true')
    const entrance = await cover.evaluate(async element => {
      const photo = element.querySelector('.learning-cover-photo-reveal')
      const render = element.querySelector('.learning-cover-render')
      const trees = element.querySelector('.learning-cover-trees')
      const strokes = [...element.querySelectorAll('.learning-cover-stroke')]
      const animations = element.getAnimations({ subtree: true })
      const reveal = photo.getAnimations().find(animation => animation.animationName === 'learning-cover-reveal')
      if (!reveal) return null
      for (const animation of animations) animation.pause()
      const { delay, duration } = reveal.effect.getTiming()
      const sample = async time => {
        for (const animation of animations) animation.currentTime = time
        await new Promise(resolve => requestAnimationFrame(resolve))
        const clip = getComputedStyle(photo).clipPath
        const values = clip.match(/[-+]?\d*\.?\d+/g)?.map(Number) || []
        const scaleOf = node => {
          const transform = getComputedStyle(node).transform
          return transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).m11
        }
        return {
          top: values[0],
          bottom: values[2] ?? values[0],
          sweepTop: element.querySelector('.learning-cover-sweep-top').getBoundingClientRect().top,
          sweepBottom: element.querySelector('.learning-cover-sweep-bottom').getBoundingClientRect().top,
          trees: Number(getComputedStyle(trees).opacity),
          strokes: strokes.map(path => Number.parseFloat(getComputedStyle(path).strokeDashoffset)),
          renderScale: scaleOf(render),
          renderAnimations: render.getAnimations().length,
          loadingScale: scaleOf(element.querySelector('.learning-cover-loading-track')),
          loadingPercent: Number(getComputedStyle(element.querySelector('.learning-cover-loading-percent')).getPropertyValue('--learning-opening-progress')),
          renderedPercent: getComputedStyle(element.querySelector('.learning-cover-loading-percent'), '::before').counterReset,
          rulers: Number(getComputedStyle(element.querySelector('.learning-cover-rulers')).opacity),
          drafting: Number(getComputedStyle(element.querySelector('.learning-cover-drafting')).opacity),
        }
      }
      const first = await sample(600)
      const drawing = await sample(2500)
      const drawn = await sample(5200)
      const start = await sample(5760)
      const middle = await sample(6120)
      const end = await sample(6480)
      const settled = await sample(8000)
      return { first, drawing, drawn, start, middle, end, settled, delay, duration, y: scrollY, sharedReveal: photo.contains(trees) && render.contains(trees), strokeCount: strokes.length }
    })
    assert.ok(entrance, 'The loaded cover has a staged drawing and center-out reveal animation')
    assert.equal(entrance.delay, 5760)
    assert.equal(entrance.duration, 720)
    const visibleStrokeCount = sample => sample.strokes.filter(offset => offset < 0.99).length
    assert.ok(visibleStrokeCount(entrance.first) > 0 && visibleStrokeCount(entrance.first) < visibleStrokeCount(entrance.drawing), 'Early structural strokes begin before the middle of the drawing sequence')
    assert.ok(visibleStrokeCount(entrance.drawing) < visibleStrokeCount(entrance.drawn), 'Additional structural strokes continue appearing until the drawing completes')
    assert.equal(visibleStrokeCount(entrance.drawn), entrance.strokeCount)
    assert.ok(entrance.drawn.strokes.every(offset => Math.abs(offset) < 0.01), 'All normalized paths finish drawing before the image is revealed')
    for (const stage of [entrance.first, entrance.drawing, entrance.drawn]) {
      assert.ok(Math.abs(stage.top + stage.bottom - 100) < 0.1, 'The finished image and its trees remain clipped throughout the structural drawing')
      assert.ok(stage.rulers < 0.01 && stage.drafting < 0.01, 'Drafting decorations wait until the opening reveal finishes')
    }
    assert.ok(entrance.first.loadingScale < entrance.drawing.loadingScale && entrance.drawing.loadingScale < entrance.drawn.loadingScale)
    assert.ok(Math.abs(entrance.drawn.loadingScale - 1) < 0.01, 'The orange loading line completes before the finished image opens')
    assert.ok(entrance.first.loadingPercent > 0 && entrance.first.loadingPercent < entrance.drawing.loadingPercent && entrance.drawing.loadingPercent < entrance.drawn.loadingPercent, 'The percentage advances with the structural drawing')
    assert.equal(entrance.drawn.loadingPercent, 100)
    assert.ok(/opening-progress\s+100\b/.test(entrance.drawn.renderedPercent), 'The generated percentage receives the animated counter value')
    assert.ok(Math.abs(entrance.start.top - 56) < 0.1 && Math.abs(entrance.start.bottom - 44) < 0.1)
    assert.ok(entrance.middle.top > 0 && entrance.middle.top < 56 && entrance.middle.bottom > 0 && entrance.middle.bottom < 44)
    assert.ok(Math.abs(entrance.middle.top / 56 - entrance.middle.bottom / 44) < 0.01, 'Both edges open together from the reference baseline')
    assert.ok(Math.abs(entrance.end.top) < 0.1 && Math.abs(entrance.end.bottom) < 0.1)
    assert.ok(entrance.middle.sweepTop < entrance.start.sweepTop && entrance.middle.sweepBottom > entrance.start.sweepBottom, 'The two orange scan lines move apart with the reveal')
    assert.equal(entrance.y, 0, 'The opening reveal does not require scrolling')
    assert.ok(entrance.sharedReveal && [entrance.first, entrance.middle, entrance.settled].every(stage => stage.trees > 0.99), 'The original trees share the architecture clipping window without a separate fade')
    assert.ok([entrance.first, entrance.drawing, entrance.drawn, entrance.start, entrance.middle, entrance.end, entrance.settled].every(stage => Math.abs(stage.renderScale - 0.9) < 0.01 && stage.renderAnimations === 0), 'The illustration keeps its fixed scale before, during, and after revealing without a scale animation')
    assert.ok(entrance.settled.rulers > 0.5 && entrance.settled.drafting > 0.99, 'The completed image finishes with the surrounding drafting guides visible')
    pass('The cover draws individual structural lines with a loading indicator, scans open with its original trees at a fixed scale, then shows the complete drafting canvas without scrolling')

    const coverBox = await cover.boundingBox()
    const coordinateValues = () => page.locator('.learning-cover-reticle > span').evaluate(element => {
      const values = element.textContent.match(/X:\s*(\d+)\s*PX\s*Y:\s*(\d+)\s*PX/i)
      return values ? { x: Number(values[1]), y: Number(values[2]) } : null
    })
    const waitForGuides = async active => page.waitForFunction(expected => ['left', 'right', 'top', 'bottom'].every(side => {
      const group = document.querySelector(`.learning-cover-guide-${side}`)
      if (!group) return false
      const opacity = Number(getComputedStyle(group).opacity)
      return expected.includes(side) ? opacity > 0.99 : opacity < 0.01
    }), active)
    await page.mouse.move(coverBox.x + 213, coverBox.y + 147)
    await page.waitForFunction(() => document.querySelector('.learning-cover-image').dataset.pointer === 'true')
    const firstCoordinates = await coordinateValues()
    assert.ok(firstCoordinates && Math.abs(firstCoordinates.x - 213) <= 1 && Math.abs(firstCoordinates.y - 147) <= 1, 'Coordinates report CSS pixels from the cover origin')
    assert.ok(await page.locator('.learning-cover-reticle').evaluate(element => getComputedStyle(element).display !== 'none' && Number(getComputedStyle(element).opacity) > 0.99))
    assert.equal(await page.locator('.learning-cover-selection').evaluate(element => getComputedStyle(element).display), 'none', 'Hover alone shows no selection rectangle')
    assert.equal(await cover.getAttribute('data-hint-visible'), 'true')
    await waitForGuides(['left', 'top'])
    await page.mouse.move(coverBox.x + 426, coverBox.y + 254)
    const nextCoordinates = await coordinateValues()
    assert.ok(nextCoordinates && Math.abs(nextCoordinates.x - 426) <= 1 && Math.abs(nextCoordinates.y - 254) <= 1)
    assert.notDeepEqual(nextCoordinates, firstCoordinates)
    await page.mouse.move(coverBox.x + coverBox.width - 213, coverBox.y + coverBox.height - 147)
    await waitForGuides(['right', 'bottom'])
    assert.equal(await page.locator('.learning-cover-selection').evaluate(element => getComputedStyle(element).display), 'none', 'Measurement guides respond to hover without starting a selection')
    const assertDrag = async (start, end) => {
      await page.mouse.move(coverBox.x + start[0], coverBox.y + start[1])
      await page.mouse.down({ button: 'left' })
      assert.notEqual(await cover.getAttribute('data-hint-visible'), 'true', 'Starting a drag immediately dismisses the hint')
      await page.mouse.move(coverBox.x + end[0], coverBox.y + end[1], { steps: 4 })
      const selection = await page.locator('.learning-cover-selection').boundingBox()
      const target = [Math.max(0, Math.min(coverBox.width, end[0])), Math.max(0, Math.min(coverBox.height, end[1]))]
      assert.ok(selection && selection.width > 0 && selection.height > 0, 'Holding the left button shows the selection')
      assert.ok(Math.abs(selection.x - coverBox.x - Math.min(start[0], target[0])) <= 2 && Math.abs(selection.y - coverBox.y - Math.min(start[1], target[1])) <= 2, 'The selection starts at the smaller drag coordinates')
      assert.ok(Math.abs(selection.width - Math.abs(target[0] - start[0])) <= 2 && Math.abs(selection.height - Math.abs(target[1] - start[1])) <= 2, 'The selection size follows the actual drag distance')
      assert.ok(selection.x >= coverBox.x - 1 && selection.y >= coverBox.y - 1 && selection.x + selection.width <= coverBox.x + coverBox.width + 1 && selection.y + selection.height <= coverBox.y + coverBox.height + 1, 'Captured drags remain within the cover bounds')
      assert.ok(await page.locator('.learning-cover-reticle').evaluate(element => Number(getComputedStyle(element).opacity) > 0.99), 'The drag stays visible when pointer capture carries it outside the cover')
      assert.ok(await page.locator('.learning-cover-selection').evaluate(element => getComputedStyle(element).backgroundImage.includes('gradient')), 'The selection uses a translucent gradient')
      await page.mouse.up({ button: 'left' })
      assert.equal(await page.locator('.learning-cover-selection').evaluate(element => getComputedStyle(element).display), 'none', 'Releasing the button immediately hides the selection')
    }
    for (const target of [[550, 350], [180, 350], [550, 110], [180, 110]]) await assertDrag([350, 230], target)
    for (const target of [[-20, 180], [coverBox.width + 20, 180], [300, -20], [300, coverBox.height + 20]]) await assertDrag([350, 230], target)
    for (const [x, y] of [[2, 2], [coverBox.width - 2, 2], [2, coverBox.height - 2], [coverBox.width - 2, coverBox.height - 2]]) {
      await page.mouse.move(coverBox.x + x, coverBox.y + y)
      const coordinateBox = await page.locator('.learning-cover-reticle > span').boundingBox()
      assert.ok(coordinateBox.x >= coverBox.x && coordinateBox.y >= coverBox.y && coordinateBox.x + coordinateBox.width <= coverBox.x + coverBox.width && coordinateBox.y + coordinateBox.height <= coverBox.y + coverBox.height, 'Coordinates remain inside the cover at every edge')
      assert.equal(await page.locator('.learning-cover-selection').evaluate(element => getComputedStyle(element).display), 'none')
    }
    await page.mouse.move(2, 2)
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.learning-cover-reticle')).opacity) < 0.01)
    assert.notEqual(await cover.getAttribute('data-pointer'), 'true')
    await waitForGuides([])
    pass('Hovering opposite quadrants switches the measurement guides while keeping opposite sides hidden; leaving clears all guides')
    assert.notEqual(await cover.getAttribute('data-hint-visible'), 'true')
    await page.mouse.move(coverBox.x + 300, coverBox.y + 180)
    assert.notEqual(await cover.getAttribute('data-hint-visible'), 'true', 'The dismissed hint does not return on re-entry')
    await page.mouse.move(2, 2)
    pass('Hover shows only coordinates; left-button drags draw exact rectangles in all directions, clamp captured pointers to the canvas, and clear on release')

    await page.setViewportSize({ width: 1920, height: 1080 })
    const widths = await page.evaluate(() => ({
      cover: document.querySelector('.learning-cover').getBoundingClientRect().width,
      skills: document.querySelector('#skills .site-container').getBoundingClientRect().width,
      nav: document.querySelector('.nav-content').getBoundingClientRect().width,
      footer: document.querySelector('.footer-content').getBoundingClientRect().width,
      viewport: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }))
    assert.ok(widths.cover >= widths.viewport - 2)
    assert.ok(widths.skills > widths.footer + 150)
    assert.ok(widths.nav < widths.viewport - 150 && widths.footer < widths.viewport - 150)
    assert.ok(Math.abs(widths.nav - widths.footer) < 2, 'Global navigation and footer keep the shared site width')
    assert.equal(widths.overflow, false)
    assert.equal(await page.locator('.learning-art-credit, .note-reader-end a').count(), 0)
    pass('Learning uses the wide canvas without changing the global navigation or footer width or showing image source credits')
    await page.setViewportSize({ width: 1440, height: 900 })

    const heroRange = await story.evaluate(element => {
      const copy = element.querySelector('.learning-hero-narrative').getBoundingClientRect()
      const art = element.querySelector('.learning-ink-art').getBoundingClientRect()
      return {
        start: copy.top + scrollY - innerHeight * 0.82,
        travel: copy.height * 0.5 + innerHeight * 0.22,
        artStart: art.top + scrollY - innerHeight * 0.65,
        end: art.bottom + scrollY - innerHeight * 0.55,
      }
    })
    const heroState = () => story.evaluate(element => ({
      mask: getComputedStyle(element.querySelector('.learning-ink-reveal')).maskImage,
      maskPosition: getComputedStyle(element.querySelector('.learning-ink-reveal')).maskPosition,
      frame: Number(getComputedStyle(element.querySelector('.learning-ink-reveal')).getPropertyValue('--ink-frame')),
      inkAnimations: element.querySelector('.learning-ink-reveal').getAnimations().length,
      transform: getComputedStyle(element.querySelector('.learning-ink-reveal')).transform,
      imageTop: element.querySelector('.learning-ink-texture').getBoundingClientRect().top - element.querySelector('.learning-ink-art').getBoundingClientRect().top,
      trees: Number(getComputedStyle(element.querySelector('.learning-ink-trees')).opacity),
      treeAnimations: element.querySelector('.learning-ink-trees').getAnimations({ subtree: true }).length,
      treeOffset: ['top', 'left', 'width', 'height'].map(key => element.querySelector('.learning-ink-landscape').getBoundingClientRect()[key] - element.querySelector('.learning-ink-texture').getBoundingClientRect()[key]),
      characters: [...element.querySelectorAll('.learning-ink-character')].map(character => Number(getComputedStyle(character).opacity)),
      top: element.getBoundingClientRect().top,
      y: scrollY,
    }))
    const assertNormalHeroFlow = (before, after) => {
      assert.ok(Math.abs(after.top - before.top + after.y - before.y) < 3, 'The hero moves with the document instead of remaining pinned')
    }
    const assertSharedTreeReveal = sample => {
      assert.equal(sample.trees, 1, 'The original tree image has constant opacity and develops through the shared mask')
      assert.equal(sample.treeAnimations, 0, 'The tree layer has no independent entrance animation')
      assert.ok(sample.treeOffset.every(offset => Math.abs(offset) < 0.1), 'The original tree image stays aligned to the complete tower composition')
    }
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), heroRange.artStart)
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.learning-ink-reveal')).getPropertyValue('--ink-frame')) === 0)
    assert.equal((await heroState()).inkAnimations, 0, 'The ink edge has no independent time-based animation')
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), heroRange.start + heroRange.travel * 0.02)
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.learning-ink-character')).opacity) < 0.25)
    const sketch = await heroState()
    await page.mouse.move(900, 400)
    await page.mouse.wheel(0, Math.round(heroRange.travel * 0.75))
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.learning-ink-character')).opacity) > 0.99)
    const developing = await heroState()
    assert.ok(developing.y > sketch.y + heroRange.travel * 0.7)
    assertNormalHeroFlow(sketch, developing)
    assert.notEqual(developing.transform, sketch.transform)
    assert.equal(developing.mask, sketch.mask)
    assert.ok(Math.abs(developing.imageTop - sketch.imageTop) < 2, 'The reveal edge moves while the architectural image remains aligned with its outline')
    assertSharedTreeReveal(sketch)
    assertSharedTreeReveal(developing)
    assert.ok(developing.characters[0] > developing.characters.at(-1) + 0.5, 'Earlier characters become readable before later characters')
    assert.ok(developing.characters.every((opacity, index, characters) => index === 0 || opacity <= characters[index - 1]))
    const erosionBefore = await heroState()
    await page.waitForTimeout(350)
    const erosionAfter = await heroState()
    assertSharedTreeReveal(erosionAfter)
    assert.equal(erosionAfter.frame, erosionBefore.frame, 'The erosion frame stays fixed when scrolling stops')
    assert.equal(erosionAfter.maskPosition, erosionBefore.maskPosition, 'The visible ink boundary remains still without scroll input')
    assert.ok(Math.abs(erosionAfter.y - erosionBefore.y) < 1 && Math.abs(erosionAfter.imageTop - erosionBefore.imageTop) < 1, 'The architectural image and document remain still with the erosion edge')
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), erosionBefore.y + (heroRange.end - heroRange.artStart) * 0.05)
    await page.waitForFunction(frame => Number(getComputedStyle(document.querySelector('.learning-ink-reveal')).getPropertyValue('--ink-frame')) !== frame, erosionBefore.frame)
    const erosionMoved = await heroState()
    assertSharedTreeReveal(erosionMoved)
    assert.notEqual(erosionMoved.maskPosition, erosionBefore.maskPosition, 'Advancing the reveal changes the erosion shape')
    assert.ok(Math.abs(erosionMoved.imageTop - erosionBefore.imageTop) < 2, 'Changing the erosion phase preserves architectural alignment')
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), erosionBefore.y)
    await page.waitForFunction(frame => Number(getComputedStyle(document.querySelector('.learning-ink-reveal')).getPropertyValue('--ink-frame')) === frame, erosionBefore.frame)
    const erosionReturned = await heroState()
    assertSharedTreeReveal(erosionReturned)
    assert.equal(erosionReturned.maskPosition, erosionBefore.maskPosition, 'Returning to the same scroll position restores the exact erosion shape')
    assert.ok(Math.abs(erosionReturned.y - erosionBefore.y) < 1)
    await page.mouse.wheel(0, Math.ceil(heroRange.end - developing.y))
    await page.waitForFunction(() => [...document.querySelectorAll('.learning-ink-character')].every(line => Number(getComputedStyle(line).opacity) > 0.99))
    const developed = await heroState()
    assertNormalHeroFlow(developing, developed)
    assert.notEqual(developed.transform, developing.transform)
    assert.ok(Math.abs(developed.imageTop - sketch.imageTop) < 2)
    assertSharedTreeReveal(developed)
    assert.equal(developed.inkAnimations, 0, 'The completed scene has no looping erosion animation')
    await page.mouse.wheel(0, Math.round(heroRange.start + heroRange.travel * 0.06 - developed.y))
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.learning-ink-character')).opacity) < 0.4)
    const reversed = await heroState()
    assertNormalHeroFlow(developed, reversed)
    assert.notEqual(reversed.transform, developed.transform)
    assertSharedTreeReveal(reversed)
    assert.ok(reversed.characters.at(-1) < 0.25)
    pass('Natural scrolling develops and reverses the tower, sun, and original trees through one mask; all artwork stays aligned and the erosion edge restores exactly when scrolling back')

    await jump(0)
    const before = await position()
    await page.mouse.move(700, 400)
    await page.mouse.wheel(0, 400)
    await page.waitForFunction(y => scrollY > y + 350, before.y)
    const after = await position()
    assert.ok(after.x < before.x - 350)
    assert.ok(Math.abs(after.top - before.top) < 2)
    await page.mouse.wheel(0, -220)
    await page.waitForFunction(y => scrollY < y - 180, after.y)
    assert.ok((await position()).x > after.x + 180)
    pass('Native wheel scrolling moves cards horizontally in both directions while the heading stays pinned')

    await jump(1)
    const last = await cards.last().boundingBox()
    assert.ok(last.x > 0 && last.x + last.width <= 1441)
    assert.ok(await page.getByRole('button', { name: '下一篇笔记' }).isDisabled())
    const end = await position()
    await page.mouse.wheel(0, 320)
    await page.waitForFunction(y => scrollY > y + 200, end.y)
    assert.ok((await position()).top < 0)
    pass('The final card stays fully visible and scrolling continues into the stage plan')

    await jump(0)
    await page.getByRole('button', { name: '下一篇笔记' }).click()
    await page.waitForFunction(() => document.querySelector('.notes-page-number').textContent.startsWith('02'))
    await jump(0)
    await page.getByLabel('难度', { exact: true }).focus()
    for (let i = 0; i < learningNotes.length; i++) {
      await page.keyboard.press('Tab')
      assert.equal(await cards.nth(i).evaluate(element => element === document.activeElement), true)
      await page.waitForFunction(index => {
        const box = document.querySelectorAll('.note-cover')[index].getBoundingClientRect()
        return box.left >= -1 && box.right <= innerWidth + 1
      }, i)
      const box = await cards.nth(i).boundingBox()
      assert.ok(box.x >= -1 && box.x + box.width <= 1441, `Keyboard focus reveals note ${i + 1}: x=${box.x}, width=${box.width}`)
      await page.keyboard.press('Enter')
      await page.getByRole('dialog').waitFor()
      const note = learningNotes[i]
      const photo = learningPhotos[noteCovers[note.id].photo]
      assert.ok((await cards.nth(i).locator('img').getAttribute('src')).endsWith(`/images/learning/${photo.file}`))
      await page.waitForFunction(index => document.querySelectorAll('.note-cover-photo')[index].naturalWidth > 0, i)
      assert.equal(await page.locator('#note-reader-title').innerText(), note.title)
      for (const copy of [note.question, note.understanding, note.practice]) assert.ok((await page.getByRole('dialog').innerText()).includes(copy))
      for (const copy of [...note.keyPoints, ...note.pitfalls, note.example.explanation]) assert.ok((await page.getByRole('dialog').innerText()).includes(copy))
      if (note.example.code) assert.equal(await page.getByRole('dialog').locator('pre code').innerText(), note.example.code)
      assert.equal(await page.locator('.note-reader-sections a').getAttribute('href'), note.reference.href)
      assert.equal(await page.locator('.note-reader-end a').count(), 0)
      assert.equal(await page.locator('.note-reader-review').getAttribute('open'), null)
      await page.getByRole('dialog').locator('summary').click()
      assert.ok((await page.getByRole('dialog').innerText()).includes(note.review.answer))
      await page.keyboard.press('Shift+Tab')
      assert.equal(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true)
      const readingY = await page.evaluate(() => scrollY)
      await page.mouse.wheel(0, 150)
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('dialog').count(), 0)
      assert.equal(await cards.nth(i).evaluate(element => element === document.activeElement), true)
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - readingY) < 2)
    }
    assert.deepEqual(remoteCovers, [])
    pass('All local covers and expanded notes load; examples, self-assessment, knowledge references, focus, Escape, and reading position work')

    await page.getByLabel('主题', { exact: true }).selectOption('数据库')
    assert.equal(await cards.count(), learningNotes.filter(note => note.topic === '数据库').length)
    await page.getByLabel('进度', { exact: true }).selectOption('已实践')
    await page.waitForFunction(() => document.querySelector('#notes').dataset.pinned === 'false')
    assert.equal(await cards.count(), 1)
    assert.ok(await page.getByRole('button', { name: '下一篇笔记' }).isDisabled())
    await page.getByLabel('难度', { exact: true }).selectOption('进阶')
    await page.locator('.notes-empty').waitFor()
    assert.equal(await cards.count(), 0)
    await page.getByRole('button', { name: '查看全部笔记' }).click()
    await page.waitForFunction(() => document.querySelector('#notes').dataset.pinned === 'true')
    assert.equal(await cards.count(), learningNotes.length)
    await page.getByLabel('进度', { exact: true }).selectOption('正在整理')
    assert.equal(await cards.count(), learningNotes.filter(note => note.progress === '正在整理').length)
    await page.getByLabel('进度', { exact: true }).selectOption('全部进度')
    pass('Combined filters, one-card and empty states, and reset retain all notes without unnecessary pinned space')

    for (const height of [620, 768, 1000]) {
      await page.setViewportSize({ width: 1100, height })
      await jump(0)
      const footer = await page.locator('.notes-gallery-footer').boundingBox()
      assert.ok(footer.y + footer.height <= height + 1, `Controls fit a ${height}px viewport`)
      assert.ok((await page.locator('.note-cover-photo').first().boundingBox()).height > 60)
      assert.ok(await cards.first().evaluate(card => {
        const copy = card.querySelector('.note-cover-copy').getBoundingClientRect()
        const bounds = card.getBoundingClientRect()
        return copy.top >= bounds.top && copy.bottom <= bounds.bottom
      }), 'The complete cover text fits within short cards')
    }
    for (const theme of ['dark', 'light']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      assert.ok(await cards.first().isVisible())
    }
    pass('Gallery art and controls fit short and tall screens in both themes without horizontal page overflow')

    const animatedHeroHeight = await story.evaluate(element => element.getBoundingClientRect().height)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => document.querySelector('#notes').dataset.pinned === 'false')
    assert.equal(await page.locator('.notes-track').evaluate(element => element.style.transform), '')
    assert.equal(await page.locator('.note-cover-photo').first().evaluate(image => getComputedStyle(image).animationName), 'none')
    await page.waitForFunction(() => document.querySelector('.learning-hero-story').dataset.static === 'true')
    await page.waitForFunction(() => document.querySelector('.learning-cover-image').dataset.static === 'true')
    assert.ok(await cover.evaluate(element => {
      const reveal = element.querySelector('.learning-cover-photo-reveal')
      const clip = getComputedStyle(reveal).clipPath
      const exposed = clip === 'none' || (clip.startsWith('inset(') && (clip.match(/[-+]?\d*\.?\d+/g) || []).every(value => Number(value) === 0))
      return exposed && reveal.getAnimations().length === 0
    }), 'Reduced motion skips the entrance animation and immediately exposes the complete illustration')
    assert.equal(await page.locator('.learning-ink-reveal').evaluate(element => getComputedStyle(element).maskImage), 'none')
    assert.equal(await page.locator('.learning-ink-reveal').evaluate(element => getComputedStyle(element).clipPath), 'none', 'Reduced motion exposes the complete artwork without edge clipping')
    assert.equal(await page.locator('.learning-ink-reveal').evaluate(element => element.getAnimations().length), 0, 'Reduced motion disables the ink atlas animation entirely')
    assert.equal(await page.locator('.learning-ink-reveal').evaluate(element => Number(getComputedStyle(element).getPropertyValue('--ink-frame'))), 0, 'Reduced motion resets the erosion phase')
    assert.ok(await page.locator('.learning-ink-reveal, .learning-ink-composition').evaluateAll(elements => elements.every(element => {
      const transform = getComputedStyle(element).transform
      return transform === 'none' || Math.abs(new DOMMatrixReadOnly(transform).m42) < 0.01
    })))
    assert.ok(await page.locator('.learning-cover-trees, .learning-ink-trees').evaluateAll(layers => layers.length === 2 && layers.every(layer => Number(getComputedStyle(layer).opacity) === 1)))
    assertSharedTreeReveal(await heroState())
    assert.ok(await page.locator('.learning-ink-character').evaluateAll(elements => elements.every(element => Number(getComputedStyle(element).opacity) === 1)))
    assert.equal(await page.locator('#learning-hero-story-title').getAttribute('aria-label'), await page.locator('#learning-hero-story-title').textContent(), 'The accessible heading contains the complete statement')
    assert.ok(await story.evaluate((element, height) => element.getBoundingClientRect().height <= height + 2, animatedHeroHeight))
    assert.ok(await story.evaluate(element => [element, ...element.children].every(child => !['sticky', 'fixed'].includes(getComputedStyle(child).position))))
    await page.getByRole('button', { name: '下一篇笔记' }).click()
    assert.ok(await page.locator('.notes-viewport').evaluate(element => element.scrollLeft > 0))
    for (let i = 2; i < learningNotes.length; i++) {
      await page.getByRole('button', { name: '下一篇笔记' }).click()
      await page.waitForFunction(expected => document.querySelector('.notes-page-number').textContent.startsWith(expected), String(i + 1).padStart(2, '0'))
    }
    assert.ok(await page.getByRole('button', { name: '下一篇笔记' }).isDisabled())
    pass('Reduced motion shows a complete static hero without extra scroll space and uses instant note navigation')

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(`${url}#notes`)
    await page.waitForFunction(() => document.querySelector('#notes')?.dataset.pinned === 'true')
    assert.ok(Math.abs((await position()).top - 80) < 2)
    pass('Direct notes links land below the navigation at the start of the gallery')
    assert.deepEqual(errors, [])
    pass('No uncaught browser errors')
  } finally {
    await context.close()
  }

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const touch = await touchContext.newPage()
  try {
    await touch.goto(url)
    const mobileStory = touch.locator('.learning-hero-story')
    await touch.waitForFunction(() => [...document.querySelectorAll('.learning-cover-image img, .learning-ink-art img')].every(image => image.complete && image.naturalWidth > 0))
    await touch.locator('.learning-cover-image').tap()
    assert.notEqual(await touch.locator('.learning-cover-image').getAttribute('data-pointer'), 'true')
    assert.ok(await touch.locator('.learning-cover-reticle').evaluate(element => getComputedStyle(element).display === 'none' || Number(getComputedStyle(element).opacity) === 0))
    assert.ok(await touch.locator('.learning-cover-measure').evaluateAll(groups => groups.every(group => Number(getComputedStyle(group).opacity) < 0.01)), 'Touch input does not expose hover-only measurement guides')
    await mobileStory.scrollIntoViewIfNeeded()
    const mobileBefore = await mobileStory.evaluate(element => ({ top: element.getBoundingClientRect().top, y: scrollY }))
    await touch.evaluate(() => scrollBy({ top: 180, behavior: 'instant' }))
    const mobileAfter = await mobileStory.evaluate(element => ({ top: element.getBoundingClientRect().top, y: scrollY }))
    assert.ok(mobileAfter.y >= mobileBefore.y + 179)
    assert.ok(Math.abs(mobileAfter.top - mobileBefore.top + mobileAfter.y - mobileBefore.y) < 3)
    assert.ok(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await mobileStory.evaluate(element => {
      const art = element.querySelector('.learning-hero-scene').getBoundingClientRect()
      const copy = element.querySelector('.learning-hero-narrative').getBoundingClientRect()
      return copy.top >= art.bottom - 1 && copy.top - art.bottom < innerHeight / 3
    }), 'The mobile narrative follows the illustration without a reserved animation viewport')
    pass('The mobile hero loads locally, keeps pointer coordinates hidden, flows into its narrative, and stays within the viewport')
    await touch.goto(`${url}#notes`)
    await touch.waitForFunction(() => document.querySelector('#notes')?.dataset.pinned === 'false')
    const client = await touchContext.newCDPSession(touch)
    const box = await touch.locator('.note-cover').first().boundingBox()
    const y = Math.min(600, box.y + 120)
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y }] })
    for (const x of [260, 210, 160, 110, 60]) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
      await touch.waitForTimeout(25)
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await touch.waitForFunction(() => document.querySelector('.notes-viewport').scrollLeft > 100)
    assert.ok(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await touch.locator('.note-exhibit[data-active="true"] button').tap()
    await touch.getByRole('dialog').waitFor()
    await touch.getByRole('button', { name: '关闭笔记' }).tap()
    assert.equal(await touch.getByRole('dialog').count(), 0)
    await touch.setViewportSize({ width: 320, height: 740 })
    assert.ok(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    pass('Native touch swipes and tap-to-read work on mobile; narrow screens stay within the viewport')
  } finally {
    await touchContext.close()
  }
  return checks
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.LEARNING_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runLearningChecks(browser, process.env.LEARNING_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} learning checks passed`)
  } catch (error) {
    console.error('Learning browser checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
