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
    await page.goto(url)
    await page.waitForFunction(() => document.querySelector('#notes')?.dataset.pinned === 'true')
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1)
    assert.equal(await cards.count(), learningNotes.length)
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
      assert.equal(await page.locator('.note-reader-end a').getAttribute('href'), photo.href)
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
    pass('All local covers and expanded notes load; examples, self-assessment, sources, focus, Escape, and reading position work')

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

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => document.querySelector('#notes').dataset.pinned === 'false')
    assert.equal(await page.locator('.notes-track').evaluate(element => element.style.transform), '')
    assert.equal(await page.locator('.note-cover-photo').first().evaluate(image => getComputedStyle(image).animationName), 'none')
    assert.equal(await page.locator('.learning-cover-photo-frame img').evaluate(image => getComputedStyle(image).animationName), 'none')
    await page.getByRole('button', { name: '下一篇笔记' }).click()
    assert.ok(await page.locator('.notes-viewport').evaluate(element => element.scrollLeft > 0))
    for (let i = 2; i < learningNotes.length; i++) {
      await page.getByRole('button', { name: '下一篇笔记' }).click()
      await page.waitForFunction(expected => document.querySelector('.notes-page-number').textContent.startsWith(expected), String(i + 1).padStart(2, '0'))
    }
    assert.ok(await page.getByRole('button', { name: '下一篇笔记' }).isDisabled())
    pass('Reduced motion uses a native horizontal scroller with instant button navigation')

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
