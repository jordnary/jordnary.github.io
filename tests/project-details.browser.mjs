import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { projects } from '../src/data/projects.ts'
import { projectIntroductions } from '../src/data/project-introductions.ts'

export async function runProjectDetailChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const url = path => new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href
  const loaded = () => page.locator('.project-introduction').waitFor()
  const contentsButton = () => page.getByRole('button', { name: '本页目录', exact: true })
  const contentsDialog = () => page.locator('dialog.project-reader-toc')
  const openContents = async () => {
    await contentsButton().click()
    await contentsDialog().waitFor({ state: 'visible' })
    assert.equal(await contentsButton().getAttribute('aria-expanded'), 'true')
  }
  try {
    for (const project of projects) {
      const response = await page.goto(url(`projects/${project.id}/`))
      assert.equal(response.status(), 200)
      const html = await response.text()
      assert.ok(html.includes(`<title>${project.title} | 项目案例</title>`), 'Static HTML has project metadata')
      await loaded()
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1)
      assert.equal(await page.getByRole('heading', { level: 1, name: project.title, exact: true }).count(), 1)
      assert.ok((await page.locator('.project-introduction').innerText()).length > 300)
      const { sections } = projectIntroductions[project.id]
      assert.equal(await page.locator('.project-introduction section').count(), sections.length)
      const figures = sections.flatMap(section => section.figures ?? [])
      assert.equal(await page.locator('.project-introduction-figure').count(), figures.length)
      assert.equal(await page.getByText('阅读提示', { exact: true }).count(), 0)
      assert.equal(await page.getByText(/^(?:Read the story|阅读介绍)$/i).count(), 0)
      assert.ok((await page.locator('.project-reader-actions a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).includes(project.repository))
      assert.equal(await page.locator('.nav-shell, #site-footer, .live2d-companion').count(), 0)
      assert.equal(await contentsDialog().isVisible(), false, 'Contents stay out of the reading layout by default')
      assert.equal(await contentsButton().getAttribute('aria-expanded'), 'false')
      assert.equal(await page.getByRole('button', { name: /^(?:Light|Dark)$/i }).count(), 0)
      const duplicateIds = await page.locator('[id]').evaluateAll(nodes => {
        const ids = nodes.map(node => node.id)
        return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
      })
      assert.deepEqual(duplicateIds, [], `${project.id}: chapter and cover anchors are unique`)
      const links = await page.locator('#project-toc-links a').evaluateAll(nodes => nodes.map(n => n.hash))
      for (const hash of links) assert.ok(await page.evaluate(id => Boolean(document.getElementById(decodeURIComponent(id.slice(1)))), hash))
      for (const image of await page.locator('.project-introduction-figure img').all()) {
        await image.scrollIntoViewIfNeeded()
        await image.evaluate(element => element.decode())
        assert.ok(await image.evaluate(element => element.naturalWidth > 0 && new URL(element.src).origin === location.origin))
      }
      // Each inline figure must open its own image, including the final new asset.
      for (const figure of await page.locator('.project-introduction-figure').all()) {
        const expected = await figure.locator('img').getAttribute('src')
        await figure.locator('button').click()
        const dialog = page.getByRole('dialog')
        await dialog.waitFor()
        await page.waitForFunction(src => document.querySelector('.yarl__slide_current img')?.getAttribute('src') === src, expected)
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'hidden' })
      }
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const theme of ['dark', 'light']) {
          await page.evaluate(value => document.documentElement.dataset.theme = value, theme)
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${project.id}: ${width}px ${theme} overflow`)
        }
      }
    }
    pass('All static detail URLs serve individual introductions, valid chapters and same-origin images')

    await page.goto(url('projects/vae-gan-digits/'))
    await loaded()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await openContents()
    assert.ok(await contentsDialog().evaluate(element => element.matches(':modal')))
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      assert.ok(await contentsDialog().evaluate(element => !document.hasFocus() || element.contains(document.activeElement)),
        'Native contents modal prevents focus from reaching the background page; browser chrome remains reachable')
    }
    await page.keyboard.press('Escape')
    await contentsDialog().waitFor({ state: 'hidden' })
    assert.equal(await contentsButton().getAttribute('aria-expanded'), 'false')
    assert.ok(await contentsButton().evaluate(element => element === document.activeElement))
    await openContents()
    await page.getByRole('button', { name: '关闭目录', exact: true }).click()
    await contentsDialog().waitFor({ state: 'hidden' })
    assert.ok(await contentsButton().evaluate(element => element === document.activeElement))
    pass('Contents open only on request, contain keyboard focus and return focus after Escape or Close')

    await openContents()
    const firstChapter = page.locator('#project-toc-links a').first()
    const firstChapterHash = await firstChapter.getAttribute('href')
    assert.equal(firstChapterHash, `#${await page.locator('.project-introduction section').first().getAttribute('id')}`)
    await firstChapter.click()
    await contentsDialog().waitFor({ state: 'hidden' })
    await page.waitForFunction(hash => Math.abs(document.getElementById(decodeURIComponent(hash.slice(1))).getBoundingClientRect().top - 96) < 12, firstChapterHash)
    await page.getByRole('link', { name: '回到项目概览', exact: true }).click()
    await page.waitForFunction(() => Math.abs(document.getElementById('project-cover').getBoundingClientRect().top - 96) < 12)
    await openContents()
    const heading = page.locator('#project-toc-links a').nth(1)
    const sectionHash = await heading.getAttribute('href')
    await heading.click()
    await contentsDialog().waitFor({ state: 'hidden' })
    assert.equal(await contentsButton().getAttribute('aria-expanded'), 'false')
    await page.waitForFunction(hash => Math.abs(document.getElementById(decodeURIComponent(hash.slice(1))).getBoundingClientRect().top - 96) < 12, sectionHash)
    await page.reload()
    await loaded()
    await page.waitForFunction(hash => {
      const top = document.getElementById(decodeURIComponent(hash.slice(1)))?.getBoundingClientRect().top
      return top >= 80 && top < 150
    }, sectionHash)
    pass('Selecting a chapter closes the contents and preserves the reading position after a reload')

    const imageButton = page.locator('.project-introduction-figure button').first()
    await imageButton.scrollIntoViewIfNeeded()
    await imageButton.click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    await dialog.getByRole('button', { name: '放大图片', exact: true }).click()
    assert.equal(await dialog.getByRole('button', { name: '重置图片缩放' }).textContent(), '150%')
    await dialog.getByRole('button', { name: '重置图片缩放' }).click()
    assert.equal(await dialog.getByRole('button', { name: '重置图片缩放' }).textContent(), '100%')
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)))
    }
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.ok(await imageButton.evaluate(element => element === document.activeElement))
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
    pass('Introduction figures support zoom, reset, keyboard containment and focus return')

    await page.goto(url('projects/'))
    await page.getByRole('group', { name: 'Filter projects' }).getByRole('button', { name: /^AI & ML/ }).click()
    const cardLink = page.getByRole('link', { name: 'VAE DigitGen — View project', exact: true })
    await cardLink.scrollIntoViewIfNeeded()
    const position = await page.evaluate(() => scrollY)
    await cardLink.click()
    await loaded()
    await openContents()
    await page.locator('#project-toc-links a').nth(2).click()
    await page.getByRole('link', { name: '返回项目', exact: true }).click()
    await page.waitForURL(url('projects/'))
    assert.equal(await page.locator('.archive-project').count(), projects.filter(project => project.category === '机器学习').length)
    await page.waitForFunction(y => Math.abs(scrollY - y) < 8, position)
    await cardLink.click()
    await loaded()
    await page.reload()
    await loaded()
    await page.goBack()
    await page.locator('.archive-project').first().waitFor()
    assert.equal(await page.locator('.archive-project').count(), projects.filter(project => project.category === '机器学习').length)
    await page.waitForFunction(y => Math.abs(scrollY - y) < 8, position)
    pass('Return links and browser Back restore the project filter and position, even after a detail reload')

    await page.goto(url('projects/vae-gan-digits/'))
    await loaded()
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const theme of ['dark', 'light']) {
        await page.evaluate(value => document.documentElement.dataset.theme = value, theme)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px ${theme} layout overflow`)
      }
    }
    await page.setViewportSize({ width: 390, height: 844 })
    const toc = contentsButton()
    await openContents()
    assert.equal(await toc.getAttribute('aria-expanded'), 'true')
    await page.locator('#project-toc-links a').nth(2).click()
    assert.equal(await toc.getAttribute('aria-expanded'), 'false')
    await imageButton.click()
    await dialog.waitFor()
    assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1))
    await page.keyboard.press('Escape')
    pass('Phone, tablet and desktop layouts stay within the viewport under either site theme; mobile contents and gallery work')

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
    await page.goto(url('projects/triton-attention-optimization/'))
    await loaded()
    await page.evaluate(() => document.fonts.ready)
    const reader = page.locator('.project-reader')
    const paperAppearance = () => reader.evaluate(element => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, color: style.color, scheme: style.colorScheme }
    })
    const fixedAppearance = await paperAppearance()
    assert.equal(fixedAppearance.scheme, 'light')
    for (const theme of ['dark', 'light']) {
      await page.evaluate(value => document.documentElement.dataset.theme = value, theme)
      assert.deepEqual(await paperAppearance(), fixedAppearance, 'Shared theme changes preserve the paper-and-ink reader')
    }
    assert.equal(await page.getByRole('button', { name: /^(?:Light|Dark)$/i }).count(), 0)
    pass('The reader keeps its paper-and-ink appearance without a Light or Dark control')

    const cover = page.locator('.project-reader-cover-image')
    await page.mouse.move(1, 1)
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.project-reader-cover-image img')).filter === 'grayscale(1)')
    await cover.hover()
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.project-reader-cover-image img')).filter === 'grayscale(0)')
    await page.waitForFunction(() => {
      const cursor = document.querySelector('.project-reader .projects-cursor')
      return cursor?.dataset.active === 'true' && cursor.dataset.mode === 'preview'
    })
    const coverSource = await cover.locator('img').getAttribute('src')
    await cover.getByRole('button').click()
    await dialog.waitFor()
    await page.waitForFunction(src => document.querySelector('.yarl__slide_current img')?.getAttribute('src') === src, coverSource)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.ok(await cover.getByRole('button').evaluate(element => element === document.activeElement))
    const backLink = page.getByRole('link', { name: '返回项目', exact: true })
    await backLink.focus()
    await backLink.hover()
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.project-reader-cover-image img')).filter === 'grayscale(1)')
    assert.equal(await backLink.evaluate(element => getComputedStyle(element).textDecorationLine), 'none')
    await page.waitForFunction(() => document.querySelector('.project-reader .projects-cursor')?.dataset.mode === 'interactive')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.mouse.move(2, 2)
    await page.waitForFunction(() => document.querySelector('.project-reader .projects-cursor')?.dataset.active === 'false')
    pass('The cover restores color on hover, uses the preview cursor and opens the matching gallery image; controls avoid hover underlines')

    let documentRequests = 0
    await page.route('**/data/project-docs/**', route => { documentRequests++; return route.abort() })
    await page.route('https://raw.githubusercontent.com/**', route => route.abort())
    await page.goto(url('projects/orientation-jnd/'))
    await loaded()
    assert.ok((await page.locator('.project-introduction').innerText()).includes('82.47%'))
    assert.equal(documentRequests, 0)
    await page.unroute('**/data/project-docs/**')
    await page.unroute('https://raw.githubusercontent.com/**')
    pass('Introductions load without repository documents or remote Markdown requests')

    assert.deepEqual(errors, [])
    pass('No uncaught browser errors during detail-page interactions')
    if (process.env.PROJECTS_CAPTURE === '1') {
      await mkdir('node_modules/.cache/project-preview', { recursive: true })
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto(url('projects/vae-gan-digits/'))
      await loaded()
      await page.screenshot({ path: 'node_modules/.cache/project-preview/desktop.png' })
      await page.locator('#project-document').scrollIntoViewIfNeeded()
      await page.screenshot({ path: 'node_modules/.cache/project-preview/reading.png' })
      await page.setViewportSize({ width: 390, height: 844 })
      await page.screenshot({ path: 'node_modules/.cache/project-preview/mobile.png' })
    }
    return checks
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runProjectDetailChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:4173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} project detail checks passed`)
  } catch (error) {
    console.error('Project detail checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
