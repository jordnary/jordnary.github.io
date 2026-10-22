import assert from 'node:assert/strict'

const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  await page.addInitScript(() => sessionStorage.setItem('site-live2d-collapsed-desktop', 'true'))
  await page.route('**/data/github.json', route => route.fulfill({ json: {
    fetchedAt: '2026-10-22T01:00:00Z', profile: { followers: 0, publicRepos: 2 },
    repos: ['garden-notes', 'small-discoveries'].map(name => ({ name, description: 'Small ideas, growing slowly.', language: 'TypeScript', stars: 0, updatedAt: '2026-10-22T01:00:00Z', url: `https://github.com/example/${name}` })),
  } }))
  await page.goto(new URL('home/', process.env.HOME_EDITORIAL_TEST_URL || 'http://localhost:5173/').href)
  await page.locator('#now .home-gallery-open').first().click()
  await page.waitForFunction(() => document.querySelector('.home-now-reader')?.dataset.phase === 'open')
  await page.locator('.github-repository').first().waitFor()
  await page.evaluate(async () => {
    await document.fonts.ready
    const scroll = document.querySelector('.home-now-reader-scroll')
    scroll.scrollTop += document.querySelector('.live-updates-toolbar').getBoundingClientRect().top - scroll.getBoundingClientRect().top - 20
  })
  const rows = page.locator('.github-repository')
  const ornaments = page.locator('.github-repository-ornament')
  const read = element => {
    const values = getComputedStyle(element).clipPath.match(/-?[\d.]+(?:e[+-]?\d+)?/gi)?.map(Number) || []
    const right = values[1] ?? 0
    return { left: values[3] ?? right, end: 100 - right, animations: element.getAnimations().length }
  }
  const settle = async () => {
    await page.waitForFunction(() => [...document.querySelectorAll('.github-repository-ornament')].every(element => element.getAnimations().length === 0))
  }
  const beginRecording = async () => page.evaluate(() => {
    const record = window.__ornamentRecording = { frames: [], frame: 0 }
    const sample = () => {
      record.frames.push([...document.querySelectorAll('.github-repository-ornament')].map(element => {
        const values = getComputedStyle(element).clipPath.match(/-?[\d.]+(?:e[+-]?\d+)?/gi)?.map(Number) || []
        const right = values[1] ?? 0
        return { left: values[3] ?? right, end: 100 - right }
      }))
      record.frame = requestAnimationFrame(sample)
    }
    sample()
  })
  const checkRecording = async label => {
    const frames = await page.evaluate(() => {
      const record = window.__ornamentRecording
      cancelAnimationFrame(record.frame)
      return record.frames
    })
    assert.ok(frames.length > 5, `${label}: capture actual animation frames`)
    for (let frame = 1; frame < frames.length; frame++) {
      for (let row = 0; row < 2; row++) {
        const previous = frames[frame - 1][row]
        const current = frames[frame][row]
        const bothVisible = previous.end - previous.left > .5 && current.end - current.left > .5
        const overlap = current.end > previous.left + .5
        // A fresh pass can start at the left after the old pass has cleared on the right.
        // Within a visible pass, restoring pixels to its left is a backwards reveal.
        assert.ok(!bothVisible || !overlap || current.left >= previous.left - .25,
          `${label}: row ${row + 1} reveals backwards at frame ${frame}`)
      }
    }
    console.log(`PASS: ${label}; ${frames.length} frames preserve left-to-right reveals`)
  }

  await rows.nth(0).hover()
  await settle()
  await beginRecording()
  await rows.nth(1).hover()
  await page.waitForTimeout(140)
  const leaving = await ornaments.nth(0).evaluate(read)
  assert.ok(leaving.left > 0 && leaving.end > leaving.left, 'Re-enter while the first row is visibly exiting')
  await rows.nth(0).hover()
  await settle()
  await checkRecording('re-enter during an unfinished exit')

  await beginRecording()
  for (const delay of [35, 65, 100, 180, 45, 90, 40, 140]) {
    await rows.nth(1).hover()
    await page.waitForTimeout(delay)
    await rows.nth(0).hover()
    await page.waitForTimeout(delay)
  }
  await settle()
  await checkRecording('rapid alternation between adjacent rows')
  const final = await ornaments.evaluateAll(elements => elements.map(element => {
    const values = getComputedStyle(element).clipPath.match(/-?[\d.]+(?:e[+-]?\d+)?/gi)?.map(Number) || []
    const right = values[1] ?? 0
    return 100 - right - (values[3] ?? right)
  }))
  assert.ok(final[0] > 99.9 && final[1] < .1, 'Only the latest hovered row remains visible')

  await rows.nth(1).hover()
  await page.waitForTimeout(100)
  await rows.nth(0).hover()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await settle()
  assert.deepEqual(await ornaments.nth(0).evaluate(read), { left: 0, end: 100, animations: 0 })
  assert.equal(await ornaments.nth(1).evaluate(element => element.getAnimations().length), 0)
  await page.mouse.move(0, 0)
  await page.locator('.live-refresh-button').focus()
  await page.keyboard.press('Tab')
  assert.equal(await rows.nth(0).evaluate(element => element.matches(':focus-visible')), true)
  assert.deepEqual(await ornaments.nth(0).evaluate(read), { left: 0, end: 100, animations: 0 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.keyboard.press('Tab')
  await page.waitForTimeout(90)
  await page.keyboard.press('Escape')
  await page.locator('.home-now-reader').waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.effect?.target?.classList?.contains('github-repository-ornament')).length), 0)
  console.log('PASS: latest hover state, reduced motion, keyboard focus and closing during an animation')
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { await browser.close() }
