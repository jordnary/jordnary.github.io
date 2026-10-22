import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export async function runLearningToolkitChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'light' })
  await context.addInitScript(() => sessionStorage.setItem('site-live2d-collapsed-desktop', 'true'))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const names = () => page.locator('.learning-toolkit-track li[aria-hidden="false"] .learning-tool-name').allTextContents()
  const settle = () => page.waitForFunction(() => document.querySelector('.learning-toolkit-track').dataset.moving === 'false')
  const color = locator => locator.evaluate(element => getComputedStyle(element).color)
  try {
    await page.goto(new URL('learning/', baseURL).href)
    const toolkit = page.getByRole('region', { name: '学习工具箱' })
    await toolkit.scrollIntoViewIfNeeded()
    await page.mouse.move(0, 0)
    const toolNames = ['Python', 'PyTorch', 'React', 'TypeScript', 'JavaScript', 'Git', 'HTML', 'CSS', 'Julia', 'C++', 'Docker']
    const windowAt = (offset, count = 5) => Array.from({ length: count }, (_, index) => toolNames[(offset + index) % toolNames.length])
    assert.deepEqual(await names(), windowAt(0))
    assert.equal(await toolkit.getByRole('button').count(), 2, 'Only the two navigation controls remain')
    assert.equal(await toolkit.getByRole('button', { name: /暂停|播放/ }).count(), 0)
    await page.evaluate(() => {
      window.toolkitStartTimes = []
      window.toolkitStopTimes = []
      const track = document.querySelector('.learning-toolkit-track')
      new MutationObserver(() => {
        if (track.dataset.moving === 'true') window.toolkitStartTimes.push(performance.now())
        else window.toolkitStopTimes.push(performance.now())
      }).observe(track, { attributes: true, attributeFilter: ['data-moving'] })
    })
    await page.waitForFunction(() => window.toolkitStartTimes.length === 1)
    const movingPython = page.locator('.learning-tool').filter({ hasText: 'Python' }).nth(1)
    const before = await movingPython.boundingBox()
    await page.waitForTimeout(180)
    const after = await movingPython.boundingBox()
    assert.ok(after.x < before.x - 2, 'Automatic movement travels left to reveal tools on the right')
    await settle()
    assert.deepEqual(await names(), windowAt(3))
    for (const [index, offset] of [6, 9, 0].entries()) {
      await page.waitForFunction(count => window.toolkitStartTimes.length === count, index + 2)
      await settle()
      assert.deepEqual(await names(), windowAt(offset))
    }
    const { startTimes, stopTimes } = await page.evaluate(() => ({ startTimes: window.toolkitStartTimes, stopTimes: window.toolkitStopTimes }))
    for (let index = 1; index < startTimes.length; index++) {
      assert.ok(Math.abs(startTimes[index] - stopTimes[index - 1] - 3000) < 250, 'Each automatic step waits three seconds after the previous movement ends')
    }
    report('Autoplay waits three seconds after each movement and completes an eleven-tool cycle in steps of 3, 3, 3, and 2')

    const python = toolkit.getByRole('link', { name: 'Python 官方文档（在新标签页打开）' })
    assert.equal(await python.locator('.learning-tool-icon').evaluate(element => getComputedStyle(element).filter), 'grayscale(1)', 'Idle artwork stays grayscale')
    const monochrome = await color(python)
    const channels = monochrome.match(/\d+/g).slice(0, 3)
    assert.ok(channels.every(channel => channel === channels[0]), 'The idle logo and name are neutral grayscale')
    await python.hover()
    await page.waitForTimeout(300)
    assert.notEqual(await color(python), monochrome)
    assert.equal(await color(python.locator('.learning-tool-name')), await color(python))
    assert.equal(await python.locator('.learning-tool-icon').evaluate(element => getComputedStyle(element).filter), 'grayscale(0)', 'Hover reveals the original SVG colors')
    const pythonColors = await python.locator('.learning-tool-icon').evaluate(async element => {
      await element.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 128
      const context = canvas.getContext('2d')
      context.drawImage(element, 0, 0, 128, 128)
      const pixels = context.getImageData(0, 0, 128, 128).data
      let blue = false, yellow = false
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 128) continue
        const [r, g, b] = pixels.slice(index, index + 3)
        if (b > r * 1.4 && b > 100) blue = true
        if (r > 200 && g > 150 && b < 140) yellow = true
      }
      return { blue, yellow }
    })
    assert.deepEqual(pythonColors, { blue: true, yellow: true }, 'The original Python artwork retains its blue and yellow palette')
    await page.waitForFunction(() => document.querySelector('.learning-toolkit-track').dataset.moving === 'true')
    await settle()
    assert.deepEqual(await names(), windowAt(3), 'Hovering an icon does not pause automatic movement')
    await page.mouse.move(0, 0)
    const focusedTool = toolkit.getByRole('link', { name: 'TypeScript 官方文档（在新标签页打开）' })
    await focusedTool.focus()
    await page.waitForTimeout(300)
    assert.notEqual(await color(focusedTool), monochrome, 'Keyboard focus reveals the brand color')
    assert.equal(await focusedTool.locator('.learning-tool-icon').evaluate(element => getComputedStyle(element).filter), 'grayscale(0)', 'Keyboard focus reveals the original SVG colors')
    await page.waitForFunction(() => document.querySelector('.learning-toolkit-track').dataset.moving === 'true')
    await settle()
    assert.deepEqual(await names(), windowAt(6), 'Keyboard focus does not pause automatic movement')
    await page.evaluate(() => document.activeElement.blur())
    await toolkit.locator('.learning-toolkit-caption').hover()
    await page.waitForFunction(() => document.querySelector('.learning-toolkit-track').dataset.moving === 'true')
    await settle()
    assert.deepEqual(await names(), windowAt(9), 'Hovering the caption does not pause automatic movement')

    const next = toolkit.getByRole('button', { name: '向右浏览工具' })
    const previous = toolkit.getByRole('button', { name: '向左浏览工具' })
    await next.hover()
    await next.focus()
    await page.waitForFunction(() => document.querySelector('.learning-toolkit-track').dataset.moving === 'true')
    await settle()
    assert.deepEqual(await names(), windowAt(0), 'Hover and focus on an arrow do not pause automatic movement')
    report('Hovering icons, arrows, or the caption and retaining keyboard focus do not pause autoplay; original brand colors remain available')
    for (const offset of [3, 6, 9, 0]) {
      const before = await movingPython.boundingBox()
      await next.click()
      await page.waitForTimeout(180)
      const after = await movingPython.boundingBox()
      assert.ok(after.x < before.x - 2, 'The right arrow moves the track left')
      await settle()
      assert.deepEqual(await names(), windowAt(offset))
    }
    for (const offset of [9, 6, 3, 0]) {
      const before = await movingPython.boundingBox()
      await previous.click()
      await page.waitForTimeout(180)
      const after = await movingPython.boundingBox()
      assert.ok(after.x > before.x + 2, 'The left arrow moves the track right')
      await settle()
      assert.deepEqual(await names(), windowAt(offset))
    }
    await next.click()
    await previous.dispatchEvent('click')
    await settle()
    assert.deepEqual(await names(), windowAt(3), 'A click during an active transition cannot skip or reverse the current page')
    await previous.click()
    await settle()
    report('Both arrows move in the expected direction, reverse the same pages, and wrap without empty slots')

    await page.waitForTimeout(2000)
    await next.click()
    await settle()
    await page.waitForTimeout(2700)
    assert.deepEqual(await names(), windowAt(3), 'A manual step restarts the full waiting period')
    assert.equal(await page.locator('.learning-toolkit-track').getAttribute('data-moving'), 'false')
    await page.waitForFunction(() => document.querySelector('.learning-toolkit-track').dataset.moving === 'true')
    await settle()
    assert.deepEqual(await names(), windowAt(6))
    const manualDelay = await page.evaluate(() => window.toolkitStartTimes.at(-1) - window.toolkitStopTimes.at(-2))
    assert.ok(Math.abs(manualDelay - 3000) < 250, 'Autoplay waits three seconds after a manual movement ends')
    report('Manual navigation also waits a full three seconds after settling before autoplay resumes')

    await page.evaluate(() => {
      const bounds = document.querySelector('.learning-toolkit').getBoundingClientRect()
      scrollTo({ top: scrollY + bounds.top - innerHeight + bounds.height * 0.1, behavior: 'instant' })
    })
    const visibleFraction = await toolkit.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return (Math.min(innerHeight, bounds.bottom) - Math.max(0, bounds.top)) / bounds.height
    })
    assert.ok(visibleFraction > 0 && visibleFraction < 0.25, 'The toolkit is only partially visible')
    await page.waitForFunction(() => document.querySelector('.learning-toolkit-track').dataset.moving === 'true')
    await settle()
    assert.deepEqual(await names(), windowAt(9), 'Autoplay continues with less than 25 percent visible')
    await page.evaluate(() => {
      const bounds = document.querySelector('.learning-toolkit').getBoundingClientRect()
      scrollTo({ top: scrollY + bounds.top - innerHeight - 32, behavior: 'instant' })
    })
    await page.waitForTimeout(4000)
    assert.deepEqual(await names(), windowAt(9), 'Autoplay pauses only once the toolkit is fully outside the viewport')
    await toolkit.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelector('.learning-toolkit-track').dataset.moving === 'true')
    await settle()
    assert.deepEqual(await names(), windowAt(0), 'Autoplay resumes when the toolkit returns to the viewport')
    report('A partially visible toolkit continues autoplay; fully leaving and re-entering the viewport pauses and resumes it')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForTimeout(1000)
    assert.equal(await toolkit.getByRole('button', { name: /暂停工具轮播|播放工具轮播/ }).count(), 0)
    const reducedNames = await names()
    await page.waitForTimeout(3600)
    assert.deepEqual(await names(), reducedNames)
    await next.click()
    await settle()
    assert.notDeepEqual(await names(), reducedNames, 'Reduced motion retains manual navigation')
    assert.equal(await page.locator('.learning-toolkit-track').evaluate(element => getComputedStyle(element).transitionDuration), '0s')
    report('Reduced motion disables autoplay and animation while keeping manual browsing available')

    const snapshotDirectory = 'node_modules/.companion-tools/toolkit-previews'
    await mkdir(snapshotDirectory, { recursive: true })
    for (const width of [2496, 1920, 1440, 1100, 900, 701, 700, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 })
      await page.waitForTimeout(120)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}px`)
      const visible = await toolkit.locator('li[aria-hidden="false"]').count()
      const bounds = await toolkit.boundingBox()
      assert.equal(visible, bounds.width < 420 ? 3 : bounds.width < 620 ? 4 : 5, 'Each layout shows one more tool than before')
      assert.equal(await toolkit.locator('a[tabindex="0"]').count(), visible, 'Only visible tools are keyboard stops')
      for (let step = 0; step < 4; step++) {
        for (const item of await toolkit.locator('li[aria-hidden="false"]').all()) {
          const box = await item.boundingBox()
          assert.ok(box.x >= bounds.x - 1 && box.x + box.width <= bounds.x + bounds.width + 1, 'Each visible cell fits the viewport')
          for (const part of await item.locator('.learning-tool-icon, .learning-tool-name').all()) {
            const partBox = await part.boundingBox()
            assert.ok(partBox.x >= box.x && partBox.x + partBox.width <= box.x + box.width, `Icons and labels stay inside their cells at ${width}px`)
          }
        }
        await next.click()
      }
      const caption = await toolkit.locator('.learning-toolkit-caption').evaluate(element => {
        const style = getComputedStyle(element)
        const span = [...element.children].find(child => getComputedStyle(child).display !== 'none')
        const range = document.createRange()
        range.selectNodeContents(span)
        const textBounds = range.getBoundingClientRect()
        return { overflow: element.scrollWidth > element.clientWidth, lines: range.getClientRects().length, size: Number.parseFloat(style.fontSize), fill: textBounds.width / (element.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)) }
      })
      assert.equal(caption.overflow, false, `The English caption fits at ${width}px`)
      assert.equal(caption.lines, 1, 'The caption is a single English line')
      assert.ok(caption.size <= 12.8, 'The caption stays small relative to the logos')
      assert.ok(caption.fill > 0.95, 'The caption fills the available line')
      if ([2496, 1440, 390, 320].includes(width)) {
        await toolkit.screenshot({ path: `${snapshotDirectory}/toolkit-${width}.png` })
      }
      const brokenAssets = await page.evaluate(async () => {
        const urls = [...new Set([...document.querySelectorAll('.learning-tool-icon')].map(element => element.src))]
        return (await Promise.all(urls.map(async url => {
          const image = new Image()
          image.src = url
          try { await image.decode(); return null } catch { return url }
        }))).filter(Boolean)
      })
      assert.deepEqual(brokenAssets, [], 'Every local icon decodes')
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    const firstTool = toolkit.locator('li[aria-hidden="false"] a').first()
    await page.mouse.move(0, 0)
    await page.evaluate(() => document.activeElement.blur())
    await page.waitForTimeout(100)
    const darkIdle = await color(firstTool)
    await page.keyboard.press('Tab')
    await firstTool.focus()
    assert.notEqual(await color(firstTool), darkIdle)
    assert.deepEqual(errors, [])
    report('Nine viewport widths, dark theme, local SVG assets, and keyboard visibility pass without page errors')
  } finally {
    await context.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.LEARNING_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runLearningToolkitChecks(browser, process.env.LEARNING_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Learning toolkit checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
