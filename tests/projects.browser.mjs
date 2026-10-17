import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { projectFilters, projects } from '../src/data/projects.ts'
import { runProjectPreviewChecks } from './project-preview.browser.mjs'
import { runProjectMenuChecks } from './project-menu.browser.mjs'

const filterLabels = {
  全部项目: 'All',
  'Web 应用': 'Web',
  机器学习: 'AI & ML',
  视觉实验: 'Visual',
}

function filterButton(page, value) {
  return page.getByRole('group', { name: 'Filter projects' })
    .getByRole('button', { name: new RegExp(`^${filterLabels[value]}(?:\\s|$)`) })
}

async function waitForProjects(page, expectedProjects = projects) {
  await page.waitForFunction(expected => {
    const rows = [...document.querySelectorAll('.archive-project')]
    if (JSON.stringify(rows.map(element => element.id)) !== JSON.stringify(expected)) return false
    if (document.querySelector('.archive-list')?.dataset.phase !== 'idle') return false
    return rows.every(row => {
      for (let element = row; element && !element.classList.contains('projects-archive'); element = element.parentElement) {
        const style = getComputedStyle(element)
        if (Number(style.opacity) < 0.999 || style.visibility === 'hidden' || style.display === 'none') return false
      }
      return true
    })
  }, expectedProjects.map(project => project.id), { timeout: 10000 })
}

async function expectPreview(page, project) {
  const cover = project.image.cover ?? project.image
  const preview = page.locator('.archive-preview.is-visible img[data-active="true"]')
  await preview.waitFor({ state: 'visible' })
  await page.waitForFunction(file => {
    const image = document.querySelector('.archive-preview.is-visible img[data-active="true"]')
    return image?.getAttribute('src')?.endsWith(`/images/projects/${file}`)
      && image.complete && image.naturalWidth > 0
  }, cover.file)
  assert.ok(await preview.evaluate(image => {
    const source = new URL(image.src)
    return source.origin === location.origin && image.naturalWidth === 1600
      && image.naturalHeight === 1000
  }), `${project.id}: the local poster loads at its original aspect ratio`)
  assert.equal(await page.locator('.archive-preview.is-visible')
    .evaluate(element => getComputedStyle(element).pointerEvents), 'none')
  assert.ok(await preview.evaluate(image => {
    const box = image.getBoundingClientRect()
    return getComputedStyle(image).objectFit === 'contain'
      && Math.abs(box.width / box.height - image.naturalWidth / image.naturalHeight) < 0.02
  }), 'The complete cover retains its original proportions')
}

async function expectCursorStableOnPress(page, target, mode, size) {
  await target.hover()
  const point = await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })
  await page.waitForFunction(({ mode, size, point }) => {
    const cursor = document.querySelector('.projects-cursor')
    if (!cursor || cursor.dataset.mode !== mode) return false
    const rect = cursor.getBoundingClientRect()
    return Math.abs(rect.width - size) < .02
      && Math.hypot(rect.x + rect.width / 2 - point.x, rect.y + rect.height / 2 - point.y) < .08
  }, { mode, size, point })

  const samplesPromise = target.evaluate(async element => {
    let clicks = 0
    const countClick = () => { clicks++ }
    element.addEventListener('click', countClick)
    const samples = []
    const start = performance.now()
    try {
      while (performance.now() - start < 420) {
        const cursor = document.querySelector('.projects-cursor')
        const rect = cursor.getBoundingClientRect()
        samples.push({
          mode: cursor.dataset.mode,
          width: rect.width,
          height: rect.height,
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        })
        await new Promise(requestAnimationFrame)
      }
      return { samples, clicks }
    } finally {
      element.removeEventListener('click', countClick)
    }
  })
  for (let index = 0; index < 3; index++) {
    await page.mouse.down()
    await page.waitForTimeout(45)
    await page.mouse.up()
  }
  const { samples, clicks } = await samplesPromise
  assert.equal(clicks, 3, `${mode}: every click reaches the underlying element`)
  assert.ok(samples.length >= 5, `${mode}: presses are observed across rendered frames`)
  assert.ok(samples.every(sample => sample.mode === mode
    && Math.abs(sample.width - size) < .05 && Math.abs(sample.height - size) < .05),
  `${mode}: pressing and rapid repeated clicks preserve the visible cursor size`)
  assert.ok(samples.every(sample => Math.hypot(sample.x - point.x, sample.y - point.y) < .1),
    `${mode}: pressing and rapid repeated clicks keep the circle centered on the pointer`)
}

