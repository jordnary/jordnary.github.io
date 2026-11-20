import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

export const routeCases = [
  ['/', '.homepage-portal', 'HomepagePortal'], ['/home/', '.home-editorial', 'HomePage'],
  ['/about/', '.about-journey', 'AboutPage'], ['/learning/', '.learning-studio', 'LearningPage'],
  ['/projects/', '.projects-archive', 'ProjectsPage'], ['/projects/studio/', '.project-studio', 'ProjectStudioPage'],
  ['/projects/vae-gan-digits/', '.project-reader', 'ProjectDetailPage'], ['/contact/', '.correspondence', 'ContactPage'],
]
export const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1 },
  { name: 'mobile-constrained', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4 },
]
export function connectionState(value = { effectiveType: '4g', downlink: 10, rtt: 20, saveData: false }) {
  const connection = Object.assign(new EventTarget(), value)
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection })
}
const contactArt = /\/street-graffiti-cycle(?:-[a-z0-9-]+)?\.webp(?:\?.*)?$/
const modulePattern = name => new RegExp(`/assets/${name}-[^/]+\\.js$`)
const baseURL = process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4174/'
export const click = (page, path) => page.evaluate(path => {
  const link = document.createElement('a')
  link.href = path
  document.body.append(link)
  link.click()
  link.remove()
}, path)
export async function contentReady(page, selector) {
  await page.locator(selector).first().waitFor()
  await page.locator('.page-load-feedback').waitFor({ state: 'detached' })
  await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(resolve))
    await document.fonts.ready
    await Promise.all([...document.querySelectorAll('main img')].filter(image => {
      const rect = image.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth
    }).map(image => image.decode().catch(() => {})))
  })
}
async function link(page, path, name = 'intent', attributes = {}) {
  await page.evaluate(({ path, name, attributes }) => {
    const old = document.getElementById(name)
    old?.remove()
    const link = document.createElement('a')
    link.id = name
    link.href = path
    link.textContent = name
    link.style.cssText = 'position:fixed;bottom:15px;left:15px;z-index:99999;background:white;color:black;padding:10px'
    for (const [key, value] of Object.entries(attributes)) link.setAttribute(key, value)
    document.body.append(link)
  }, { path, name, attributes })
  return page.locator(`#${name}`)
}
async function hold(page, pattern) {
  let release
  const gate = new Promise(resolve => { release = resolve })
  let count = 0
  await page.route(pattern, async route => { count++; await gate; await route.continue().catch(() => {}) })
  return { release, count: () => count }
}
export async function runChecks(browser) {
  let checks = 0
  const lifecycle = []
  const priorities = []
  const pass = message => { checks++; console.log(`PASS: ${message}`) }
  const run = async (fn, options = {}, connection = undefined) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', ...options })
    await context.addInitScript(connectionState, connection)
    await context.addInitScript(() => performance.setResourceTimingBufferSize(2000))
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    const errors = []
    const requests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => requests.push(new URL(request.url()).pathname))
    try { await fn(page, requests, context); assert.deepEqual(errors, []) }
    finally { await context.close() }
  }
  const home = async page => {
    await page.goto(new URL('/home/', baseURL).href)
    await contentReady(page, '.home-editorial')
  }

  for (const profile of [...profiles, { name: 'landscape', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }]) {
    const { name, cpu: _, ...options } = profile
    await run(async (page, requests) => {
      for (const [path, selector, moduleName] of routeCases) {
        requests.length = 0
        await page.goto(new URL(path, baseURL).href)
        await contentReady(page, selector)
        const htmlHints = await page.locator('link[data-page-module]').evaluateAll(links => links.map(link => link.href))
        assert.ok(htmlHints.some(href => modulePattern(moduleName).test(href)), `${path}: own HTML module hint`)
        assert.equal(requests.filter(path => modulePattern(moduleName).test(path)).length, 1, `${path}: module downloaded once`)
        const critical = await page.locator('link[data-page-image]').evaluateAll(links => links.map(link => ({ src: link.href, srcSet: link.imageSrcset, sizes: link.imageSizes })))
        for (const source of critical) {
          const selected = await page.evaluate(async source => {
            const image = new Image()
            image.sizes = source.sizes
            image.srcset = source.srcSet
            image.src = source.src
            await image.decode()
            return new URL(image.currentSrc).pathname
          }, source)
          assert.equal(requests.filter(path => path === selected).length, 1, `${path}: same responsive candidate once`)
          if (source.srcSet && selected !== new URL(source.src).pathname) assert.equal(requests.includes(new URL(source.src).pathname), false)
        }
        if (path === '/contact/') {
          const cover = await page.locator('.correspondence-graffiti-cover').evaluate(image => image.currentSrc)
          assert.equal(requests.filter(p => contactArt.test(p)).length, 1)
          assert.ok((await page.locator('.correspondence-graffiti').evaluate(el => getComputedStyle(el).backgroundImage)).includes(cover))
          if (name === 'mobile-constrained') assert.match(cover, /-1200\.webp$/)
        }
        const styles = requests.filter(path => path.endsWith('.css'))
        assert.equal(new Set(styles).size, styles.length, `${path}: stylesheet preload reuse`)
        if (path.includes('vae-gan')) assert.equal(requests.some(path => /ProjectsPage-/.test(path)), false)
      }
    }, options)
    pass(`${name}: all eight HTML entries discover their own code and reuse image/CSS candidates`)
  }

  await run(async (page, requests, context) => {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150,
      downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 })
    await page.goto(new URL('/projects/studio/', baseURL).href, { waitUntil: 'domcontentloaded' })
    await contentReady(page, '.project-studio')
    const artwork = requests.filter(path => path.includes('starlit-summit'))
    assert.equal(artwork.length, 1, 'Slow mobile HTML must not download an original before its responsive candidate')
    assert.ok(artwork[0].endsWith('-768.webp'))
  }, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { effectiveType: '4g', downlink: 1.6, rtt: 150 })
  pass('Constrained mobile Studio discovers the correct viewport-sized image without an original fallback download')

  await run(async (page, requests, context) => {
    await home(page)
    const initialHints = await page.locator('link[data-page-image]').count()
    const target = await link(page, '/contact/')
    await target.hover()
    await page.waitForTimeout(30)
    await page.mouse.move(500, 300)
    await page.waitForTimeout(250)
    assert.equal(requests.some(path => modulePattern('ContactPage').test(path)), false)
    await target.hover()
    await target.focus()
    await page.waitForResponse(response => modulePattern('ContactPage').test(response.url()))
    await page.waitForTimeout(150)
    assert.equal(await page.locator('.home-editorial').count(), 1)
    await target.click()
    await contentReady(page, '.correspondence')
    const cdp = await context.newCDPSession(page)
    const record = async cycle => {
      await cdp.send('HeapProfiler.collectGarbage')
      lifecycle.push({ cycle, domNodes: await page.locator('*').count(),
        ...await cdp.send('Memory.getDOMCounters'), ...await cdp.send('Runtime.getHeapUsage') })
    }
    await record(0)
    for (let cycle = 0; cycle < 20; cycle++) {
      await click(page, '/home/')
      await contentReady(page, '.home-editorial')
      await click(page, '/contact/')
      await contentReady(page, '.correspondence')
      if ([5, 10, 20].includes(cycle + 1)) await record(cycle + 1)
    }
    assert.equal(requests.filter(path => modulePattern('ContactPage').test(path)).length, 1)
    assert.equal(requests.filter(path => contactArt.test(path)).length, 1)
    assert.equal(await page.locator('link[data-page-image]').count(), initialHints, 'SPA visits do not accumulate hint nodes')
    assert.equal(new Set(lifecycle.map(sample => sample.domNodes)).size, 1, 'The same destination keeps a stable DOM across return cycles')
  })
  pass('Short hover cancels; stable hover/focus coalesce; click and 20 return cycles reuse code/images')

  // Warm from a cold opening document with no focus, hover or navigation.
  for (const profile of profiles) {
    const { name, cpu: _, ...options } = profile
    await run(async (page, requests) => {
      await page.goto(baseURL)
      await page.locator('.launch-intro-enter').waitFor()
      const cover = requests.find(path => contactArt.test(path))
      assert.ok(cover, 'The Contact background request starts in the opening document')
      await page.waitForFunction(cover => {
        const paths = performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname)
        return paths.includes(cover) && ['airmail-insignia', 'hero-campus-sketch', 'fiber-paper', 'linework-background',
          'now-building', 'servers', 'hero-tower-sketch', 'starlit-summit'].every(name => paths.some(path => path.includes(name)))
      }, cover)
      assert.ok(!requests.some(path => modulePattern('ContactPage').test(path)))
      await page.locator('.launch-intro-enter').click()
      await page.locator('.homepage-hub-link[href$="/contact/"]').click()
      await contentReady(page, '.correspondence')
      const src = await page.locator('.correspondence-graffiti-cover').evaluate(image => image.currentSrc)
      assert.equal(new URL(src).pathname, cover)
      assert.ok((await page.locator('.correspondence-graffiti').evaluate(el => getComputedStyle(el).backgroundImage)).includes(src))
      assert.equal(requests.filter(path => contactArt.test(path)).length, 1)
    }, options)
    pass(`${name}: opening to Contact reuses the background fetched before interaction; cross-page artwork is already warm`)
  }

  await run(async (page, requests, context) => {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    cdp.on('Network.requestWillBeSent', event => {
      if (contactArt.test(event.request.url)) priorities.push(event.request.initialPriority)
    })
    const gate = await hold(page, contactArt)
    try {
      await page.goto(new URL('/home/', baseURL).href, { waitUntil: 'domcontentloaded' })
      await page.locator('.home-editorial').waitFor()
      assert.equal(gate.count(), 1)
      await click(page, '/about/')
      await page.locator('.about-journey').waitFor()
      await click(page, '/contact/')
      await page.locator('.correspondence').waitFor()
      assert.equal(gate.count(), 1)
    } finally { gate.release() }
    await contentReady(page, '.correspondence')
    assert.equal(priorities[0], 'High')
    assert.equal(requests.filter(path => contactArt.test(path)).length, 1)
  })
  pass('An in-flight Contact background survives route changes and is shared with the visible page')

  for (const [path, selector, name] of [['/about/', '.about-journey', 'AboutPage'], ['/learning/', '.learning-studio', 'LearningPage']]) {
    await run(async (page, _requests, context) => {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await home(page)
      const target = await link(page, path)
      await target.focus()
      await page.waitForResponse(response => modulePattern(name).test(response.url()))
      await page.waitForTimeout(400)
      await page.evaluate(() => {
        window.__loadingNotices = 0
        new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes) {
            if (node instanceof Element && (node.matches('.page-load-feedback') || node.querySelector('.page-load-feedback'))) window.__loadingNotices++
          }
        }).observe(document, { childList: true, subtree: true })
        document.getElementById('intent').click()
      })
      await contentReady(page, selector)
      assert.equal(await page.evaluate(() => window.__loadingNotices), 0, `${name}: prepared first render never flashes a loading notice`)
    })
  }
  pass('Prepared About/Learning imports render directly without a loading notice at CPU 4x')

  for (const value of [
    { effectiveType: '4g', downlink: 10, rtt: 20, saveData: true },
    { effectiveType: '3g', downlink: 1.6, rtt: 150 },
    { effectiveType: '4g', downlink: 1.6, rtt: 150 },
  ]) {
    await run(async (page, requests) => {
      await home(page)
      await (await link(page, '/contact/')).focus()
      await page.waitForTimeout(400)
      assert.equal(requests.some(path => modulePattern('ContactPage').test(path)), false)
      assert.ok(requests.some(path => contactArt.test(path)))
      await click(page, '/contact/')
      await contentReady(page, '.correspondence')
    }, {}, value)
  }
  pass('Essential images load on constrained connections while optional code waits for the click')

  await run(async (page, requests) => {
    await home(page)
    await (await link(page, '/contact/')).focus()
    await page.waitForTimeout(600)
    assert.ok(requests.some(path => modulePattern('ContactPage').test(path)))
    assert.ok(requests.some(path => contactArt.test(path)))
  }, {}, {})
  pass('Browsers without connection estimates preload the same essential images')

  for (const resource of ['js', 'css', 'image']) {
    await run(async page => {
      const pattern = resource === 'js' ? modulePattern('ContactPage') : resource === 'css' ? '**/ContactPage-*.css' : contactArt
      let failures = 0
      await page.route(pattern, route => { failures++; return route.abort() }, { times: 1 })
      await home(page)
      await (await link(page, '/contact/')).focus()
      await page.waitForTimeout(600)
      assert.equal(failures, 1, `${resource}: preload failure reached before navigation`)
      assert.equal(await page.locator('.page-load-feedback').count(), 0)
      assert.equal(await page.locator('.home-editorial').count(), 1)
      await click(page, '/contact/')
      // Explicit navigation recovers a known rejected module in a fresh document.
      await contentReady(page, '.correspondence')
    })
  }
  pass('Prefetch JS/CSS/image failures stay silent; click retains document recovery and image retry')

  await run(async (page, requests) => {
    await home(page)
    for (const [path, attrs] of [
      ['/contact/', { target: '_blank' }], ['/contact/', { download: '' }], ['/contact/', { rel: 'external' }],
      ['/contact/', { 'data-site-reload': '' }], ['https://example.com/contact/', {}], ['/unknown/', {}], ['#now', {}],
    ]) {
      await (await link(page, path, 'excluded', attrs)).focus()
      await page.waitForTimeout(130)
    }
    assert.equal(requests.some(path => modulePattern('ContactPage').test(path)), false)
    const target = await link(page, '/contact/')
    await target.dispatchEvent('pointerover', { pointerType: 'mouse', ctrlKey: true })
    await page.waitForTimeout(200)
    assert.equal(requests.some(path => modulePattern('ContactPage').test(path)), false)
    await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }))
    await target.focus()
    await page.waitForTimeout(200)
    assert.equal(requests.some(path => modulePattern('ContactPage').test(path)), false)
  })
  pass('External, download, reload, modified, unknown, same-page and hidden intents are excluded')

  await run(async (page, requests, context) => {
    await home(page)
    const target = await link(page, '/contact/')
    const box = await target.boundingBox()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 10, y: box.y + 10 }] })
    await page.waitForTimeout(350)
    assert.equal(requests.filter(path => modulePattern('ContactPage').test(path)).length, 1)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await contentReady(page, '.correspondence')
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  pass('A real sustained touch warms the target and the subsequent tap reuses it')
  await mkdir('node_modules/.cache/page-resources', { recursive: true })
  await writeFile('node_modules/.cache/page-resources/checks.json', JSON.stringify({ checks, lifecycle, priorities, status: 'passed' }))
  return checks
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/page-resources.browser.mjs')) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true })
  try { console.log(`${await runChecks(browser)} page resource checks passed`) }
  catch (error) { console.error(`Page resource checks failed: ${error.message}`); process.exitCode = 1 }
  finally { await browser.close() }
}
