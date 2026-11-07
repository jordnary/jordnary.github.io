import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import sharp from 'sharp'
import { routeCases, contentReady, connectionState } from './page-resources.browser.mjs'

// Compare actual production previews; keep full-resolution evidence out of Git.
const output = 'node_modules/.cache/p6/visual'
const versions = [process.env.RESOURCE_BASELINE_URL, process.env.PERFORMANCE_TEST_URL]
assert.ok(versions.every(Boolean) && versions[0] !== versions[1], 'Supply two distinct preview URLs')
const options = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')))
const only = (key, value) => !options.has(key) || options.get(key).split(',').includes(value)
const checked = []
const failures = []
const views = [['desktop', 1440, 900], ['mobile', 390, 844], ['landscape', 844, 390]]
await mkdir(output, { recursive: true })
let fixedTime
for (const name of ['github', 'rss']) {
  const snapshots = await Promise.all(versions.map(async base => {
    const res = await fetch(new URL('data/' + name + '.json', base))
    assert.ok(res.ok)
    return res.json()
  }))
  assert.deepEqual(...snapshots)
  if (name === 'github') fixedTime = new Date(snapshots[0].fetchedAt)
}
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL })
try {
  for (const [view, width, height] of views.filter(([v]) => only('view', v))) {
    for (const [path, selector, route] of routeCases.filter(([, , route]) => only('route', route))) {
      for (const [i, base] of versions.entries()) {
        const version = i === 0 ? 'before' : 'after'
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: view === 'desktop' ? 1 : 3,
          isMobile: view !== 'desktop', hasTouch: view !== 'desktop', reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' })
        try {
          await context.addInitScript(connectionState, { saveData: true })
          await context.addInitScript(() => {
            let seed = 12345
            Math.random = () => (seed = seed * 16807 % 2147483647) / 2147483647
          })
          const page = await context.newPage()
          const errors = []
          page.on('pageerror', () => errors.push('pageerror'))
          if (route === 'HomePage') await page.clock.setFixedTime(fixedTime)
          await page.goto(new URL(path, base).href)
          await contentReady(page, selector)
          assert.deepEqual(await page.locator('main img').evaluateAll(images => images.filter(img => {
            const r = img.getBoundingClientRect()
            return img.currentSrc && r.width && r.height && r.top < innerHeight && r.bottom > 0 &&
              r.left < innerWidth && r.right > 0 && img.complete && !img.naturalWidth
          }).map(img => new URL(img.currentSrc).pathname)), [], 'Visible image failed to decode')
          const capture = async (scene, { settle = true } = {}) => {
            if (settle) {
              await page.evaluate(async () => {
                await document.fonts.ready
                for (const anim of document.getAnimations()) {
                  // Do not fast-forward application timers or change DOM visibility.
                  if (!anim.effect?.target) continue
                  const end = anim.effect.getComputedTiming().endTime
                  if (!Number.isFinite(end)) { anim.pause(); anim.currentTime = 0 }
                }
              })
              await page.waitForTimeout(350)
            }
            const prefix = `${output}/${view}-${scene}`
            const png = await page.screenshot({ path: prefix + '-' + version + '.png' })
            if (i) {
              const [before, after] = await Promise.all([prefix + '-before.png', png].map(input => sharp(input).removeAlpha().raw().toBuffer()))
              assert.equal(before.length, after.length)
              let changed = 0
              for (let n = 0; n < after.length; n += 3) {
                if ([0, 1, 2].some(c => Math.abs(before[n+c] - after[n+c]) > 8)) changed++
              }
              checked.push({ view, scene, changed, total: after.length / 3 })
              console.log(`${view} ${scene}: ${(changed * 300 / after.length).toFixed(3)}% RGB difference > 8`)
            }
          }
          await capture(route)
          if (route === 'HomePage') {
            await page.locator('#now .home-gallery-open').first().evaluate(el => { el.scrollIntoView({ block: 'center' }); el.click() })
            await page.locator('.github-repository-name').first().waitFor()
            await capture('reader')
          }
          if (route === 'ProjectsPage') {
            await page.keyboard.press('Tab')
            const link = page.locator('.archive-project-link').first()
            await link.focus()
            if (view === 'desktop') await page.waitForFunction(() => document.querySelector('.archive-preview-image')?.naturalWidth > 0)
            else assert.equal(await page.locator('.archive-preview').isVisible(), false, 'Touch layouts omit the hover poster')
            await capture('preview')
            await page.emulateMedia({ reducedMotion: 'no-preference' })
            await page.route('**/assets/ProjectDetailPage-*.js', async r => { await new Promise(resolve => setTimeout(resolve, 1400)); await r.continue().catch(() => {}) })
            await link.press('Enter')
            await page.locator('.project-page-transition[data-phase="covered"]').waitFor()
            await page.evaluate(() => {
              for (const a of document.querySelector('.project-page-transition').getAnimations({ subtree: true })) {
                a.pause(); a.currentTime = a.effect.getComputedTiming().endTime
              }
            })
            await capture('paper', { settle: false })
          }
          if (route === 'ProjectDetailPage') {
            await page.locator('.project-reader-cover .project-reader-image-trigger').click()
            await page.locator('.yarl__slide_current img').last().evaluate(img => img.decode())
            await capture('gallery-open')
            await page.emulateMedia({ reducedMotion: 'no-preference' })
            // Selecting a distant strip button must not scroll the document
            // horizontally as Playwright tries to reveal it for a mouse click.
            await page.getByRole('button', { name: '第 7 张，共 7 张' }).evaluate(el => el.click())
            await page.waitForFunction(() => {
              const animation = document.querySelector('.yarl__carousel')?.getAnimations().find(a => a.playState === 'running')
              if (!animation) return false
              // The gallery releases its path if the animation stops. Keep it
              // running at rate zero for this frame rather than simulating stop.
              for (const a of document.querySelector('.yarl__root').getAnimations({ subtree: true })) {
                if (a.playState !== 'running' || !Number.isFinite(a.effect.getComputedTiming().duration)) continue
                a.playbackRate = 0; a.currentTime = a.effect.getComputedTiming().duration / 2
              }
              return true
            })
            await page.waitForFunction(() => [...document.querySelectorAll('.gallery-stage img')].some(img => {
              const r = img.getBoundingClientRect()
              return img.naturalWidth && r.left < innerWidth / 2 && r.right > innerWidth / 2 &&
                r.bottom > 0 && r.top < innerHeight && getComputedStyle(img).visibility !== 'hidden'
            }))
            await capture('gallery-travel', { settle: false })
            await page.evaluate(() => document.querySelector('.yarl__root').getAnimations({ subtree: true }).forEach(a => {
              if (a.playbackRate === 0) { a.playbackRate = 1; a.finish() }
            }))
            await page.waitForFunction(() => {
              const stage = document.querySelector('.gallery-stage').getBoundingClientRect()
              return !document.querySelector('.yarl__carousel').getAnimations().some(a => a.playState === 'running' || a.pending) &&
                [...document.querySelectorAll('.yarl__slide_current img')].some(img => {
                  const r = img.getBoundingClientRect()
                  return img.src.endsWith('/vaegan-samples.webp') && img.naturalWidth &&
                    Math.abs(r.x + r.width / 2 - stage.x - stage.width / 2) < 3
                })
            })
            await page.getByRole('button', { name: '放大图片', exact: true }).click()
            await page.waitForFunction(() => parseInt(document.querySelector('.gallery-zoom-reset').textContent) > 100)
            await capture('gallery-zoom')
          }
          if (route === 'ContactPage') {
            await page.getByRole('button', { name: '展开看板娘', exact: true }).click()
            await page.locator('.live2d-companion canvas.is-ready').waitFor({ timeout: 45000 })
            await page.locator('.live2d-canvas-wrap').focus()
            await capture('companion')
          }
          assert.deepEqual(errors, [])
        } catch (error) {
          failures.push({ view, route, version })
          console.error(`FAIL ${view} ${route} ${version}: ${error.message.split('\n')[0]} (${error.stack?.match(/ux-final-visual\.browser\.mjs:\d+/)?.[0] ?? 'capture'})`)
          break
        } finally { await context.close() }
      }
    }
  }
  assert.ok(checked.length)
  const suffix = [...options.values()].join('-').replace(/[^a-z0-9-]/gi, '_')
  await writeFile(`${output}/comparison${suffix ? '-' + suffix : ''}.json`, JSON.stringify(checked, null, 2))
  assert.deepEqual(failures, [], 'Retest only the affected route and viewport')
} finally { await browser.close() }
