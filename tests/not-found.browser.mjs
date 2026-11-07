import assert from 'node:assert/strict'
import { preview } from 'vite'
import { chromium } from 'playwright'

const server = await preview({ logLevel: 'silent', build: { outDir: 'node_modules/.cache/production-preview' },
  preview: { host: '127.0.0.1', port: 0 } })
const origin = `http://127.0.0.1:${server.httpServer.address().port}`
const missing = `${origin}/missing/nested/document.html?from=test`
const desktop = { width: 1440, height: 826 }

async function resize(page, viewport) {
  await page.setViewportSize(viewport)
  // Viewport layout and its observers run on the browser's rendering clock;
  // let the new walls commit before advancing the animation clock.
  await page.evaluate(() => new Promise(resolve => {
    const observer = new ResizeObserver(() => { observer.disconnect(); resolve() })
    observer.observe(document.querySelector('.not-found-digits'))
  }))
}

// A rotated path's client rect encloses its unrotated bounding box too. Sample
// the actual ink to check the floor, edges and visual centre of the pile.
const ink = page => page.locator('.not-found-digits path').evaluateAll(paths => paths.map(path => {
  const matrix = path.getScreenCTM(), length = path.getTotalLength()
  const points = Array.from({ length: 180 }, (_, i) => path.getPointAtLength(length * i / 180).matrixTransform(matrix))
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)),
    angle: Math.atan2(matrix.b, matrix.a), visible: getComputedStyle(path).visibility !== 'hidden' }
}))

async function checkLayout(page) {
  assert.ok(await page.locator('.not-found').evaluate(scene => {
    const r = scene.getBoundingClientRect(), header = document.querySelector('.nav-shell').getBoundingClientRect()
    const nav = document.querySelector('.nav-content').getBoundingClientRect()
    const scroll = document.querySelector('#site-scroll')
    return r.top === 0 && r.left === 0 && r.width === innerWidth && Math.abs(r.height - innerHeight) <= 1
      && header.left === 0 && header.right === innerWidth && nav.left <= 32 && innerWidth - nav.right <= 32
      && document.documentElement.scrollHeight <= innerHeight + 1 && scroll.scrollHeight <= r.height + 1
  }), 'The stage fills the viewport and the menu reaches both gutters')
  assert.equal(await page.locator('main :is(a,button), .not-found-curtain, .not-found-counter').count(), 0)
}

async function checkEntry(page) {
  await page.getByRole('heading', { name: /404.*wasn’t found/ }).waitFor()
  assert.equal(page.url(), missing)
  assert.equal(await page.locator('nav [aria-current="page"]').count(), 0)
  const start = await ink(page)
  assert.ok(start.every(d => d.bottom < desktop.height * .15), 'The whole stack starts at the top')
  await page.clock.runFor(1050)
  const falling = await ink(page)
  assert.ok(falling[2].bottom > desktop.height * .2 && falling[2].bottom < desktop.height * .8
    && falling[0].bottom < 0, 'The leading four enters before the other two')
}

let browser
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL })
  const page = await browser.newPage({ viewport: desktop })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2025-01-01T00:00:05Z'))
  assert.equal((await page.goto(missing)).status(), 404)
  await checkEntry(page)
  await checkLayout(page)
  await page.clock.runFor(13000)
  const rest = await ink(page)
  const centre = (Math.min(...rest.map(d => d.left)) + Math.max(...rest.map(d => d.right))) / 2
  assert.ok(rest.every(d => Math.abs(d.bottom - desktop.height) < 6) && Math.abs(centre / desktop.width - .5) < .07,
    'The desktop pile rests near the centre of the floor')
  assert.ok(rest[0].left < rest[1].left && rest[1].left < rest[2].left, 'The desktop release favours 404')
  await page.clock.runFor(400)
  assert.deepEqual(await ink(page), rest, 'The digits stop moving at rest')

  // Contract the right wall continuously, then abruptly pull the floor out
  // from under the pile. No resize should replay the entrance or respawn it.
  let lifted = false
  for (let width = desktop.width - 36; width >= 576; width -= 36) {
    await resize(page, { width, height: desktop.height })
    await page.clock.runFor(70)
    lifted ||= (await ink(page)).some(d => d.top < Math.min(...rest.map(r => r.top)) - 20)
  }
  const compressed = await ink(page)
  assert.ok(compressed.some((d, i) => Math.abs(d.angle - rest[i].angle) > .12), 'The moving wall tips the digits')
  assert.ok(lifted, 'The narrowing walls lift the pile')
  await resize(page, { width: 440, height: 280 })
  await page.clock.runFor(4200)
  const escaped = (await ink(page)).filter(d => !d.visible).length
  assert.ok(escaped > 0, 'An unsupported digit can fall past the floor')
  await resize(page, desktop)
  await page.clock.runFor(800)
  assert.ok((await ink(page)).filter(d => !d.visible).length >= escaped, 'Expanding does not return lost digits')

  assert.equal((await page.reload()).status(), 404)
  await checkEntry(page)
  await page.getByRole('link', { name: '联系', exact: true }).evaluate(a => a.click())
  await page.waitForURL(origin + '/contact/')
  // Exercise the site's normal link handler with a broken same-origin link.
  await page.locator('main').evaluate((main, href) => {
    const a = document.createElement('a')
    a.href = href; a.textContent = 'Missing document'; main.append(a); a.click()
  }, missing)
  await page.waitForURL(missing)
  await checkEntry(page)

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true,
    hasTouch: true, reducedMotion: 'reduce' })
  mobile.on('pageerror', e => errors.push(e.message))
  assert.equal((await mobile.goto(missing)).status(), 404)
  await mobile.locator('.not-found-digits[viewBox]').waitFor()
  await checkLayout(mobile)
  const compact = await ink(mobile)
  assert.ok(compact.every(d => d.visible && d.top > 500 && d.bottom <= 846), 'Reduced motion opens on the settled pile')
  assert.ok(compact.some((d, i) => Math.abs(Math.sin(d.angle - rest[i].angle)) > .2),
    'A narrow viewport resolves different contacts, not a scaled copy of the desktop poses')
  await mobile.getByRole('button', { name: '打开导航菜单' }).click()
  await mobile.getByRole('button', { name: '关闭导航菜单' }).click()
  assert.deepEqual(await ink(mobile), compact)
  assert.deepEqual(errors, [])
  console.log('Passed: direct, reload and link entry; full viewport; responsive contacts, resize and escape; reduced motion and mobile menu')
} finally {
  await browser?.close()
  await server.close()
}
