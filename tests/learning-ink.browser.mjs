import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// Render the production mask over solid ink so a leaking atlas row cannot hide
// in the tower's fine lines. Disable any secondary clip: the mask itself must
// keep its tail transparent when composited with moving child layers.
export async function runLearningInkChecks(browser, baseURL, report = () => {}) {
  let frames = 0
  for (const { width, height, scale } of [
    { width: 286.39, height: 481.125, scale: 1 },
    { width: 600, height: 913.37, scale: 1.25 },
    { width: 766.67, height: 1288.0156, scale: 1.5 },
    { width: 766.67, height: 1288.0156, scale: 2 },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 1450 }, deviceScaleFactor: scale })
    try {
      const page = await context.newPage()
      await page.goto(new URL('learning/', baseURL).href)
      await page.locator('.learning-ink-reveal').waitFor({ state: 'attached' })
      await page.evaluate(async ({ width, height }) => {
        const atlas = new Image()
        atlas.src = '/images/learning/hero-ink-edge-atlas.png'
        await atlas.decode()
        const fixture = document.createElement('div')
        fixture.id = 'ink-mask-fixture'
        fixture.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:white;'
        const mask = document.createElement('div')
        mask.className = 'learning-ink-reveal'
        mask.id = 'ink-test-mask'
        mask.style.cssText = `top:0;left:0;width:${width}px;height:${height}px;background:black;transform:translateY(.37px);clip-path:none;`
        fixture.append(mask)
        document.body.append(fixture)
      }, { width, height })
      for (const counterTransform of [false, true]) {
        if (counterTransform) {
          await page.evaluate(({ width, height }) => {
            const mask = document.querySelector('#ink-test-mask')
            const art = document.createElement('div')
            art.className = 'learning-ink-art'
            art.style.cssText = `width:${width}px;height:${height / 1.4}px;margin:0;`
            mask.before(art)
            art.append(mask)
            mask.style.top = '-20%'
            mask.style.background = 'transparent'
            const composition = document.createElement('div')
            composition.className = 'learning-ink-composition'
            composition.style.background = 'black'
            mask.append(composition)
          }, { width, height })
        }
        for (let frame = 0; frame < 32; frame++) {
          const maskTop = await page.locator('#ink-test-mask').evaluate((element, { frame, counterTransform }) => {
            element.style.setProperty('--ink-frame', String(frame))
            if (counterTransform) {
              const progress = (.18 + frame / 31 * .5) / .94
              element.style.transform = `translateY(${-90 * (1 - progress)}%)`
              element.firstElementChild.style.transform = `translateY(${126 * (1 - progress)}%)`
            }
            return element.getBoundingClientRect().top
          }, { frame, counterTransform })
          const top = Math.max(2, Math.floor(maskTop + height * .84))
          const bottom = counterTransform ? height / 1.4 : maskTop + height
          const png = await page.screenshot({ clip: { x: 10, y: top, width: Math.floor(width) - 20, height: Math.ceil(bottom - top + 4) } })
          const pixels = await page.evaluate(async ({ source, top, maskTop, height, scale }) => {
            const image = new Image()
            image.src = source
            await image.decode()
            const canvas = document.createElement('canvas')
            canvas.width = image.width
            canvas.height = image.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(image, 0, 0)
            const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
            let tailInk = 0
            let solidGap = 0
            let edgeInk = 0
            let edgePaper = 0
            for (let y = 0; y < canvas.height; y++) {
              const position = top + (y + .5) / scale - maskTop
              for (let x = 0; x < canvas.width; x++) {
                const red = data[(y * canvas.width + x) * 4]
                if (position >= height * (1348 / 1400)) tailInk = Math.max(tailInk, 255 - red)
                // The opaque region must also stay seamless where it joins the band.
                if (position < height * (1202 / 1400)) solidGap = Math.max(solidGap, red)
                if (position > height * .89 && position < height * .92) {
                  if (red < 32) edgeInk++
                  if (red > 223) edgePaper++
                }
              }
            }
            return { tailInk, solidGap, edgeInk, edgePaper }
          }, { source: `data:image/png;base64,${png.toString('base64')}`, top, maskTop, height, scale })
          const sample = `frame ${frame}, height ${height}, pixel ratio ${scale}, counter-transform ${counterTransform}`
          assert.equal(pixels.tailInk, 0, `No stray ink below the erosion edge (${sample})`)
          assert.equal(pixels.solidGap, 0, `No gap above the erosion edge (${sample})`)
          assert.ok(pixels.edgeInk > 0 && pixels.edgePaper > 0, `The irregular reveal remains visible (${sample})`)
          frames++
        }
      }
      report(`All 32 ink frames remain clean with and without counter-transformed artwork at pixel ratio ${scale}`)
    } finally {
      await context.close()
    }
  }
  return frames
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.LEARNING_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const frames = await runLearningInkChecks(browser, process.env.LEARNING_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${frames} ink mask frames checked`)
  } catch (error) {
    console.error('Learning ink checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
