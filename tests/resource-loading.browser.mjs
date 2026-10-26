import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

export async function runResourceLoadingChecks(browser, baseURL, report = () => {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const open = async path => page.goto(new URL(path, baseURL).href, { waitUntil: 'domcontentloaded' })
  try {
    await open('/')
    await page.locator('.launch-intro-enter').waitFor()
    const initialResources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name))
    assert.ok(!initialResources.some(name => /(?:LearningPage|ProjectStudioPage|ProjectDetailPage|HomePage)-/.test(name)))
    report('The portal does not download unrelated page modules')

    await open('/projects/studio/')
    await page.locator('.studio-gallery-frame img').first().evaluate(image => image.decode())
    assert.ok(await page.locator('.studio-gallery-frame img').evaluateAll(images =>
      images.some(image => !image.complete) && images.slice(0, 3).every(image => image.loading === 'eager')))
    assert.ok(await page.locator('.studio-gallery-frame img').first().evaluate(image => image.currentSrc.includes('/images/responsive/')))
    await page.locator('.studio-gallery-frame').last().scrollIntoViewIfNeeded()
    await page.locator('.studio-gallery-frame img').last().evaluate(image => image.decode())
    assert.ok(await page.locator('.studio-gallery-frame img').last().evaluate(image => image.naturalWidth > 0))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    report('The studio loads nearby display-sized images and loads the last artwork when reached')

    await open('/learning/')
    await page.locator('img.learning-cover-panorama').evaluate(image => image.decode())
    const hints = await page.locator('link[rel="preload"][as="image"]').evaluateAll(links => links.map(link => ({
      srcset: link.imageSrcset, sizes: link.imageSizes,
    })))
    assert.equal(hints.length, 2)
    const hero = await page.locator('img.learning-cover-panorama').evaluate(image => ({ srcset: image.srcset, sizes: image.sizes, src: image.currentSrc }))
    assert.ok(hints.some(hint => hint.srcset === hero.srcset && hint.sizes === hero.sizes))
    const fetchedCampus = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /hero-campus-(sketch|trees).*\.webp/.test(entry.name)).map(entry => entry.name))
    assert.equal(new Set(fetchedCampus).size, 2, 'Preloading must not also fetch the original image')
    report('First-screen image hints match the displayed sources without duplicate downloads')

    await open('/projects/vae-gan-digits/')
    await page.locator('.project-reader-cover .project-reader-image-trigger').click()
    const dialog = page.getByRole('dialog', { name: '图片浏览器' })
    await dialog.waitFor()
    assert.equal(await dialog.getByRole('navigation', { name: '图片缩略图' }).getByRole('button').count(), 7)
    assert.ok(await page.locator('.yarl__slide img').count() <= 3, 'Only the current and adjacent originals should be mounted')
    assert.ok(await page.locator('.yarl__thumbnails_thumbnail img').evaluateAll(images =>
      images.length > 0 && images.every(image => image.src.includes('/images/responsive/'))))
    await page.getByRole('button', { name: '第 7 张，共 7 张' }).click()
    await page.waitForFunction(() => {
      const image = document.querySelector('.yarl__slide_current img')
      return image?.src.endsWith('/vaegan-samples.webp') && image.complete && image.naturalWidth > 0
        && document.querySelectorAll('.yarl__slide img').length <= 3
        && !document.querySelector('.yarl__carousel').getAnimations().some(animation => animation.playState === 'running')
    })
    assert.ok(await page.locator('.yarl__slide_current img').evaluate(image => image.src.includes('/images/projects/')))
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
    assert.equal(await page.locator('.yarl__slide img').count(), 0)
    report('All thumbnail controls remain available; original images load on selection and unmount on close')

    // Exercise a slow first route import through the site's actual click handler.
    await open('/home/')
    await page.locator('.home-editorial').waitFor()
    await page.route('**/assets/ContactPage-*.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 400))
      await route.continue()
    })
    await page.evaluate(() => document.querySelector('a[href="/contact/"]').click())
    assert.equal(await page.locator('.home-editorial').count(), 1, 'The current page stays visible while the destination loads')
    await page.waitForFunction(() => document.body.dataset.page === 'contact')
    await page.goBack()
    await page.locator('.home-editorial').waitFor()
    assert.equal(await page.evaluate(() => document.body.dataset.page), 'home')
    assert.deepEqual(errors, [])
    report('Lazy navigation retains the current view and supports history return without browser errors')
  } finally { await context.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    await runResourceLoadingChecks(browser, process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4173/', message => console.log(`PASS: ${message}`))
  } catch (error) {
    console.error('Resource loading checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
