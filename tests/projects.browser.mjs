import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

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
    await waitForCount(8)
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1)
    assert.equal(await page.title(), '项目案例 | Jordnary')
    assert.equal(
      await cards.evaluateAll(
        (nodes) => new Set(nodes.map((node) => node.id)).size,
      ),
      8,
    )
    pass(
      'Eight distinct projects render with a page heading and stable anchors',
    )

    for (const preview of await page.locator('.portfolio-image-button').all()) {
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
    assert.equal(await page.locator('.portfolio-image-button').count(), 5)
    pass('All five local poster covers load at 8:5 with descriptive alternatives')

    for (const [name, expected] of [
      ['Web 应用', 2],
      ['机器学习', 5],
      ['视觉实验', 1],
      ['全部项目', 8],
    ]) {
      await filter(name).click()
      await waitForCount(expected)
      assert.equal(await filter(name).getAttribute('aria-pressed'), 'true')
      assert.equal(
        await page.locator('.portfolio-result-count').textContent(),
        `显示 ${expected} / 8 个项目`,
      )
    }
    await filter('Web 应用').focus()
    await page.keyboard.press('Space')
    await waitForCount(2)
    await filter('全部项目').click()
    await waitForCount(8)
    pass('Every category filters correctly and supports keyboard activation')

    const details = cards.first().locator('details')
    await details.locator('summary').focus()
    await page.keyboard.press('Enter')
    assert.equal(await details.getAttribute('open'), '')
    assert.ok(
      await details.getByRole('heading', { name: '如何理解结果' }).isVisible(),
    )
    await page.keyboard.press('Enter')
    assert.equal(await details.getAttribute('open'), null)
    pass('Case-study disclosures open and close with the keyboard')

    const opener = page.getByRole('button', {
      name: '放大查看 Briefing Atlas 项目图片',
      exact: true,
    })
    await opener.click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      'hidden',
    )
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      assert.ok(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      )
    }
    await page.keyboard.press('ArrowRight')
    assert.equal(
      await dialog.getByRole('heading').textContent(),
      'VAE-GAN DigitGen',
    )
    assert.ok(
      (
        await page
          .locator('#vae-gan-digits .portfolio-image-button img')
          .getAttribute('src')
      ).endsWith('/vaegan-poster.webp'),
    )
    assert.ok(
      (await dialog.locator('img').getAttribute('src')).endsWith(
        '/vaegan-comparison.webp',
      ),
    )
    await page.keyboard.press('ArrowLeft')
    assert.equal(
      await dialog.getByRole('heading').textContent(),
      'Briefing Atlas',
    )
    await dialog.getByRole('button', { name: '上一张图片' }).click()
    assert.equal(
      await dialog.getByRole('heading').textContent(),
      'Personal Website',
    )
    await dialog.getByRole('button', { name: '下一张图片' }).click()
    assert.equal(
      await dialog.getByRole('heading').textContent(),
      'Briefing Atlas',
    )
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.ok(
      await opener.evaluate((element) => document.activeElement === element),
    )
    assert.notEqual(
      await page.evaluate(() => document.body.style.overflow),
      'hidden',
    )
    await opener.click()
    await dialog.getByRole('button', { name: '关闭图片预览' }).click()
    await dialog.waitFor({ state: 'hidden' })
    pass(
      'The gallery supports arrows, wraparound, focus containment, Escape and focus return',
    )

    await filter('Web 应用').click()
    await page.locator('.nav-search-button').click()
    await page.getByRole('combobox', { name: '搜索站内内容' }).fill('FroFA')
    await page
      .locator('.site-search-result')
      .filter({ hasText: 'Few-Shot Learning' })
      .click()
    await page.waitForURL('**/projects/#few-shot-learning')
    await waitForCount(8)
    await page.waitForFunction(() => {
      const top = document
        .getElementById('few-shot-learning')
        ?.getBoundingClientRect().top
      return top !== undefined && top >= 70 && top < 140
    })
    assert.equal(await filter('全部项目').getAttribute('aria-pressed'), 'true')
    pass(
      'Search reveals and scrolls to a project hidden by the active category',
    )

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
      for (const theme of ['dark', 'light']) {
        const current = await page.locator('html').getAttribute('data-theme')
        if (current !== theme)
          await page
            .getByRole('button', {
              name: theme === 'dark' ? '切换到深色主题' : '切换到浅色主题',
            })
            .click()
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${width}px ${theme} overflow`,
        )
        for (const card of await cards.all()) {
          const bounds = await card.boundingBox()
          assert.ok(
            bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
          )
        }
      }
    }
    pass(
      '320, 390, 768 and 1440px layouts fit in both themes with reduced motion',
    )

    await page.setViewportSize({ width: 390, height: 844 })
    await opener.click()
    await dialog.waitFor()
    assert.ok(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    )
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    pass('The image gallery fits the mobile viewport')

    const motionContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'no-preference',
    })
    try {
      const motionPage = await motionContext.newPage()
      await motionPage.goto(url('projects/'))
      const lastSurface = motionPage.locator(
        '#personal-website .portfolio-card-surface',
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
        .locator('#personal-website .portfolio-image-button')
        .focus()
      await motionPage.waitForFunction(
        () =>
          getComputedStyle(
            document.querySelector('#personal-website .portfolio-card-surface'),
          ).opacity === '1',
      )
      assert.ok(
        await motionPage
          .locator('#personal-website .portfolio-image-button')
          .evaluate((element) => document.activeElement === element),
      )
      pass(
        'Keyboard focus reveals an offscreen project without hiding its controls',
      )
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
    } finally {
      await brokenContext.close()
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
