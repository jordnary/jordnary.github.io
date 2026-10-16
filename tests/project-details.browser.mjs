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
  const layout = () => page.locator('.project-reader-layout')
  const readingArea = () => page.locator('.project-reader-scroll')
  const loaded = async () => {
    await page.locator('.project-introduction').waitFor()
    await page.waitForFunction(() => document.querySelector('.project-reader-layout')?.dataset.phase === 'idle')
  }
  const contentsButton = () => page.getByRole('button', { name: '本页目录', exact: true })
  const contentsDialog = () => page.locator('dialog.project-reader-toc')
  const openContents = async () => {
    await contentsButton().click()
    await contentsDialog().waitFor({ state: 'visible' })
    assert.equal(await contentsButton().getAttribute('aria-expanded'), 'true')
  }
  const settledChapter = async (section, index) => {
    await page.waitForFunction(({ id, number }) => {
      const frame = document.querySelector('.project-reader-layout')
      const counter = document.querySelector('.project-chapter-number')
      return frame?.dataset.chapter === id && frame.dataset.phase === 'idle' && counter?.dataset.value === number
    }, { id: section.id, number: String(index + 1).padStart(2, '0') })
    assert.equal(await page.locator('.project-introduction section').count(), 1, 'Only the selected chapter is mounted')
    assert.equal(await page.locator('.project-introduction section').getAttribute('id'), `project-${section.id}-content`)
    assert.equal(await page.locator(`#project-${section.id}-title`).innerText(), section.title)
    assert.equal(await page.locator('#project-toc-links a[aria-current="location"]').getAttribute('href'), `#project-${section.id}`)
  }
  const chooseChapter = async (sections, index) => {
    await openContents()
    await page.locator(`#project-toc-links a[href="#project-${sections[index].id}"]`).click()
    await contentsDialog().waitFor({ state: 'hidden' })
    await settledChapter(sections[index], index)
  }
  const expectReaderAtTop = async (margin = 20) => {
    await page.waitForFunction(expected => {
      const element = document.querySelector('.project-reader-layout')
      return Math.abs(element.getBoundingClientRect().top - expected) < 3
    }, margin)
  }
  const expectNumber = async (index, direction) => {
    const number = page.locator('.project-chapter-number')
    assert.equal(await number.getAttribute('data-value'), String(index + 1).padStart(2, '0'))
    if (direction) assert.equal(await number.getAttribute('data-direction'), direction)
    assert.equal(await number.locator('.project-chapter-digit').count(), 2)
    for (const digit of await number.locator('.project-chapter-digit').all()) {
      assert.equal(await digit.locator('.project-chapter-digit-face').count(), 2)
    }
    await page.waitForFunction(expected => {
      const digits = [...document.querySelectorAll('.project-chapter-digit')]
      const visible = digits.map(digit => {
        const bounds = digit.getBoundingClientRect()
        const center = bounds.top + bounds.height / 2
        return [...digit.querySelectorAll('.project-chapter-digit-face')].find(face => {
          const rect = face.getBoundingClientRect()
          return rect.top <= center && rect.bottom > center && getComputedStyle(face).visibility !== 'hidden'
        })?.textContent
      }).join('')
      return visible === expected
    }, String(index + 1).padStart(2, '0'))
  }
  const expectReadingScrollState = async scrollable => {
    await page.waitForFunction(expected => {
      const element = document.querySelector('.project-reader-scroll')
      return element?.dataset.scrollable === String(expected)
        && (element.scrollHeight > element.clientHeight + 1) === expected
    }, scrollable)
    const style = await readingArea().evaluate(element => {
      const computed = getComputedStyle(element)
      return {
        scrollbarWidth: computed.scrollbarWidth,
        scrollbarGutter: computed.scrollbarGutter,
        overscroll: computed.overscrollBehaviorY,
        reservedWidth: element.offsetWidth - element.clientWidth
          - parseFloat(computed.borderLeftWidth) - parseFloat(computed.borderRightWidth),
      }
    })
    assert.equal(style.scrollbarWidth, 'none', 'Body scrollbars stay hidden')
    assert.equal(style.scrollbarGutter, 'auto', 'Hidden scrollbars leave no reserved gutter')
    assert.ok(style.reservedWidth <= 1, 'The body can use the width previously occupied by its scrollbar')
    assert.equal(style.overscroll, scrollable ? 'contain' : 'auto', 'Only overflowing chapters contain wheel scrolling')
  }
  const waitForPageScrollIdle = () => page.evaluate(() => new Promise(resolve => {
    let previous = scrollY
    let stableFrames = 0
    const sample = () => {
      stableFrames = scrollY === previous ? stableFrames + 1 : 0
      previous = scrollY
      if (stableFrames >= 4) resolve()
      else requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }))
  const activateChapterWithoutPageScroll = async (sections, index, direction, input) => {
    const link = page.locator('.project-reader-chapter-navigation').getByRole('link', {
      name: direction === 'next' ? 'Next chapter' : 'Previous chapter', exact: true,
    })
    await readingArea().evaluate(element => { element.scrollTop = element.scrollHeight })
    await link.scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      const frame = document.querySelector('.project-reader-layout')
      window.scrollBy({ top: frame.getBoundingClientRect().top - 80, behavior: 'instant' })
    })
    await waitForPageScrollIdle()
    if (input === 'keyboard') await link.evaluate(element => element.focus({ preventScroll: true }))
    const bounds = await link.boundingBox()
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height < (await page.evaluate(() => innerHeight)), 'The chapter control is visible before measuring its activation')
    const before = await page.evaluate(() => ({
      windowY: scrollY,
      frameTop: document.querySelector('.project-reader-layout').getBoundingClientRect().top,
    }))
    assert.ok(Math.abs(before.frameTop - 80) < 2, 'The reader deliberately starts away from its anchor alignment')
    await page.evaluate(() => {
      window.__readerNavigationSamples = []
      window.__readerNavigationRecording = true
      const sample = () => {
        if (!window.__readerNavigationRecording) return
        window.__readerNavigationSamples.push({
          windowY: scrollY,
          frameTop: document.querySelector('.project-reader-layout').getBoundingClientRect().top,
        })
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    if (input === 'keyboard') await page.keyboard.press('Enter')
    else await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await settledChapter(sections[index], index)
    await expectNumber(index, direction)
    await waitForPageScrollIdle()
    const positions = await page.evaluate(() => {
      window.__readerNavigationRecording = false
      return [...window.__readerNavigationSamples, {
        windowY: scrollY,
        frameTop: document.querySelector('.project-reader-layout').getBoundingClientRect().top,
      }]
    })
    for (const position of positions) {
      assert.ok(Math.abs(position.windowY - before.windowY) < 2, `${input} ${direction} preserves page scroll throughout the chapter change`)
      assert.ok(Math.abs(position.frameTop - before.frameTop) < 2, `${input} ${direction} preserves the frame position throughout the chapter change`)
    }
    assert.equal(new URL(page.url()).hash, `#project-${sections[index].id}`, 'Chapter controls still update their URL')
    assert.equal(await readingArea().evaluate(element => element.scrollTop), 0, 'Chapter controls reset only the body scroll')
    await page.waitForFunction(() => document.activeElement === document.querySelector('.project-introduction h2'))
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
      const { sections } = projectIntroductions[project.id]
      await settledChapter(sections[0], 0)
      assert.equal(await page.getByText('阅读提示', { exact: true }).count(), 0)
      assert.equal(await page.getByText(/^(?:Read the story|阅读介绍)$/i).count(), 0)
      assert.ok((await page.locator('.project-reader-actions a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).includes(project.repository))
      assert.equal(await page.locator('.nav-shell, #site-footer, .live2d-companion').count(), 0)
      assert.equal(await contentsDialog().isVisible(), false, 'Contents stay out of the reading layout by default')
      assert.equal(await contentsButton().getAttribute('aria-expanded'), 'false')
      assert.equal((await contentsButton().innerText()).trim(), 'Index')
      assert.equal(await page.getByRole('button', { name: /^(?:Light|Dark)$/i }).count(), 0)
      const duplicateIds = await page.locator('[id]').evaluateAll(nodes => {
        const ids = nodes.map(node => node.id)
        return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
      })
      assert.deepEqual(duplicateIds, [], `${project.id}: chapter and cover anchors are unique`)
      const links = await page.locator('#project-toc-links a').evaluateAll(nodes => nodes.map(n => n.hash))
      assert.deepEqual(links, sections.map(section => `#project-${section.id}`))
      for (const hash of links) assert.ok(await page.evaluate(id => Boolean(document.getElementById(decodeURIComponent(id.slice(1)))), hash))
      for (const [index, section] of sections.entries()) {
        await chooseChapter(sections, index)
        await expectNumber(index)
        for (const paragraph of section.paragraphs) {
          assert.equal(await page.locator('.project-introduction section').getByText(paragraph, { exact: true }).count(), 1)
        }
        assert.equal(await page.locator('.project-introduction-figure').count(), section.figures?.length ?? 0)
        const chapterLinks = page.locator('.project-reader-chapter-navigation a')
        const expectedLinks = [
          ...(index > 0 ? [{ text: 'Previous chapter', href: `#project-${sections[index - 1].id}` }] : []),
          ...(index < sections.length - 1 ? [{ text: 'Next chapter', href: `#project-${sections[index + 1].id}` }] : []),
        ]
        assert.deepEqual(await chapterLinks.evaluateAll(nodes => nodes.map(node => ({ text: node.textContent.trim(), href: node.getAttribute('href') }))), expectedLinks)
        assert.ok(await readingArea().evaluate(element => element.contains(document.querySelector('.project-reader-chapter-navigation'))), 'Chapter controls follow the body inside its scroll area')
        assert.ok(await page.locator('.project-reader-chapter-navigation').evaluate(element => {
          const section = document.querySelector('.project-introduction section')
          const content = [...section.querySelectorAll('p, figure')].at(-1)
          return element.getBoundingClientRect().top >= content.getBoundingClientRect().bottom - 1
        }), 'Chapter navigation follows all paragraphs and figures')
        if (expectedLinks.length === 2) {
          const previous = await chapterLinks.nth(0).boundingBox()
          const next = await chapterLinks.nth(1).boundingBox()
          assert.ok(previous.x + previous.width <= next.x, 'Previous chapter stays left of Next chapter')
        }
        for (const [figureIndex, figure] of (await page.locator('.project-introduction-figure').all()).entries()) {
          const image = figure.locator('img')
          await image.scrollIntoViewIfNeeded()
          await image.evaluate(element => element.decode())
          assert.ok(await image.evaluate(element => element.naturalWidth > 0 && new URL(element.src).origin === location.origin))
          assert.equal(await image.getAttribute('alt'), section.figures[figureIndex].alt)
          const expected = await image.getAttribute('src')
          assert.ok(expected.endsWith(`/${section.figures[figureIndex].file}`))
          await figure.locator('button').click()
          const dialog = page.getByRole('dialog')
          await dialog.waitFor()
          await page.waitForFunction(src => document.querySelector('.yarl__slide_current img')?.getAttribute('src') === src, expected)
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'hidden' })
        }
      }
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const theme of ['dark', 'light']) {
          await page.evaluate(value => document.documentElement.dataset.theme = value, theme)
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${project.id}: ${width}px ${theme} overflow`)
        }
      }
    }
    pass('All static detail URLs show every chapter, matching text and images, with English controls in reading order')

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
    const vaeSections = projectIntroductions['vae-gan-digits'].sections
    assert.equal(firstChapterHash, `#project-${vaeSections[0].id}`)
    await firstChapter.click()
    await contentsDialog().waitFor({ state: 'hidden' })
    await settledChapter(vaeSections[0], 0)
    await expectReaderAtTop()
    await page.getByRole('link', { name: '回到项目概览', exact: true }).click()
    await page.waitForFunction(() => {
      const cover = document.getElementById('project-cover')
      return Math.abs(cover.getBoundingClientRect().top - parseFloat(getComputedStyle(cover).scrollMarginTop)) < 12
    })
    await openContents()
    const heading = page.locator('#project-toc-links a').nth(1)
    const sectionHash = await heading.getAttribute('href')
    await heading.click()
    await contentsDialog().waitFor({ state: 'hidden' })
    assert.equal(await contentsButton().getAttribute('aria-expanded'), 'false')
    await settledChapter(vaeSections[1], 1)
    await expectReaderAtTop()
    await page.reload()
    await loaded()
    await settledChapter(vaeSections[1], 1)
    await expectReaderAtTop()
    assert.equal(new URL(page.url()).hash, sectionHash)
    await chooseChapter(vaeSections, 3)
    await page.goBack()
    await settledChapter(vaeSections[1], 1)
    await expectNumber(1, 'previous')
    await page.goForward()
    await settledChapter(vaeSections[3], 3)
    await expectNumber(3, 'next')
    await page.goto(url(`projects/vae-gan-digits/#project-${vaeSections[1].id}`))
    await loaded()
    await settledChapter(vaeSections[1], 1)
    await expectReaderAtTop()
    pass('Chapter links, direct URLs, reload, Back and Forward preserve the selected chapter and reader alignment')

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

    const tritonSections = projectIntroductions['triton-attention-optimization'].sections
    await page.goto(url('projects/triton-attention-optimization/#project-%6dethods'))
    await loaded()
    await settledChapter(tritonSections[1], 1)
    await expectReaderAtTop()
    await page.goto(url('projects/triton-attention-optimization/#project-scope'))
    await loaded()
    await settledChapter(tritonSections[5], 5)
    await expectReaderAtTop()
    const shortChapterSize = await readingArea().evaluate(element => {
      const frame = document.querySelector('.project-reader-layout').getBoundingClientRect()
      const navigation = element.querySelector('.project-reader-chapter-navigation').getBoundingClientRect()
      return {
        client: element.clientHeight, scroll: element.scrollHeight, frameHeight: frame.height,
        blank: element.getBoundingClientRect().bottom - navigation.bottom,
      }
    })
    assert.ok(shortChapterSize.frameHeight > 500 && shortChapterSize.frameHeight <= 980, 'Desktop reader uses a useful viewport-sized frame')
    assert.ok(shortChapterSize.scroll <= shortChapterSize.client + 1, 'A short chapter has no internal overflow')
    assert.ok(shortChapterSize.blank > 24, 'Short chapters retain deliberate blank space below their controls')
    await readingArea().evaluate(element => { element.scrollTop = 200 })
    assert.equal(await readingArea().evaluate(element => element.scrollTop), 0)
    await expectReadingScrollState(false)
    await page.evaluate(() => {
      const frame = document.querySelector('.project-reader-layout')
      window.scrollBy({ top: frame.getBoundingClientRect().top - 180, behavior: 'instant' })
    })
    const shortBox = await readingArea().boundingBox()
    await page.mouse.move(shortBox.x + shortBox.width / 2, shortBox.y + 100)
    const beforeShortWheel = await page.evaluate(() => scrollY)
    await page.mouse.wheel(0, 100)
    await page.waitForFunction(y => scrollY > y + 20, beforeShortWheel)
    await waitForPageScrollIdle()
    const afterShortDownWheel = await page.evaluate(() => scrollY)
    assert.equal(await readingArea().evaluate(element => element.scrollTop), 0)
    await page.mouse.wheel(0, -100)
    await page.waitForFunction(y => scrollY < y - 20, afterShortDownWheel)
    await waitForPageScrollIdle()
    assert.equal(await readingArea().evaluate(element => element.scrollTop), 0, 'Both wheel directions pass through a short chapter to the page')
    await page.setViewportSize({ width: 390, height: 600 })
    await expectReadingScrollState(true)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expectReadingScrollState(false)
    pass('Short chapters allow page scrolling in both directions; resizing updates containment without exposing a scrollbar or gutter')
    await chooseChapter(tritonSections, 2)
    await expectReaderAtTop()
    for (const image of await page.locator('.project-introduction-figure img').all()) await image.evaluate(element => element.decode())
    assert.ok(Math.abs((await layout().boundingBox()).height - shortChapterSize.frameHeight) < 2, 'Long content does not increase the outer frame height')
    assert.ok(await readingArea().evaluate(element => element.scrollHeight > element.clientHeight + 40), 'Long chapters overflow within the body area')
    await expectReadingScrollState(true)
    const fixedPositions = () => page.evaluate(() => {
      const rect = selector => {
        const box = document.querySelector(selector).getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      }
      return {
        windowY: scrollY,
        frame: rect('.project-reader-layout'),
        label: rect('.project-reader-chapter-label'),
        footer: rect('.project-reader-end'),
        headingY: document.querySelector('.project-introduction h2').getBoundingClientRect().top,
      }
    })
    const beforeScroll = await fixedPositions()
    const scrollBox = await readingArea().boundingBox()
    await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2)
    await page.mouse.wheel(0, 350)
    await page.waitForFunction(() => document.querySelector('.project-reader-scroll').scrollTop > 20)
    const afterScroll = await fixedPositions()
    assert.equal(afterScroll.windowY, beforeScroll.windowY, 'Reading scroll does not move the page')
    for (const part of ['frame', 'label', 'footer']) assert.deepEqual(afterScroll[part], beforeScroll[part], `${part} remains fixed while the body scrolls`)
    assert.ok(afterScroll.headingY < beforeScroll.headingY - 20, 'Earlier text moves above the body viewport')
    await readingArea().evaluate(element => { element.scrollTop = element.scrollHeight })
    await page.mouse.wheel(0, 400)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal((await fixedPositions()).windowY, beforeScroll.windowY, 'Scrolling at the body boundary does not move the frame')
    await readingArea().evaluate(element => { element.scrollTop = 0 })
    await page.mouse.wheel(0, -400)
    await waitForPageScrollIdle()
    assert.equal((await fixedPositions()).windowY, beforeScroll.windowY, 'Scrolling upward at a long chapter boundary also stays within the frame')
    assert.equal(await readingArea().evaluate(element => element.scrollTop), 0)
    await chooseChapter(tritonSections, 2)
    assert.equal(await readingArea().evaluate(element => element.scrollTop), 0, 'Reselecting the current chapter from Index restarts its body')
    await readingArea().evaluate(element => { element.scrollTop = element.scrollHeight })
    await page.locator('.project-reader-chapter-navigation').getByRole('link', { name: 'Next chapter', exact: true }).click()
    await settledChapter(tritonSections[3], 3)
    assert.equal(await readingArea().evaluate(element => element.scrollTop), 0, 'A new chapter starts at its beginning')
    await page.waitForFunction(() => document.activeElement === document.querySelector('.project-introduction h2'))
    assert.ok(Math.abs((await layout().boundingBox()).height - shortChapterSize.frameHeight) < 2)
    pass('The fixed frame isolates body scrolling; chapter changes reset scroll and focus, and reselecting a chapter restarts it')
    await chooseChapter(tritonSections, 2)
    await activateChapterWithoutPageScroll(tritonSections, 3, 'next', 'mouse')
    await activateChapterWithoutPageScroll(tritonSections, 2, 'previous', 'keyboard')
    await page.goBack()
    await settledChapter(tritonSections[3], 3)
    await expectNumber(3, 'next')
    await page.goForward()
    await settledChapter(tritonSections[2], 2)
    await expectNumber(2, 'previous')
    await chooseChapter(tritonSections, 5)
    await expectReadingScrollState(false)
    pass('Reduced-motion chapter controls preserve the page and frame position for mouse and keyboard, reset the body and retain history navigation')

    await page.setViewportSize({ width: 2560, height: 1440 })
    await chooseChapter(tritonSections, 5)
    await expectReaderAtTop()
    const wideFrame = await layout().boundingBox()
    const wideType = await page.evaluate(() => {
      const size = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)
      return {
        body: size('.project-introduction p'), title: size('.project-introduction h2'),
        english: size('.project-reader-chapter-english'), number: size('.project-chapter-number'),
        width: document.querySelector('.project-reader-scroll').getBoundingClientRect().width,
      }
    })
    assert.ok(wideType.body <= 20 && wideType.title <= 32 && wideType.english <= 34 && wideType.number <= 80, 'Large screens retain bounded typography')
    assert.ok(wideType.width <= 1041, 'Wide displays preserve a readable body width')
    await chooseChapter(tritonSections, 3)
    assert.ok(Math.abs((await layout().boundingBox()).height - wideFrame.height) < 2, 'Wide-screen frame height remains independent of chapter length')
    await page.setViewportSize({ width: 1440, height: 1000 })
    pass('Encoded chapter links resolve correctly; wide screens cap typography and reading width without stretching the frame')

    await page.goto(url('projects/'))
    await page.getByRole('group', { name: 'Filter projects' }).getByRole('button', { name: /^AI & ML/ }).click()
    const cardLink = page.getByRole('link', { name: 'VAE DigitGen — View project', exact: true })
    await cardLink.scrollIntoViewIfNeeded()
    const position = await page.evaluate(() => scrollY)
    await cardLink.click()
    await loaded()
    await openContents()
    await page.locator('#project-toc-links a').nth(2).click()
    await settledChapter(projectIntroductions['vae-digits'].sections[2], 2)
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
    await settledChapter(vaeSections[2], 2)
    assert.equal(await toc.getAttribute('aria-expanded'), 'false')
    await expectReaderAtTop(16)
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

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await chooseChapter(tritonSections, 2)
    await activateChapterWithoutPageScroll(tritonSections, 3, 'next', 'keyboard')
    await activateChapterWithoutPageScroll(tritonSections, 2, 'previous', 'mouse')
    pass('Animated chapter controls preserve the page and frame through both directions and input methods')
    await chooseChapter(tritonSections, 0)
    await page.evaluate(() => {
      window.__readerMotionSamples = []
      window.__readerMotionRecording = true
      const sample = () => {
        if (!window.__readerMotionRecording) return
        const frame = document.querySelector('.project-reader-layout')
        const faces = [...document.querySelectorAll('.project-chapter-digit-face')]
        const rollingAnimations = faces.flatMap(face => face.getAnimations()).filter(animation => animation.playState === 'running')
        window.__readerMotionSamples.push({
          phase: frame.dataset.phase,
          chapter: frame.dataset.chapter,
          direction: frame.dataset.direction,
          number: document.querySelector('.project-chapter-number').dataset.value,
          rollDirections: rollingAnimations.map(animation => {
            const keyframes = animation.effect.getKeyframes()
            const position = keyframe => parseFloat(keyframe.transform.replace('translateY(', ''))
            return Math.sign(position(keyframes.at(-1)) - position(keyframes[0]))
          }),
          animated: frame.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'),
        })
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    const nextChapter = () => page.locator('.project-reader-chapter-navigation').getByRole('link', { name: 'Next chapter', exact: true })
    const previousChapter = () => page.locator('.project-reader-chapter-navigation').getByRole('link', { name: 'Previous chapter', exact: true })
    await nextChapter().click()
    await page.waitForFunction(() => {
      const frame = document.querySelector('.project-reader-layout')
      return frame.dataset.chapter === 'methods' && frame.dataset.phase === 'entering'
    }, null, { polling: 'raf' })
    await previousChapter().dispatchEvent('click')
    await settledChapter(tritonSections[0], 0)
    await expectNumber(0, 'previous')
    await nextChapter().click()
    await settledChapter(tritonSections[1], 1)
    await expectNumber(1, 'next')
    await previousChapter().click()
    await settledChapter(tritonSections[0], 0)
    await expectNumber(0, 'previous')
    await chooseChapter(tritonSections, 5)
    await expectNumber(5, 'next')
    await chooseChapter(tritonSections, 2)
    await expectNumber(2, 'previous')
    const motionSamples = await page.evaluate(() => {
      window.__readerMotionRecording = false
      return window.__readerMotionSamples
    })
    for (const direction of ['next', 'previous']) {
      assert.ok(motionSamples.some(sample => sample.direction === direction && sample.phase === 'leaving'), `${direction} chapters animate their exit`)
      assert.ok(motionSamples.some(sample => sample.direction === direction && sample.phase === 'entering' && sample.animated), `${direction} chapters animate their entry`)
      const expectedRollDirection = direction === 'next' ? -1 : 1
      assert.ok(motionSamples.some(sample => sample.direction === direction && sample.rollDirections.includes(expectedRollDirection)), `${direction} chapter numbers roll in the matching physical direction`)
      assert.ok(motionSamples.filter(sample => sample.direction === direction).every(sample => sample.rollDirections.every(value => value === 0 || value === expectedRollDirection)), `${direction} digit animations remain consistent even during a reversal`)
    }
    const jumpSamples = motionSamples.filter(sample => ['scope', 'sampling'].includes(sample.chapter))
    assert.ok(jumpSamples.every(sample => ['06', '03'].includes(sample.number)), 'Cross-chapter jumps show their destination directly without counting through intermediate chapters')
    assert.equal(new URL(page.url()).hash, '#project-sampling')
    assert.equal(await readingArea().evaluate(element => element.scrollTop), 0)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await chooseChapter(tritonSections, 0)
    await expectNumber(0, 'previous')
    assert.equal(await layout().evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0)
    pass('Real transitions survive an immediate direction reversal and chapter jumps; reduced motion keeps content and numbers in sync')

    let documentRequests = 0
    await page.route('**/data/project-docs/**', route => { documentRequests++; return route.abort() })
    await page.route('https://raw.githubusercontent.com/**', route => route.abort())
    await page.goto(url('projects/orientation-jnd/'))
    await loaded()
    const orientationSections = projectIntroductions['orientation-jnd'].sections
    await chooseChapter(orientationSections, orientationSections.findIndex(section => section.paragraphs.some(paragraph => paragraph.includes('82.47%'))))
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
    const location = error.stack?.match(/project-details\.browser\.mjs:\d+:\d+/)?.[0]
    console.error('Project detail checks failed:', error.message, location ?? '')
    process.exitCode = 1
  } finally { await browser.close() }
}
