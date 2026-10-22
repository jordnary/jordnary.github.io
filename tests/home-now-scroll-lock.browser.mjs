import assert from 'node:assert/strict'

const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
const baseURL = process.env.HOME_EDITORIAL_TEST_URL || 'http://localhost:5173/'
const snapshot = {
  fetchedAt: '2026-10-22T01:00:00Z', profile: { followers: 0, publicRepos: 12 },
  repos: Array.from({ length: 12 }, (_, index) => ({ name: `example-${index}`, description: 'A quiet project in progress.',
    language: 'TypeScript', stars: 0, updatedAt: '2026-10-21T01:00:00Z', url: `https://example.com/${index}` })),
}

for (const classic of [true, false]) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    ...(classic ? { ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--disable-features=OverlayScrollbar,OverlayScrollbars'] } : {}),
  })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.addInitScript(() => {
      sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
      sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    })
    await page.route('**/data/github.json', route => route.fulfill({ json: snapshot }))
    await page.goto(new URL('home/', baseURL).href)
    const button = page.locator('#now .home-gallery-open').first()
    await button.scrollIntoViewIfNeeded()
    await page.waitForTimeout(2000)
    const gutter = await page.evaluate(() => innerWidth - document.documentElement.clientWidth)
    assert.ok(classic ? gutter > 0 : gutter === 0, 'Exercise both real and overlay scrollbar geometry')
    for (const closeMode of ['button', 'Escape']) {
      await page.evaluate(() => {
        const measure = () => {
          // The stationary wrapper excludes the intentional hover/focus scaling.
          const card = document.querySelector('#now .home-gallery-card').getBoundingClientRect()
          return { scrollX, scrollY, root: document.documentElement.clientWidth, body: document.body.clientWidth,
            height: document.documentElement.scrollHeight, x: card.x, y: card.y, width: card.width, cardHeight: card.height }
        }
        const check = window.__scrollLockCheck = { baseline: measure(), frames: [], running: true, frame: 0 }
        const record = () => {
          check.frames.push(measure())
          if (check.running) check.frame = requestAnimationFrame(record)
        }
        record()
      })
      await button.click()
      await page.waitForFunction(() => document.querySelector('.home-now-reader')?.dataset.phase === 'open')
      await page.mouse.move(20, 400)
      await page.mouse.wheel(0, 250)
      await page.waitForTimeout(100)
      if (classic) {
        const thumb = await page.evaluate(() => ({ x: innerWidth - (innerWidth - document.documentElement.clientWidth) / 2,
          top: scrollY / document.documentElement.scrollHeight * innerHeight }))
        await page.mouse.move(thumb.x, thumb.top + 40)
        await page.mouse.down()
        await page.mouse.move(thumb.x, thumb.top + 110, { steps: 12 })
        await page.mouse.up()
      }
      const scroll = page.locator('.home-now-reader-scroll')
      await scroll.focus()
      await page.keyboard.press('PageDown')
      await page.waitForTimeout(120)
      assert.ok(await scroll.evaluate(element => element.scrollTop > 0), 'The reading area still scrolls')
      if (closeMode === 'button') await page.locator('.home-now-close').click()
      else await page.keyboard.press('Escape')
      await page.waitForSelector('.home-now-reader', { state: 'detached' })
      await page.waitForTimeout(700)
      const result = await page.evaluate(() => {
        const check = window.__scrollLockCheck; check.running = false; cancelAnimationFrame(check.frame); return check
      })
      for (const frame of result.frames) for (const [key, expected] of Object.entries(result.baseline)) {
        assert.ok(Math.abs(frame[key] - expected) <= 1, `${classic ? 'Classic' : 'Overlay'} / ${closeMode}: ${key} shifted by ${frame[key] - expected}`)
      }
      assert.ok(await button.evaluate(element => document.activeElement === element), 'Closing restores focus to the source card')
      console.log(`PASS: ${classic ? 'classic' : 'overlay'} scrollbar, ${closeMode} close; ${result.frames.length} frames preserve page geometry and scrolling`)
    }
  } finally { await browser.close() }
}
