import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const dialogFor = page => page.getByRole('dialog', { name: '图片浏览器' })
const thumbnail = (page, index) => page.getByRole('button', { name: `第 ${index + 1} 张，共 7 张` })
const imageFiles = ['vaegan-poster.webp', 'vaegan-comparison.webp', 'vaegan-training.webp', 'vaegan-reconstructions.webp',
  'vaegan-ablation.webp', 'vaegan-grids.webp', 'vaegan-samples.webp']
const ready = (page, file) => page.waitForFunction(file => {
  const image = document.querySelector('.yarl__slide_current img')
  return image?.src.endsWith(file) && image.complete && image.naturalWidth > 0
    && Number(getComputedStyle(image).opacity) > 0
    && !document.querySelector('.yarl__carousel').getAnimations().some(animation => animation.playState === 'running' || animation.pending)
    && document.querySelectorAll('.yarl__slide img').length <= 3
}, file)

async function startProbe(page) {
  await page.evaluate(() => {
    const probe = window.galleryJumpProbe = { frames: [], frame: 0 }
    const sample = () => {
      const stage = document.querySelector('.gallery-stage')
      const bounds = stage.getBoundingClientRect()
      const visible = [...stage.querySelectorAll('img')].filter(image => {
        const box = image.getBoundingClientRect()
        let opacity = 1
        for (let element = image; element && element !== stage; element = element.parentElement) opacity *= Number(getComputedStyle(element).opacity)
        return image.complete && image.naturalWidth > 0 && opacity > .01
          && box.right > bounds.left + 2 && box.left < bounds.right - 2 && box.bottom > bounds.top && box.top < bounds.bottom
      })
      const area = image => {
        const box = image.getBoundingClientRect()
        return Math.max(0, Math.min(box.right, bounds.right) - Math.max(box.left, bounds.left))
          * Math.max(0, Math.min(box.bottom, bounds.bottom) - Math.max(box.top, bounds.top))
      }
      visible.sort((a, b) => area(b) - area(a))
      probe.frames.push({ visible: visible.length, dominant: visible[0]?.src.split('/').at(-1)?.replace(/-[a-f0-9]{12}-\d+(?=\.webp$)/, ''),
        originals: stage.querySelectorAll('.gallery-original').length,
        ...(!visible.length ? { geometry: { stage: bounds.toJSON(), carousel: stage.querySelector('.yarl__carousel')?.getBoundingClientRect().toJSON(),
          slides: [...stage.querySelectorAll('.yarl__slide')].map(slide => ({ label: slide.getAttribute('aria-label'), x: slide.getBoundingClientRect().x })) }, blankSlides: [...stage.querySelectorAll('.yarl__slide')].filter(slide => {
          const box = slide.getBoundingClientRect(); return box.right > bounds.left && box.left < bounds.right
        }).map(slide => ({ label: slide.getAttribute('aria-label'), images: [...slide.querySelectorAll('img')].map(image => ({
          file: image.src.split('/').at(-1), complete: image.complete, width: image.naturalWidth,
          opacity: getComputedStyle(image).opacity, visibility: getComputedStyle(image).visibility,
        })) })) } : {}) })
      probe.frame = requestAnimationFrame(sample)
    }
    sample()
  })
}

async function assertNoBlank(page, label, expected) {
  const frames = await page.evaluate(() => {
    cancelAnimationFrame(window.galleryJumpProbe.frame)
    return window.galleryJumpProbe.frames
  })
  assert.ok(frames.length > 5, `${label} samples multiple rendered frames`)
  assert.ok(frames.every(frame => frame.visible > 0), `${label}: ${frames.filter(frame => !frame.visible).length} blank frames; ${JSON.stringify(frames.find(frame => !frame.visible))}`)
  const sequence = frames.map(frame => frame.dominant).filter((file, index, all) => file && file !== all[index - 1])
  if (expected) assert.deepEqual(sequence, expected, `${label} visibly travels through every intermediate image in order`)
  assert.ok(frames.every(frame => frame.originals <= 3), `${label} stays within the original-image budget throughout travel`)
  assert.equal(await page.locator('[aria-busy="true"]').count(), 0, 'Loading feedback clears after selection settles')
  return sequence
}

