import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

export async function runGalleryScrollLockChecks(browser, baseURL, classic, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const frames = count => page.evaluate(total => new Promise(resolve => {
    const tick = () => --total <= 0 ? resolve() : requestAnimationFrame(tick)
    requestAnimationFrame(tick)
  }), count)
  try {
    for (const source of ['cover', 'article']) {
      const path = source === 'cover' ? 'projects/vae-gan-digits/' : 'projects/triton-attention-optimization/#project-sparsity'
      await page.goto(new URL(path, baseURL).href)
      await page.evaluate(() => document.fonts.ready)
      await page.locator('.project-reader img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
      const trigger = source === 'cover'
        ? page.locator('.project-reader-cover .project-reader-image-trigger')
        : page.locator('.project-introduction-figure .project-reader-image-trigger').last()
      await trigger.scrollIntoViewIfNeeded()
      await frames(4)
      const gutter = await page.evaluate(() => innerWidth - document.documentElement.clientWidth)
      assert.ok(classic ? gutter > 0 : gutter === 0, 'Use the intended native scrollbar geometry')
      if (source === 'article') {
        assert.ok(await page.locator('.project-reader-scroll').evaluate(element => element.scrollTop > 0),
          'Exercise an image reached by scrolling inside the article')
      }

      for (const closeMode of ['button', 'Escape']) {
        await page.evaluate(() => {
          const measure = () => {
            const body = document.querySelector('.project-reader-scroll')
            const result = { scrollX, scrollY, article: body.scrollTop, rootWidth: document.documentElement.clientWidth,
              bodyWidth: document.body.clientWidth, pageHeight: document.documentElement.scrollHeight }
            for (const selector of ['.project-reader-header', '.project-reader-layout', '.project-introduction', '.archive-menu-toggle']) {
              const rect = document.querySelector(selector).getBoundingClientRect()
              for (const key of ['x', 'y', 'width', 'height']) result[`${selector}:${key}`] = rect[key]
            }
            return result
          }
          const probe = window.galleryScrollProbe = { baseline: measure(), frames: [], running: true, frame: 0 }
          const record = () => {
            probe.frames.push(measure())
            if (probe.running) probe.frame = requestAnimationFrame(record)
          }
          record()
        })
        await trigger.click()
        const dialog = page.getByRole('dialog', { name: '图片浏览器' })
        await dialog.waitFor()
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.image-gallery')).opacity === '1')
        await page.locator('.yarl__container').focus()
        await page.keyboard.press('PageDown')
        await frames(5)
        await page.mouse.move(20, 400)
        await page.mouse.wheel(0, 240)
        await frames(5)
        if (classic) {
          const thumb = await page.evaluate(() => ({ x: innerWidth - (innerWidth - document.documentElement.clientWidth) / 2,
            y: scrollY / document.documentElement.scrollHeight * innerHeight + 30 }))
          await page.mouse.move(thumb.x, thumb.y)
          await page.mouse.down()
          await page.mouse.move(thumb.x, thumb.y + 100, { steps: 10 })
          await page.mouse.up()
        }
        if (closeMode === 'button') await dialog.getByRole('button', { name: '关闭图片预览' }).click()
        else await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'detached' })
        await frames(8)
        const result = await page.evaluate(() => {
          const probe = window.galleryScrollProbe
          probe.running = false
          cancelAnimationFrame(probe.frame)
          return { baseline: probe.baseline, frames: probe.frames }
        })
        for (const frame of result.frames) for (const [key, expected] of Object.entries(result.baseline)) {
          assert.ok(Math.abs(frame[key] - expected) <= 1,
            `${classic ? 'Classic' : 'Overlay'} / ${source} / ${closeMode}: ${key} shifted by ${frame[key] - expected}`)
        }
        assert.ok(await trigger.evaluate(element => document.activeElement === element), 'Closing restores opener focus')
        assert.equal(await page.locator('#root').evaluate(element => element.inert), false)
        report(`${classic ? 'Classic' : 'Overlay'} scrollbar, ${source}, ${closeMode}: every frame preserves layout and both reading positions`)
      }
      const before = await page.evaluate(() => scrollY)
      await page.mouse.move(20, 400)
      await page.mouse.wheel(0, 180)
      await page.waitForFunction(previous => scrollY > previous, before)
    }
    assert.deepEqual(errors, [], 'Scroll locking causes no browser errors')
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  for (const classic of [true, false]) {
    const browser = await chromium.launch({ headless: true,
      ...(process.env.PROJECTS_BROWSER_EXECUTABLE ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE }
        : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge' }),
      ...(classic ? { ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--disable-features=OverlayScrollbar,OverlayScrollbars'] } : {}),
    })
    try {
      await runGalleryScrollLockChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/', classic,
        name => console.log(`PASS: ${name}`))
    } catch (error) {
      console.error('Gallery scroll lock checks failed:', error.message)
      process.exitCode = 1
      break
    } finally { await browser.close() }
  }
}
