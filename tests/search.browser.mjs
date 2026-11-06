import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { launch, home, connectionState, featurePattern, output, baseURL } from './search-support.mjs'

const browser = await launch()
let checks = 0
const pass = message => { checks++; console.log(`PASS: ${message}`) }
async function run(fn, device = {}, connection) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', ...device })
  await context.addInitScript(connectionState, connection)
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const errors = [], requests = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', r => requests.push(r.url()))
  try { await fn(page, requests, context); assert.deepEqual(errors, []) }
  finally { await context.close() }
}
const open = page => page.keyboard.press('Control+k')
const ready = page => page.locator('.site-search-result').first().waitFor()
try {
  await mkdir(output, { recursive: true })
  await run(async (page, requests) => {
    for (const path of ['/', '/home/', '/about/', '/learning/', '/projects/', '/contact/']) {
      await page.goto(new URL(path, baseURL).href)
      await page.locator('main > *').first().waitFor()
      assert.equal(requests.some(url => featurePattern.test(url)), false)
    }
    await home(page)
    await page.locator('.nav-search-button').focus()
    await page.waitForTimeout(400)
    requests.length = 0
    await open(page); await ready(page)
    assert.equal(requests.filter(url => /\.(js|css)(\?|$)/.test(url)).length, 0)
    assert.equal(await page.locator('.site-search-result').first().evaluate(el => getComputedStyle(el).display), 'grid')
  })
  pass('Code and styles are ready with the page; focus and first open add no code requests')

  await run(async page => {
    await home(page)
    await page.locator('.nav-search-button').focus()
    await open(page)
    await page.keyboard.insertText('React AI')
    const input = page.locator('.site-search-input')
    await input.evaluate(el => { window.__searchInput = el })
    await ready(page)
    assert.equal(await input.inputValue(), 'React AI')
    assert.equal(await input.evaluate(el => el === window.__searchInput && el === document.activeElement), true)
    await page.keyboard.press('Meta+k')
    assert.equal(await input.inputValue(), 'React AI')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.locator('.site-search-footer button').evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Tab')
    assert.equal(await input.evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.nav-search-button').evaluate(el => el === document.activeElement), true)
    await open(page); await ready(page)
    assert.equal(await input.inputValue(), '')
    await page.locator('.site-search-backdrop').click({ position: { x: 4, y: 4 } })
    await page.locator('.site-search-backdrop').waitFor({ state: 'detached' })
  })
  pass('Immediate trusted text, input identity, shortcuts, Tab trap, backdrop close and focus return are preserved')

  await run(async (page, _, context) => {
    await home(page); await open(page); await ready(page)
    const input = page.locator('.site-search-input')
    const cdp = await context.newCDPSession(page)
    await input.evaluate(el => { window.__searchInput = el })
    await cdp.send('Input.imeSetComposition', { text: '学', selectionStart: 1, selectionEnd: 1 })
    assert.equal(await input.inputValue(), '学')
    for (const key of ['ArrowDown', 'Enter', 'Escape', 'k']) {
      await input.dispatchEvent('keydown', { key, isComposing: true, ctrlKey: key === 'k' })
      assert.equal(await page.locator('.site-search-backdrop').count(), 1)
      assert.equal(await input.getAttribute('aria-activedescendant'), null)
    }
    await input.dispatchEvent('keydown', { key: 'Escape', keyCode: 229 })
    await cdp.send('Input.insertText', { text: '学习' })
    assert.equal(await input.inputValue(), '学习')
    assert.equal(await input.evaluate(el => el === window.__searchInput && el === document.activeElement), true)
    await ready(page); await input.press('ArrowDown')
    assert.equal(await input.getAttribute('aria-activedescendant'), 'site-search-result-0')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.site-search-backdrop').count(), 0)
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  pass('Native composition keeps the input and results; composing keys never select, navigate or close')

  await run(async (page, requests, context) => {
    await home(page)
    await context.setOffline(true)
    requests.length = 0
    await open(page); await page.keyboard.insertText('数据库'); await ready(page)
    assert.equal(await page.locator('.site-search-input').inputValue(), '数据库')
    await page.locator('.site-search-footer button').click()
    await open(page); await ready(page)
    assert.equal(await page.locator('.site-search-input').inputValue(), '')
    assert.equal(requests.filter(url => /\.(js|css)(\?|$)/.test(url)).length, 0)
  })
  pass('After page startup, offline first open and reopen require no search download or retry')

  for (const connection of [
    { effectiveType: '4g', downlink: 10, rtt: 20, saveData: true },
    { effectiveType: '3g', downlink: 1.6, rtt: 150, saveData: false },
  ]) await run(async (page, requests) => {
    await home(page)
    await page.locator('.nav-search-button').tap()
    await page.keyboard.insertText('GitHub')
    await ready(page)
    await page.locator('.site-search-footer button').tap()
    await page.waitForTimeout(300)
    assert.equal(await page.locator('.site-search-backdrop').count(), 0)
    assert.equal(requests.some(url => featurePattern.test(url)), false)
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, connection)
  pass('Touch, weak connections and Save-Data retain first-open results and closing')

  for (const resource of ['js', 'css']) await run(async page => {
    let failed = true
    await page.route(new RegExp(`/assets/main-[^/]+\\.${resource}$`), route => failed ? route.abort() : route.continue())
    await page.goto(new URL('home/', baseURL).href, { waitUntil: 'domcontentloaded' })
    await page.locator('.page-load-feedback[data-state="error"]').waitFor()
    failed = false
    await page.reload()
    await page.locator('.home-editorial').waitFor()
    await open(page); await ready(page)
  })
  pass('Entry JS/CSS failures retain independent startup feedback, explicit recovery and usable search')

  await run(async (page, requests, context) => {
    await context.addInitScript(() => {
      if (sessionStorage.getItem('search-test-seeded')) return
      sessionStorage.setItem('search-test-seeded', '1')
      sessionStorage.setItem('site-search-recovery', JSON.stringify({ href: location.href, query: 'React 数据库', time: Date.now() }))
    })
    await home(page); await ready(page)
    assert.equal(await page.locator('.site-search-input').inputValue(), 'React 数据库')
    assert.equal(await page.evaluate(() => sessionStorage.getItem('site-search-recovery')), null)
    await page.keyboard.press('Escape')
    await open(page); await ready(page)
    assert.equal(await page.locator('.site-search-input').inputValue(), '')
    await page.reload(); await page.locator('.home-editorial').waitFor()
    assert.equal(await page.locator('.site-search-backdrop').count(), 0)
  })
  pass('A same-page reload recovery from the previous release restores the query exactly once')

  for (const kind of ['expired', 'other-page', 'future', 'malformed', 'blocked']) await run(async (page, requests, context) => {
    await context.addInitScript(kind => {
      if (kind === 'blocked') {
        Storage.prototype.getItem = Storage.prototype.removeItem = () => { throw new Error('Storage disabled') }
      } else sessionStorage.setItem('site-search-recovery', kind === 'malformed' ? '{' : JSON.stringify({
        href: kind === 'other-page' ? location.href + '?other' : location.href, query: 'stale',
        time: Date.now() + (kind === 'future' ? 60000 : kind === 'expired' ? -60001 : 0),
      }))
    }, kind)
    await home(page)
    assert.equal(await page.locator('.site-search-backdrop').count(), 0)
    await open(page); await ready(page)
    assert.equal(await page.locator('.site-search-input').inputValue(), '')
    await page.keyboard.press('Escape')
  })
  pass('Invalid, stale, foreign or blocked recovery storage never prevents ordinary search')

  await run(async page => {
    await home(page)
    await page.locator('.nav-search-button').focus()
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
      requestAnimationFrame(() => document.querySelector('.site-search-footer button')?.click())
    })
    await page.waitForTimeout(350)
    assert.equal(await page.locator('.site-search-backdrop').count(), 0)
    assert.equal(await page.locator('.nav-search-button').evaluate(el => el === document.activeElement), true)
    await open(page); await ready(page)
  })
  pass('Closing in the first frame never reopens the dialog or loses focus')

  await run(async page => {
    await home(page)
    await page.evaluate(() => document.querySelector('#site-scroll').scrollTo({ top: 500, behavior: 'instant' }))
    const before = await page.locator('#site-scroll').evaluate(el => el.scrollTop)
    assert.ok(before > 0)
    await open(page); await ready(page)
    await page.locator('.site-search-input').fill('React')
    assert.equal(await page.locator('#site-scroll').evaluate(el => getComputedStyle(el).overflowY), 'hidden')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('#site-scroll').evaluate(el => el.scrollTop), before)
    assert.equal(await page.locator('#site-scroll').evaluate(el => getComputedStyle(el).overflowY), 'auto')
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
  pass('Mobile search locks the background and restores the existing scroll position on close')

  for (const mobile of [false, true]) await run(async (page, _, context) => {
    await home(page)
    const read = () => page.evaluate(() => matchMedia('(pointer: coarse)').matches
      ? document.getElementById('site-scroll').scrollTop : scrollY)
    await page.evaluate(() => (matchMedia('(pointer: coarse)').matches
      ? document.getElementById('site-scroll') : document.documentElement).scrollTo({ top: 500, behavior: 'instant' }))
    const before = await read()
    await open(page); await ready(page); await page.waitForTimeout(220)
    await page.mouse.move(4, 300); await page.mouse.wheel(0, 400)
    await page.locator('.site-search-footer button').focus(); await page.keyboard.press('PageDown')
    if (mobile) {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 4, y: 600 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 4, y: 200 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    await page.waitForTimeout(160)
    assert.equal(await read(), before, 'Backdrop wheel, touch and PageDown must not scroll the background')
    const input = page.locator('.site-search-input')
    await input.fill('AI'); await input.press('ArrowUp')
    await page.waitForTimeout(180)
    assert.equal(await read(), before, 'Keyboard selection scrolls only the results')
    assert.equal(await page.evaluate(() => {
      const input = document.querySelector('.site-search-input')
      const row = document.getElementById(input.getAttribute('aria-activedescendant')).getBoundingClientRect()
      const list = document.querySelector('.site-search-results').getBoundingClientRect()
      return row.top >= list.top - 1 && row.bottom <= list.bottom + 1
    }), true)
    const resultsTop = await page.locator('.site-search-results').evaluate(el => el.scrollTop)
    await page.locator('.site-search-result').first().dispatchEvent('mousemove')
    await page.waitForTimeout(80)
    assert.equal(await page.locator('.site-search-results').evaluate(el => el.scrollTop), resultsTop,
      'Pointer selection must not start a scroll into view')
    assert.equal(await read(), before, 'Pointer selection never scrolls the background')
    await page.keyboard.press('Escape')
    assert.equal(await read(), before)
    await page.mouse.move(20, 300); await page.mouse.wheel(0, 200); await page.waitForTimeout(200)
    assert.ok(await read() > before, 'Closing releases normal page scrolling')
  }, mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {})
  pass('Desktop/mobile boundaries contain scroll chaining; selection, close and normal scrolling stay correct')

  await run(async page => {
    await home(page); await open(page); await ready(page)
    const input = page.locator('.site-search-input')
    await input.fill('react')
    await input.press('ArrowUp')
    const count = await page.locator('.site-search-result').count()
    assert.equal(await input.getAttribute('aria-activedescendant'), `site-search-result-${count - 1}`)
    await input.press('ArrowDown')
    assert.equal(await input.getAttribute('aria-activedescendant'), 'site-search-result-0')
    await page.locator('.site-search-result').nth(1).dispatchEvent('mousemove')
    assert.equal(await input.getAttribute('aria-activedescendant'), 'site-search-result-1')
    await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
    assert.equal(await page.locator('.site-search-backdrop').count(), 1, 'IME confirmation must not activate a result')
    await input.fill('no-such-query-12345')
    await page.locator('.site-search-empty').waitFor()
    assert.equal(await input.getAttribute('aria-activedescendant'), null)
    await page.getByRole('button', { name: '清空搜索内容' }).click()
    assert.equal(await page.locator('.site-search-result').count(), 6)
    await input.fill('知识沉淀'); await input.press('ArrowDown'); await input.press('Enter')
    await page.locator('.learning-studio').waitFor()
    assert.equal(await page.locator('.site-search-backdrop').count(), 0)
    await page.goBack(); await page.locator('.home-editorial').waitFor()
    await open(page); await ready(page)
    await input.fill('知识地图'); await input.press('ArrowDown'); await input.press('Enter')
    await page.locator('.learning-studio').waitFor()
  })
  pass('Ranking UI, wraparound keys, pointer selection, clear/empty states and history navigation remain usable')

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) await run(async page => {
    await home(page)
    if (await page.locator('.nav-menu-button').isVisible()) {
      await page.locator('.nav-menu-button').click()
      await page.locator('.mobile-nav-search').click()
    } else await page.locator('.nav-search-button').click()
    await ready(page)
    assert.equal(await page.locator('#mobile-navigation').evaluate(el => el.open), false)
    await page.locator('.site-search-input').fill('AI')
    await page.keyboard.press('Escape')
    assert.ok(await page.evaluate(() => document.activeElement.matches('.nav-menu-button,.nav-search-button')))
    await open(page); await ready(page)
    const box = await page.locator('.site-search-dialog').boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1)
    await page.screenshot({ path: `${output}/search-${viewport.width}.png` })
  }, { viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
  pass('Portrait/landscape touch navigation hands off to search and restores a visible trigger')

  await run(async (page, requests, context) => {
    await home(page)
    const cdp = await context.newCDPSession(page)
    const cycles = []
    for (let i = 1; i <= 20; i++) {
      await open(page); await ready(page)
      await page.locator('.site-search-input').fill('React')
      await page.keyboard.press('Escape')
      await page.locator('.site-search-backdrop').waitFor({ state: 'detached' })
      if ([5, 10, 20].includes(i)) {
        await cdp.send('HeapProfiler.collectGarbage')
        cycles.push({ cycle: i, ...(await cdp.send('Memory.getDOMCounters')),
          heap: (await cdp.send('Runtime.getHeapUsage')).usedSize,
          dom: await page.evaluate(() => document.querySelectorAll('*').length) })
      }
    }
    assert.equal(requests.filter(url => featurePattern.test(url)).length, 0)
    assert.ok(cycles.at(-1).nodes <= cycles[0].nodes + 10)
    assert.ok(cycles.at(-1).jsEventListeners <= cycles[0].jsEventListeners + 5)
    await writeFile(`${output}/cycles.json`, JSON.stringify(cycles, null, 2))
  })
  pass('Twenty open/type/close cycles keep feature requests, DOM nodes and listeners bounded')
  console.log(`${checks} search checks passed`)
} finally { await browser.close() }