export async function runProjectChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const url = path => new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href
  const rows = page.locator('.archive-project')
  try {
    await page.goto(url('projects/'))
    await waitForProjects(page)
    assert.equal(await page.locator('.projects-archive').count(), 1)
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1)
    assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'PROJECTS')
    assert.equal(await rows.evaluateAll(nodes => new Set(nodes.map(node => node.id)).size), projects.length)
    assert.ok(await rows.evaluateAll(nodes => nodes.every(node => node.tagName === 'LI')))
    assert.equal(await page.locator('.nav-shell, #site-footer, .live2d-companion').count(), 0)
    assert.ok(!/[\u3400-\u9fff]/u.test(await page.locator('.projects-archive').innerText()), 'Visible archive copy is English')
    const background = page.locator('img.archive-background')
    assert.equal(await background.getAttribute('src'), new URL(url('images/project-archive/linework-background-1920.webp')).pathname)
    await background.evaluate(image => image.decode())
    assert.ok(await background.evaluate(image => image.naturalWidth > 0))
    pass('The English archive renders every stable project anchor and the supplied background without shared page chrome')

    for (const project of projects) {
      const link = page.locator(`#${project.id} a.archive-project-link`)
      assert.equal(await link.getAttribute('href'), new URL(url(`projects/${project.id}/`)).pathname)
      assert.equal(await link.getAttribute('target'), null)
      assert.equal(await link.getAttribute('aria-label'), `${project.title} — View project`)
      assert.ok(await link.evaluate(element => element.hasAttribute('data-project-preview')))
      await link.hover()
      await expectPreview(page, project)
      await page.mouse.move(1, 1)
      await page.locator('.archive-preview.is-visible').waitFor({ state: 'hidden' })
    }
    pass('Every project links to its existing detail route and reveals its local poster only while hovered')

    const firstLink = rows.first().locator('.archive-project-link')
    await firstLink.focus()
    await expectPreview(page, projects[0])
    await filterButton(page, '全部项目').focus()
    await page.locator('.archive-preview.is-visible').waitFor({ state: 'hidden' })
    await firstLink.focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(url(`projects/${projects[0].id}/`))
    await page.locator('.project-introduction').waitFor()
    assert.equal(await page.locator('.nav-shell, #site-footer, .live2d-companion').count(), 0)
    assert.equal(await page.locator('.project-reader .projects-cursor').count(), 1)
    assert.ok(await page.locator('.project-reader .projects-cursor').evaluate(element => {
      const style = getComputedStyle(element)
      return style.display === 'none' || Number(style.opacity) === 0
    }), 'The standalone reader preserves the system pointer with reduced motion')
    await page.locator('[data-project-return]').first().click()
    await waitForProjects(page)
    pass('Keyboard focus reveals previews, blur hides them, and Enter opens the standalone reader without shared page chrome')

    for (const value of projectFilters) {
      const expected = projects.filter(project => value === '全部项目' || project.category === value)
      await filterButton(page, value).click()
      await waitForProjects(page, expected)
      assert.deepEqual(await rows.locator('.archive-project-number').allTextContents(),
        expected.map(project => String(projects.indexOf(project) + 1)), 'Filtering preserves the original project numbers')
      assert.equal(await filterButton(page, value).getAttribute('aria-pressed'), 'true')
      assert.equal(await page.getByRole('group', { name: 'Filter projects' }).locator('[aria-pressed="true"]').count(), 1)
      assert.equal(await page.evaluate(() => history.state?.projectFilter ?? '全部项目'), value)
    }
    await filterButton(page, 'Web 应用').focus()
    await page.keyboard.press('Space')
    await waitForProjects(page, projects.filter(project => project.category === 'Web 应用'))
    pass('English filters preserve project order, expose the selected state and support keyboard activation')

    await filterButton(page, '机器学习').click()
    const filteredProjects = projects.filter(project => project.category === '机器学习')
    await waitForProjects(page, filteredProjects)
    const returnLink = page.locator(`#${filteredProjects.at(-1).id} .archive-project-link`)
    await returnLink.scrollIntoViewIfNeeded()
    const position = await page.evaluate(() => scrollY)
    await returnLink.click()
    await page.locator('.project-introduction').waitFor()
    await page.goBack()
    await waitForProjects(page, filteredProjects)
    assert.equal(await filterButton(page, '机器学习').getAttribute('aria-pressed'), 'true')
    await page.waitForFunction(y => Math.abs(scrollY - y) < 8, position)
    pass('Browser Back restores the selected filter and document scroll position')

    await page.goto(url('projects/#orientation-jnd'))
    await waitForProjects(page)
    await page.waitForFunction(() => {
      const rect = document.getElementById('orientation-jnd')?.getBoundingClientRect()
      return rect && rect.top >= 0 && rect.top < innerHeight && rect.bottom > 0
    })
    pass('A direct project hash reveals its project in the native document viewport')

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px horizontal overflow`)
      for (const row of await rows.all()) {
        const bounds = await row.boundingBox()
        assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, `${width}px project row stays in the viewport`)
      }
      assert.ok(await page.evaluate(() => getComputedStyle(document.body).position !== 'fixed'
        && getComputedStyle(document.body).overflowY !== 'hidden'))
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.mouse.move(1, 300)
    await page.mouse.wheel(0, 450)
    await page.waitForFunction(() => scrollY > 100)
    assert.ok(await page.locator('.projects-cursor').evaluate(element => {
      const style = getComputedStyle(element)
      return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0
    }))
    assert.notEqual(await rows.first().evaluate(element => getComputedStyle(element).cursor), 'none')
    pass('320, 390, 768 and 1440px layouts fit; native document scrolling and the system cursor remain available with reduced motion')

    const menuButton = page.getByRole('button', { name: 'Open menu', exact: true })
    await menuButton.click()
    const menu = page.getByRole('dialog', { name: 'Site navigation' })
    await menu.waitFor({ state: 'visible' })
    for (const name of ['Home', 'About', 'Learning', 'Projects', 'Contact']) {
      assert.ok(await menu.getByRole('link', { name, exact: true }).isVisible())
    }
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press('Tab')
      assert.ok(await menu.evaluate(element => !document.hasFocus() || element.contains(document.activeElement)), 'Menu prevents keyboard focus from reaching the background page')
    }
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
    assert.ok(await menuButton.evaluate(element => element === document.activeElement))
    await page.waitForFunction(() => getComputedStyle(document.body).overflowY !== 'hidden')
    pass('The English navigation menu contains all destinations, prevents background focus and restores focus on Escape')

    const motionContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference',
    })
    try {
      const motionPage = await motionContext.newPage()
      motionPage.on('pageerror', error => errors.push(error.message))
      await motionPage.goto(url('projects/'))
      await waitForProjects(motionPage)
      const link = motionPage.locator('.archive-project-link').first()
      await link.hover()
      await expectPreview(motionPage, projects[0])
      await motionPage.waitForFunction(() => {
        const cursor = document.querySelector('.projects-cursor')
        return cursor && getComputedStyle(cursor).opacity === '1'
      })
      assert.equal(await link.evaluate(element => getComputedStyle(element).cursor), 'none')
      assert.equal(await motionPage.locator('.projects-cursor').evaluate(element => getComputedStyle(element).pointerEvents), 'none')
      await motionPage.keyboard.press('Tab')
      await motionPage.waitForFunction(() => {
        const cursor = document.querySelector('.projects-cursor')
        const style = cursor && getComputedStyle(cursor)
        return !style || style.display === 'none' || Number(style.opacity) === 0
      })
      assert.notEqual(await link.evaluate(element => getComputedStyle(element).cursor), 'none')
      pass('The desktop cursor replaces the pointer without intercepting clicks and yields to keyboard navigation')

      const allButton = filterButton(motionPage, '全部项目')
      await expectCursorStableOnPress(motionPage, motionPage.locator('.archive-title h1'), 'default', 10)
      await expectCursorStableOnPress(motionPage, allButton, 'interactive', 18)
      await allButton.evaluate(button => button.setAttribute('data-project-preview', ''))
      try {
        await expectCursorStableOnPress(motionPage, allButton, 'preview', 24)
      } finally {
        await allButton.evaluate(button => button.removeAttribute('data-project-preview'))
      }
      assert.equal(await allButton.getAttribute('aria-pressed'), 'true')
      pass('Default, interactive and preview cursors keep their visible size and center during clicks and rapid repeated clicks')

      const samplesPromise = motionPage.evaluate(async () => {
        const samples = []
        const start = performance.now()
        while (performance.now() - start < 1500) {
          const rows = [...document.querySelectorAll('.archive-project')]
          const opacities = rows.map(row => {
            let opacity = 1
            for (let element = row; element && !element.classList.contains('projects-archive'); element = element.parentElement)
              opacity *= Number(getComputedStyle(element).opacity)
            return opacity
          })
          samples.push({
            phase: document.querySelector('.archive-list')?.dataset.phase,
            ids: rows.map(row => row.id),
            opacities,
          })
          await new Promise(requestAnimationFrame)
        }
        return samples
      })
      await filterButton(motionPage, 'Web 应用').click()
      assert.equal(await filterButton(motionPage, 'Web 应用').getAttribute('aria-pressed'), 'true')
      const samples = await samplesPromise
      const webProjects = projects.filter(project => project.category === 'Web 应用')
      const allIds = JSON.stringify(projects.map(project => project.id))
      const webIds = JSON.stringify(webProjects.map(project => project.id))
      assert.ok(samples.some(sample => sample.phase === 'leaving' && JSON.stringify(sample.ids) === allIds), 'The old list remains mounted while it exits')
      assert.ok(samples.some(sample => sample.phase === 'entering' && JSON.stringify(sample.ids) === webIds), 'The new list enters after the old list exits')
      assert.ok(samples.some(sample => sample.phase === 'entering'
        && sample.opacities.some(opacity => opacity > 0.01 && opacity < 0.99)), 'The replacement list has intermediate entrance frames')
      assert.ok(samples.every(sample => [allIds, webIds].includes(JSON.stringify(sample.ids))), 'Category changes never mix old and new rows')
      await waitForProjects(motionPage, webProjects)
      pass('Category changes retain the exiting list, then animate the replacement list into the final project order')

      await motionPage.evaluate(async () => {
        const buttons = [...document.querySelectorAll('[aria-label="Filter projects"] button')]
        for (const label of ['All', 'AI & ML', 'Visual']) {
          buttons.find(button => button.textContent.trim().startsWith(label)).click()
          await new Promise(resolve => setTimeout(resolve, 80))
        }
      })
      const visualProjects = projects.filter(project => project.category === '视觉实验')
      await waitForProjects(motionPage, visualProjects)
      assert.equal(await filterButton(motionPage, '视觉实验').getAttribute('aria-pressed'), 'true')
      assert.equal(await motionPage.evaluate(() => history.state.projectFilter), '视觉实验')
      await filterButton(motionPage, '全部项目').click()
      await waitForProjects(motionPage)
      pass('Rapid filter changes finish on the latest selection and can return to the complete archive')
      await runProjectPreviewChecks(motionPage, { url, waitForProjects, report: pass })
      await runProjectMenuChecks(motionPage, { url, waitForProjects, report: pass })
    } finally { await motionContext.close() }

    const touchContext = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    })
    try {
      const touchPage = await touchContext.newPage()
      touchPage.on('pageerror', error => errors.push(error.message))
      await touchPage.goto(url('projects/'))
      await waitForProjects(touchPage)
      assert.ok(await touchPage.locator('.projects-cursor').evaluate(element => {
        const style = getComputedStyle(element)
        return style.display === 'none' || Number(style.opacity) === 0
      }))
      assert.ok(await touchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await touchPage.locator('.archive-project-link').first().tap()
      await touchPage.waitForURL(url(`projects/${projects[0].id}/`))
      await touchPage.locator('.project-introduction').waitFor()
      pass('Touch devices keep the custom pointer hidden and open a project with one tap')
    } finally { await touchContext.close() }

    assert.deepEqual(errors, [])
    pass('No uncaught browser errors during project interactions')
    return checks
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(
    () => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'),
  )
  const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runProjectChecks(browser,
      process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/',
      name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} project checks passed`)
  } catch (error) {
    console.error('Project browser checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
