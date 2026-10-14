import assert from 'node:assert/strict'
import { projectFilters, projects } from '../src/data/projects.ts'
import { pathToFileURL } from 'node:url'

async function expectCoverFocus(page, card) {
  const link = card.locator('.portfolio-primary-link')
  await page.waitForFunction(id => {
    const element = document.getElementById(id)
    return element === document.activeElement && element?.dataset.scrollFocus === 'arrived'
  }, await link.getAttribute('id'))
  assert.ok(await link.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const nav = document.querySelector('.nav-shell').getBoundingClientRect()
    return rect.top > nav.bottom && rect.bottom <= innerHeight
  }), 'The focused introduction stays inside the viewport and below navigation')
  assert.equal(await page.getByRole('dialog').count(), 0)
}

async function sampleScroll(page, milliseconds = 1100) {
  return page.evaluate(async duration => {
    const readings = []
    const start = performance.now()
    while (performance.now() - start < duration) {
      readings.push(scrollY)
      await new Promise(requestAnimationFrame)
    }
    return readings
  }, milliseconds)
}

export async function runProjectChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const checks = []
  const pass = (name) => {
    checks.push(name)
    report(name)
  }
  const url = (path) =>
    new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href
  const cards = page.locator('.portfolio-card')
  const filter = (name) =>
    page
      .getByRole('group', { name: '按项目方向筛选' })
      .getByRole('button', { name: new RegExp(`^${name}`) })
  const waitForCount = (count) =>
    page.waitForFunction(
      (expected) =>
        document.querySelectorAll('.portfolio-card').length === expected,
      count,
    )
  try {
    await page.goto(url('projects/'))
    await waitForCount(projects.length)
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1)
    assert.equal(await page.title(), '项目案例 | Jordnary')
    assert.equal(
      await cards.evaluateAll(
        (nodes) => new Set(nodes.map((node) => node.id)).size,
      ),
      projects.length,
    )
    pass(
      'All projects render with a page heading and stable anchors',
    )
    assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(node => node.id)), projects.map(project => project.id))
    const categoryGroups = projects.map(project => project.category).filter((category, index, categories) => category !== categories[index - 1])
    assert.equal(categoryGroups.length, new Set(categoryGroups).size, 'Projects in each category stay together')

    for (const preview of await page.locator('.portfolio-image-preview').all()) {
      await preview.scrollIntoViewIfNeeded()
      await preview.locator('img').evaluate((image) => image.decode())
      assert.ok(
        await preview
          .locator('img')
          .evaluate(
            (image) =>
              image.naturalWidth === 1600 &&
              image.naturalHeight === 1000 &&
              Boolean(image.alt),
          ),
      )
    }
    assert.equal(await page.locator('.portfolio-image-preview').count(), projects.length)
    pass('All local poster covers load at 8:5 with descriptive alternatives')

    for (const name of projectFilters) {
      const expected = name === '全部项目' ? projects.length : projects.filter(project => project.category === name).length
      await filter(name).click()
      await waitForCount(expected)
      assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(node => node.id)), projects.filter(project => name === '全部项目' || project.category === name).map(project => project.id))
      assert.equal(await filter(name).getAttribute('aria-pressed'), 'true')
      assert.equal(
        await page.locator('.portfolio-result-count').textContent(),
        `显示 ${expected} / ${projects.length} 个项目`,
      )
    }
    await filter('Web 应用').focus()
    await page.keyboard.press('Space')
    await waitForCount(2)
    await filter('全部项目').click()
    await waitForCount(projects.length)
    pass('Every category filters correctly and supports keyboard activation')

    for (const project of projects) {
      const card = page.locator('#' + project.id)
      const primary = card.locator('.portfolio-primary-link')
      const external = card.locator('.portfolio-source-link')
      assert.equal(await primary.getAttribute('href'), new URL(url('projects/' + project.id + '/')).pathname)
      assert.equal(await primary.getAttribute('target'), null)
      assert.equal((await primary.innerText()).replace('→', '').trim(), '项目介绍')
      assert.equal(await external.getAttribute('href'), project.demo ?? project.repository)
      assert.equal(await external.getAttribute('target'), '_blank')
      assert.ok((await external.getAttribute('rel')).includes('noreferrer'))
      await primary.scrollIntoViewIfNeeded()
      const primaryBox = await primary.boundingBox()
      const externalBox = await external.boundingBox()
      assert.ok(primaryBox.x < externalBox.x)
    }
    await cards.first().locator('.portfolio-primary-link').focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(url(`projects/${projects[0].id}/`))
    await page.locator('.project-introduction').waitFor()
    await page.getByRole('link', { name: '返回项目', exact: true }).click()
    await waitForCount(projects.length)
    pass('All cards place the internal introduction on the left and external destination on the right; keyboard navigation works')

    const listURL = page.url()
    const historyLength = await page.evaluate(() => history.length)
    for (const card of await cards.all()) {
      const trigger = card.getByRole('button', { name: /定位到项目介绍/ })
      assert.equal(await trigger.getAttribute('aria-controls'), await card.locator('.portfolio-primary-link').getAttribute('id'))
      await trigger.click()
      await expectCoverFocus(page, card)
      assert.equal(page.url(), listURL)
      assert.equal(await page.evaluate(() => history.length), historyLength)
      assert.ok(!(await card.locator('.portfolio-preview').textContent()).includes('⤢'))
    }
    pass('Every cover focuses its own introduction without navigation or a gallery, including the final card')

    assert.ok(await cards.first().locator('.portfolio-preview-trigger').evaluate(element => {
      element.click()
      const target = document.getElementById(element.getAttribute('aria-controls'))
      return target === document.activeElement && target.dataset.scrollFocus === 'arrived'
    }), 'Reduced motion finishes synchronously without an animation frame')
    for (const key of ['Enter', 'Space']) {
      await cards.first().locator('.portfolio-preview-trigger').focus()
      await page.keyboard.press(key)
      await expectCoverFocus(page, cards.first())
      assert.equal(page.url(), listURL)
    }
    await page.keyboard.press('Tab')
    assert.ok(await cards.first().locator('.portfolio-source-link').evaluate(element => element === document.activeElement))
    pass('Enter and Space activate the cover, reduced motion focuses immediately, and Tab continues from the introduction')

    await filter('Web 应用').click()
    await page.locator('.nav-search-button').click()
    await page.getByRole('combobox', { name: '搜索站内内容' }).fill('FroFA')
    await page
      .locator('.site-search-result')
      .filter({ hasText: 'Few-Shot Learning' })
      .click()
    await page.waitForURL(url('projects/few-shot-learning/'))
    await page.locator('.project-introduction').waitFor()
    assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'Few-Shot Learning')
    await page.getByRole('link', { name: '返回项目', exact: true }).click()
    await waitForCount(2)
    assert.equal(await filter('Web 应用').getAttribute('aria-pressed'), 'true')
    pass('Search opens the project introduction and returning preserves the active category')

    await page.goto(url('projects/#orientation-jnd'))
    await page.waitForFunction(() => {
      const top = document
        .getElementById('orientation-jnd')
        ?.getBoundingClientRect().top
      return top !== undefined && top >= 70 && top < 140
    })
    pass('A direct project URL restores its anchor below the sticky navigation')

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).colorScheme), 'light')
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${width}px overflow`,
      )
      for (const card of await cards.all()) {
        const bounds = await card.boundingBox()
        assert.ok(
          bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
        )
      }
    }
    pass(
      '320, 390, 768 and 1440px layouts fit the light appearance with reduced motion',
    )

    await page.setViewportSize({ width: 390, height: 844 })
    const motionContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'no-preference',
    })
    try {
      const motionPage = await motionContext.newPage()
      motionPage.on('pageerror', error => errors.push(error.message))
      await motionPage.goto(url('projects/'))
      const lastSurface = motionPage.locator(
        '.portfolio-card:last-child .portfolio-card-surface',
      )
      await lastSurface.waitFor({ state: 'attached' })
      assert.equal(
        await lastSurface.evaluate(
          (element) => getComputedStyle(element).opacity,
        ),
        '0',
      )
      const samples = await lastSurface.evaluate(async (element) => {
        element.scrollIntoView({ block: 'center', behavior: 'instant' })
        const readings = []
        const start = performance.now()
        while (performance.now() - start < 1000) {
          const style = getComputedStyle(element)
          readings.push({
            opacity: Number(style.opacity),
            y: new DOMMatrixReadOnly(style.transform).m42,
          })
          await new Promise(requestAnimationFrame)
        }
        return readings
      })
      assert.ok(
        samples.some(({ opacity, y }) => opacity > 0 && opacity < 1 && y > 0),
      )
      assert.equal(samples.at(-1).opacity, 1)
      await motionPage.evaluate(() =>
        window.scrollTo({ top: 0, behavior: 'instant' }),
      )
      assert.equal(
        await lastSurface.evaluate(
          (element) => getComputedStyle(element).opacity,
        ),
        '1',
      )
      pass(
        'Offscreen projects float and fade on entry, and stay visible after leaving the viewport',
      )

      await motionPage.goto(url('projects/#orientation-jnd'))
      await motionPage.waitForFunction(() => {
        const card = document.getElementById('orientation-jnd')
        const top = card?.getBoundingClientRect().top
        const surface = card?.querySelector('.portfolio-card-surface')
        return (
          top >= 70 &&
          top < 140 &&
          surface &&
          getComputedStyle(surface).opacity === '1'
        )
      })
      pass('Animated cards preserve direct-link scroll alignment')

      await motionPage.goto(url('projects/'))
      await motionPage
        .locator('.portfolio-card:last-child .portfolio-primary-link')
        .focus()
      await motionPage.waitForFunction(
        () =>
          getComputedStyle(
            document.querySelector('.portfolio-card:last-child .portfolio-card-surface'),
          ).opacity === '1',
      )
      assert.ok(
        await motionPage
          .locator('.portfolio-card:last-child .portfolio-primary-link')
          .evaluate((element) => document.activeElement === element),
      )
      pass(
        'Keyboard focus reveals an offscreen project without hiding its controls',
      )

      await motionPage.goto(url('projects/'))
      const firstCard = motionPage.locator('.portfolio-card').first()
      const secondCard = motionPage.locator('.portfolio-card').nth(1)
      const firstTrigger = firstCard.locator('.portfolio-preview-trigger')
      // Keep the click inside the reading area, clear of viewport-edge clamping.
      await firstTrigger.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
      await motionPage.waitForFunction(() => {
        const style = getComputedStyle(document.querySelector('.portfolio-card-surface'))
        return style.opacity === '1' && new DOMMatrixReadOnly(style.transform).m42 === 0
      })
      const coverBox = await firstTrigger.boundingBox()
      const clickY = coverBox.y + coverBox.height / 2
      const samplesPromise = sampleScroll(motionPage)
      await motionPage.mouse.click(coverBox.x + coverBox.width / 2, clickY)
      const scrollSamples = await samplesPromise
      await expectCoverFocus(motionPage, firstCard)
      assert.ok(scrollSamples.at(-1) - scrollSamples[0] > 100)
      assert.ok(new Set(scrollSamples).size > 8, 'Scrolling includes intermediate animation frames')
      assert.ok(scrollSamples.every((y, i) => i === 0 || y >= scrollSamples[i - 1] - 1), 'Scrolling does not reverse or bounce')
      assert.ok(Math.max(...scrollSamples.slice(-5)) - Math.min(...scrollSamples.slice(-5)) <= 1, 'Focus does not cause a second scroll jump')
      const linkBox = await firstCard.locator('.portfolio-primary-link').boundingBox()
      assert.ok(Math.abs(linkBox.y + linkBox.height / 2 - clickY) < 4, 'Desktop alignment follows the click height')
      assert.equal(motionPage.url(), url('projects/'))
      pass('Desktop covers scroll through smooth intermediate frames, align with the click, and focus without a second jump')

      await motionPage.waitForFunction(() => {
        const target = document.querySelector('.portfolio-primary-link')
        return !target.hasAttribute('data-scroll-focus') && getComputedStyle(target, '::after').opacity === '0'
      })
      assert.ok(await firstCard.locator('.portfolio-primary-link').evaluate(element => element === document.activeElement))
      pass('The arrival highlight fades out while keyboard focus remains on the introduction')

      await firstTrigger.scrollIntoViewIfNeeded()
      await firstTrigger.click()
      await motionPage.waitForFunction(() => document.querySelector('[data-scroll-focus="scrolling"]'))
      await motionPage.mouse.wheel(0, 90)
      await motionPage.waitForFunction(() => !document.querySelector('[data-scroll-focus]'))
      await sampleScroll(motionPage)
      assert.ok(await firstCard.locator('.portfolio-primary-link').evaluate(element => element !== document.activeElement))
      pass('Manual scrolling cancels the transition and prevents delayed focus stealing')

      await firstTrigger.scrollIntoViewIfNeeded()
      await motionPage.evaluate(() => {
        const triggers = document.querySelectorAll('.portfolio-preview-trigger')
        triggers[0].click()
        triggers[0].click()
        triggers[1].click()
      })
      await expectCoverFocus(motionPage, secondCard)
      assert.equal(await firstCard.locator('[data-scroll-focus]').count(), 0)
      assert.equal(await motionPage.locator('[data-scroll-focus]').count(), 1)
      pass('Repeated clicks and switching cards leave only the latest target active')

      await motionPage.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
      const bottom = await motionPage.evaluate(() => scrollY)
      await firstTrigger.evaluate(element => element.click())
      await expectCoverFocus(motionPage, firstCard)
      assert.ok(await motionPage.evaluate(y => scrollY < y - 100, bottom))
      pass('The reusable transition also scrolls upward to an earlier target')

      await firstTrigger.scrollIntoViewIfNeeded()
      await firstTrigger.evaluate(element => element.click())
      await motionPage.getByRole('group', { name: '按项目方向筛选' }).getByRole('button', { name: /^视觉实验/ }).dispatchEvent('click')
      await motionPage.waitForFunction(() => !document.querySelector('#briefing-atlas'))
      const cancelledSamples = await sampleScroll(motionPage)
      assert.equal(await motionPage.locator('[data-scroll-focus]').count(), 0)
      assert.ok(Math.abs(cancelledSamples.at(-1) - cancelledSamples[0]) <= 1)
      pass('Removing a card through filtering cleans up its animation')
    } finally {
      await motionContext.close()
    }

    const brokenContext = await browser.newContext()
    try {
      await brokenContext.route(
        '**/images/projects/briefing-atlas.webp',
        (route) => route.abort(),
      )
      const brokenPage = await brokenContext.newPage()
      brokenPage.on('pageerror', error => errors.push(error.message))
      await brokenPage.goto(url('projects/'))
      await brokenPage.locator('#briefing-atlas .portfolio-art').waitFor()
      assert.ok(
        await brokenPage
          .getByRole('link', { name: 'Briefing Atlas：访问网站' })
          .isVisible(),
      )
      pass(
        'A failed cover image falls back to an illustration without hiding the project',
      )
      const fallbackCard = brokenPage.locator('#briefing-atlas')
      await fallbackCard.locator('.portfolio-preview-trigger').click()
      await expectCoverFocus(brokenPage, fallbackCard)
      pass('Fallback illustrations retain the same cover-to-introduction interaction')
    } finally {
      await brokenContext.close()
    }

    const touchContext = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    })
    try {
      const touchPage = await touchContext.newPage()
      touchPage.on('pageerror', error => errors.push(error.message))
      await touchPage.goto(url('projects/'))
      const card = touchPage.locator('.portfolio-card').first()
      await card.locator('.portfolio-preview-trigger').tap()
      await expectCoverFocus(touchPage, card)
      const box = await card.locator('.portfolio-primary-link').boundingBox()
      assert.ok(box.y > 300 && box.y < 550, 'Touch activation uses a comfortable viewport position')
      assert.ok(await touchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await card.locator('.portfolio-primary-link').tap()
      await touchPage.waitForURL(url(`projects/${projects[0].id}/`))
      await touchPage.locator('.project-introduction').waitFor()
      pass('Native touch scrolls and focuses the introduction; a second tap opens the detail page')
    } finally {
      await touchContext.close()
    }
    assert.deepEqual(errors, [])
    pass('No uncaught browser errors during project interactions')
    return checks
  } finally {
    await context.close()
  }
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { chromium } = await import('playwright').catch(
    () =>
      import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'),
  )
  const browser = await chromium.launch(
    process.env.PROJECTS_BROWSER_EXECUTABLE
      ? {
          executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE,
          headless: true,
        }
      : {
          channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge',
          headless: true,
        },
  )
  try {
    const checks = await runProjectChecks(
      browser,
      process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/',
      (name) => console.log(`PASS: ${name}`),
    )
    console.log(`${checks.length} project checks passed`)
  } catch (error) {
    console.error('Project browser checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