export async function runGalleryTraversalChecks(browser, baseURL, report = () => {}) {
  const errors = []
  const open = async context => {
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(new URL('projects/vae-gan-digits/', baseURL).href)
    await page.locator('.project-reader-cover .project-reader-image-trigger').click()
    await ready(page, '/vaegan-poster.webp')
    return page
  }
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  try {
    const page = await open(desktop)
    for (const [index, file] of [[6, '/vaegan-samples.webp'], [0, '/vaegan-poster.webp']]) {
      await startProbe(page)
      await thumbnail(page, index).click()
      await ready(page, file)
      await assertNoBlank(page, `Distant selection ${index + 1}`, index === 6 ? imageFiles : [...imageFiles].reverse())
    }
    report('First-to-last and last-to-first selections display every intermediate image in order without a blank frame')
    await startProbe(page)
    await thumbnail(page, 6).click()
    await page.waitForFunction(() => document.querySelector('.yarl__carousel').getAnimations().some(animation => animation.playState === 'running'))
    await page.waitForTimeout(700)
    await thumbnail(page, 1).evaluate(button => button.click())
    await ready(page, '/vaegan-comparison.webp')
    const reversed = await assertNoBlank(page, 'Reversing an active multi-image traversal')
    assert.equal(reversed.at(-1), imageFiles[1])
    assert.ok(reversed.length >= 3, 'The reversal includes visible movement before settling')
    await thumbnail(page, 0).click()
    await ready(page, '/vaegan-poster.webp')
    report('A new selection during motion reverses the visible path without dropping its already-visible images')
    await thumbnail(page, 1).click()
    assert.ok(await page.locator('.yarl__carousel').evaluate(element => element.getAnimations().some(animation => animation.playState === 'running')),
      'Adjacent thumbnail selection retains its normal slide animation')
    await ready(page, '/vaegan-comparison.webp')
    await page.keyboard.press('Escape')
    await dialogFor(page).waitFor({ state: 'detached' })
  } finally { await desktop.close() }

  const slow = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  let release
  const gate = new Promise(resolve => { release = resolve })
  try {
    await slow.route('**/images/projects/vaegan-samples.webp', async route => { await gate; await route.continue().catch(() => {}) })
    const page = await open(slow)
    await startProbe(page)
    await thumbnail(page, 6).click()
    await page.waitForFunction(() => document.querySelector('.yarl__slide_current .gallery-preview')?.complete)
    await page.waitForTimeout(500)
    assert.equal(await thumbnail(page, 6).getAttribute('aria-current'), 'true')
    assert.ok(await page.locator('.yarl__slide_current .gallery-preview').evaluate(image => image.src.includes('vaegan-samples-') && image.complete && image.naturalWidth > 0),
      'The target preview is available without waiting for its original')
    await thumbnail(page, 3).click()
    await ready(page, '/vaegan-reconstructions.webp')
    release()
    await page.waitForTimeout(150)
    await ready(page, '/vaegan-reconstructions.webp')
    const sequence = await assertNoBlank(page, 'Slow original and rapid reselection')
    assert.equal(sequence.at(-1), imageFiles[3])
    report('A slow target uses its preview; reselection plays the latest path and ignores the abandoned original')
  } finally { release(); await slow.close() }

  const failed = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  try {
    await failed.route('**/images/projects/vaegan-samples.webp', route => route.abort())
    const page = await open(failed)
    await thumbnail(page, 6).click()
    await page.locator('.yarl__slide_current .gallery-error').waitFor()
    await dialogFor(page).getByRole('button', { name: '关闭图片预览' }).click()
    await dialogFor(page).waitFor({ state: 'detached' })
    report('A failed target shows the existing error fallback and closing remains available')
  } finally { await failed.close() }

  const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' })
  try {
    const page = await open(mobile)
    for (const [index, file] of [[3, '/vaegan-reconstructions.webp'], [0, '/vaegan-poster.webp']]) {
      await startProbe(page)
      await thumbnail(page, index).tap()
      await ready(page, file)
      await assertNoBlank(page, `Touch selection ${index + 1}`, index === 3 ? imageFiles.slice(0, 4) : imageFiles.slice(0, 4).reverse())
    }
    assert.equal(await page.getByRole('button', { name: /上一张图片|下一张图片/ }).count(), 0)
    report('Touch thumbnail selections travel through intermediate images without reintroducing navigation arrows')
  } finally { await mobile.close() }
  assert.deepEqual(errors, [], 'Thumbnail selection causes no browser errors')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
  try {
    await runGalleryTraversalChecks(browser, process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
  } catch (error) {
    console.error('Gallery thumbnail traversal checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
