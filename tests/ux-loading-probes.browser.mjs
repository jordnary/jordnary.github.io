import { mkdir, writeFile } from 'node:fs/promises'

// Diagnostic observations, not passing assertions: faults are intentionally injected.
const { chromium } = await import('playwright')
const browser = await chromium.launch({ channel: process.env.UX_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
const baseURL = process.env.UX_BASELINE_URL || 'http://127.0.0.1:4173/'
const results = []
const report = observation => { results.push(observation); console.log(JSON.stringify(observation)) }
const gate = () => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, release }
}
async function waitForGate(promise) {
  let timer
  try {
    await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Resource interception timed out')), 10000)
    })])
  } finally { clearTimeout(timer) }
}
const ui = page => page.evaluate(() => ({
  mainCount: document.querySelectorAll('main').length,
  rootChildren: document.querySelector('#site-scroll')?.childElementCount ?? 0,
  statusCount: document.querySelectorAll('[role="status"], [role="alert"]').length,
  homeVisible: Boolean(document.querySelector('.home-editorial')),
}))

async function routeProbe({ name, navigate, fail }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const release = gate()
  const requested = gate()
  let pageErrors = 0
  try {
    const page = await context.newPage()
    page.on('pageerror', () => pageErrors++)
    if (navigate) {
      await page.goto(new URL('/home/', baseURL).href, { waitUntil: 'domcontentloaded' })
      await page.locator('.home-editorial').waitFor()
    }
    await page.route('**/assets/ContactPage-*.js', async route => {
      requested.release()
      if (fail) await route.abort()
      else { await release.promise; await route.continue().catch(() => {}) }
    })
    if (navigate) await page.locator('a[href="/contact/"]').first().evaluate(element => element.click())
    else await page.goto(new URL('/contact/', baseURL).href, { waitUntil: 'commit' })
    await waitForGate(requested.promise)
    await page.waitForTimeout(700)
    report({ name, ...await ui(page), pageErrors })
    release.release()
    if (!fail) await page.waitForFunction(() => document.body.dataset.page === 'contact' && document.querySelector('main'))
  } finally { release.release(); await context.close() }
}

async function galleryProbe() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  const release = gate()
  let intermediateRequested = false
  try {
    const page = await context.newPage()
    await page.route('**/images/projects/vaegan-reconstructions.webp', async route => {
      intermediateRequested = true
      await release.promise
      await route.continue().catch(() => {})
    })
    await page.goto(new URL('/projects/vae-gan-digits/', baseURL).href, { waitUntil: 'domcontentloaded' })
    await page.locator('.project-reader-cover .project-reader-image-trigger').click()
    await page.locator('.yarl__slide_current img').evaluate(image => image.decode())
    await page.getByRole('button', { name: '第 7 张，共 7 张' }).click()
    await page.waitForTimeout(1000)
    const waiting = await page.evaluate(() => {
      const images = [...document.querySelectorAll('.yarl__slide img')]
      return {
        mountedOriginals: images.filter(image => new URL(image.src).pathname.startsWith('/images/projects/')).length,
        targetDecoded: images.some(image => image.src.endsWith('/vaegan-samples.webp') && image.complete && image.naturalWidth > 0),
        currentIsFirst: document.querySelector('.yarl__slide_current img')?.src.endsWith('/vaegan-poster.webp') ?? false,
        busyThumbnails: document.querySelectorAll('.yarl__thumbnails_thumbnail[aria-busy="true"]').length,
      }
    })
    report({ name: 'gallery-intermediate-stalled', intermediateRequested, ...waiting,
      closeEnabled: await page.getByRole('button', { name: '关闭图片预览' }).isEnabled() })
    release.release()
    await page.waitForFunction(() => document.querySelector('.yarl__slide_current img')?.src.endsWith('/vaegan-samples.webp'))
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: '图片浏览器' }).waitFor({ state: 'detached' })
  } finally { release.release(); await context.close() }
}

async function hubProbe() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })
  try {
    await context.addInitScript(() => {
      window.__uxHub = { frames: 0, draws: 0 }
      const raf = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = callback => raf(time => { window.__uxHub.frames++; callback(time) })
      const clear = CanvasRenderingContext2D.prototype.clearRect
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.classList.contains('homepage-hub-canvas')) window.__uxHub.draws++
        return clear.apply(this, args)
      }
    })
    const page = await context.newPage()
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
    await page.locator('.launch-intro-enter').click()
    await page.waitForFunction(() => document.querySelector('.homepage-portal')?.getAttribute('data-phase') === 'hub')
    await page.waitForTimeout(1000)
    const measure = async name => {
      await page.evaluate(() => { window.__uxHub = { frames: 0, draws: 0 } })
      await page.waitForTimeout(500)
      report({ name, sampleMs: 500, ...await page.evaluate(() => window.__uxHub) })
    }
    await measure('hub-active')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForTimeout(100)
    await measure('hub-reduced-motion')
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await measure('hub-synthetic-hidden')
  } finally { await context.close() }
}

async function bootProbe() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })
  try {
    await context.addInitScript(() => {
      window.__uxBoot = { statusAtMs: null, pageAtMs: null }
      const observer = new MutationObserver(() => {
        if (window.__uxBoot.statusAtMs === null && document.querySelector('#site-scroll [role="status"]')) {
          window.__uxBoot.statusAtMs = performance.now()
        }
        if (document.querySelector('main > :first-child')) {
          window.__uxBoot.pageAtMs = performance.now()
          observer.disconnect()
        }
      })
      observer.observe(document, { subtree: true, childList: true })
    })
    const page = await context.newPage()
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__uxBoot.pageAtMs !== null)
    const timings = await page.evaluate(() => window.__uxBoot)
    report({ name: 'normal-boot-status', ...timings,
      fallbackMs: timings.statusAtMs === null ? null : timings.pageAtMs - timings.statusAtMs })
  } finally { await context.close() }
}

try {
  for (const probe of [
    { name: 'cold-delayed', navigate: false, fail: false },
    { name: 'cold-failed', navigate: false, fail: true },
    { name: 'navigation-delayed', navigate: true, fail: false },
    { name: 'navigation-failed', navigate: true, fail: true },
  ]) await routeProbe(probe)
  await bootProbe()
  await galleryProbe()
  await hubProbe()
  await mkdir('node_modules/.cache', { recursive: true })
  await writeFile('node_modules/.cache/ux-loading-probes.json', `${JSON.stringify(results, null, 2)}\n`)
} finally { await browser.close() }
