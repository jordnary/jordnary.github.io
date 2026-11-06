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
async function hold(page, pattern) {
  let release
  const gate = new Promise(resolve => { release = resolve })
  await page.route(pattern, async route => { await gate; await route.continue().catch(() => {}) })
  return release
}
try {
  await mkdir(output, { recursive: true })
  await run(async (page, requests) => {
    for (const path of ['/', '/home/', '/about/', '/learning/', '/projects/', '/contact/']) {
      await page.goto(new URL(path, baseURL).href)
      await page.locator('main > *').first().waitFor()
      await page.waitForTimeout(200)
      assert.equal(requests.some(url => featurePattern.test(url)), false, `${path}: no implicit search download`)
    }
  })
  pass('All entry routes leave search code, index and results CSS unloaded')

  for (const extension of ['js', 'css']) await run(async (page, requests) => {
    const release = await hold(page, new RegExp(`/assets/SiteSearchResults-[^/]+\\.${extension}$`))
    await home(page)
    await page.locator('.nav-search-button').focus()
    await open(page)
    await page.locator('.site-search-loading').waitFor()
    const input = page.locator('.site-search-input')
    await input.fill('React AI')
    await input.evaluate(el => { window.__searchInput = el })
    await page.keyboard.press('Meta+k')
    assert.equal(await input.inputValue(), 'React AI')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    assert.equal(await input.evaluate(el => el === document.activeElement), true)
    release()
    await ready(page)
    assert.equal(await input.inputValue(), 'React AI')
    assert.equal(await input.evaluate(el => el === window.__searchInput), true, 'Loading does not replace the input DOM node')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.nav-search-button').evaluate(el => el === document.activeElement), true)
    assert.equal(requests.filter(url => featurePattern.test(url) && url.endsWith(`.${extension}`)).length, 1)
  })
  pass('Delayed JS and CSS retain input, focus, shortcut and Tab behavior without unstyled results')

  await run(async (page, requests) => {
    const release = await hold(page, featurePattern)
    await home(page)
    await page.locator('.nav-search-button').focus()
    await open(page); await page.locator('.site-search-input').fill('cancel')
    await page.locator('.site-search-footer button').click()
    await page.locator('.site-search-backdrop').waitFor({ state: 'detached' })
    assert.equal(await page.locator('.nav-search-button').evaluate(el => el === document.activeElement), true)
    await open(page)
    assert.equal(await page.locator('.site-search-input').inputValue(), '', 'Closing retains the original query reset behavior')
    await page.locator('.site-search-input').fill('GitHub')
    release(); await ready(page)
    assert.equal(await page.locator('.site-search-input').inputValue(), 'GitHub')
    assert.equal(requests.filter(url => featurePattern.test(url)).length, 2)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    assert.equal(await page.locator('.site-search-backdrop').count(), 0)
  })
  pass('Closing cancels the consumer; reopening shares pending work and ignores stale completion')

  await run(async page => {
    const release = await hold(page, featurePattern)
    await home(page)
    await page.locator('.nav-search-button').tap()
    await page.locator('.site-search-input').fill('touch query')
    await page.locator('.site-search-footer button').tap()
    await page.locator('.site-search-backdrop').waitFor({ state: 'detached' })
    release()
    await page.waitForTimeout(250)
    assert.equal(await page.locator('.site-search-backdrop').count(), 0)
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
  pass('Real touch opens and closes pending search without a late modal appearing')

  for (const extension of ['js', 'css']) for (const failure of ['abort', '404']) await run(async (page, requests) => {
    let failures = 1
    await page.route(new RegExp(`/assets/SiteSearchResults-[^/]+\\.${extension}(\\?.*)?$`), async route => {
      if (failures-- > 0) {
        if (failure === 'abort') await route.abort('failed')
        else await route.fulfill({ status: 404, body: 'Missing feature' })
      } else await route.continue()
    })
    await home(page); await open(page)
    await page.locator('.site-search-input').fill('数据库')
    await page.getByRole('alert').waitFor()
    assert.equal(await page.locator('.site-search-result').count(), 0)
    const attempts = requests.filter(url => featurePattern.test(url)).length
    await open(page); await open(page)
    await page.waitForTimeout(60)
    assert.equal(requests.filter(url => featurePattern.test(url)).length, attempts, 'An already-open shortcut must not start retries behind the error surface')
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await ready(page)
    assert.equal(await page.locator('.site-search-input').inputValue(), '数据库')
    assert.equal(await page.locator('.site-search-input').evaluate(el => el === document.activeElement), true)
    assert.equal(requests.filter(url => featurePattern.test(url) && url.includes(`.${extension}`)).length, 2)
  })
  pass('JS/CSS interruption and 404 recover on explicit retry with the same query and focus')

  await run(async page => {
    let missing = true
    await page.route(/\/assets\/SiteSearchResults-[^/]+\.js(\?.*)?$/, route => missing
      ? route.fulfill({ status: 404, body: 'Expired deployment' }) : route.continue())
    await home(page); await open(page)
    await page.locator('.site-search-input').fill('React 数据库')
    await page.getByRole('alert').waitFor()
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await page.getByRole('alert').waitFor()
    missing = false
    await page.getByRole('button', { name: '重新载入页面', exact: true }).click()
    await ready(page)
    assert.equal(await page.locator('.site-search-input').inputValue(), 'React 数据库')
    assert.equal(await page.evaluate(() => sessionStorage.getItem('site-search-recovery')), null)
  })
  pass('An expired deployment can reopen from a fresh document with the pending query restored once')

  await run(async page => {
    await page.route(/\/assets\/SiteSearchResults-[^/]+\.js(\?.*)?$/, route => route.abort('failed'))
    await home(page); await open(page)
    await page.locator('.site-search-input').fill('keep this query')
    await page.getByRole('alert').waitFor()
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Storage disabled') } })
    await page.getByRole('button', { name: '重新载入页面', exact: true }).click()
    assert.equal(await page.locator('.site-search-input').inputValue(), 'keep this query')
    await page.getByText('暂时无法保留输入，请先复制关键词再刷新页面。').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('.site-search-backdrop').waitFor({ state: 'detached' })
  })
  pass('Blocked storage does not discard input or disable closing the failure surface')

  await run(async (page, requests) => {
    const release = await hold(page, /\/assets\/SiteSearchResults-[^/]+\.css$/)
    await home(page); await open(page)
    await page.locator('.site-search-input').fill('React')
    await page.getByRole('alert').waitFor({ timeout: 10000 })
    release()
    await page.waitForTimeout(300)
    assert.equal(await page.locator('.site-search-result').count(), 0, 'A late load cannot replace the timeout state')
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await ready(page)
    assert.equal(await page.locator('.site-search-input').inputValue(), 'React')
    assert.equal(requests.filter(url => featurePattern.test(url)).length, 2)
  })
  pass('Eight-second consumer timeout stays recoverable and retry reuses late resources')

  await run(async (page, requests) => {
    await home(page)
    const button = page.locator('.nav-search-button')
    await button.dispatchEvent('pointerover', { pointerType: 'mouse', buttons: 0 })
    await page.waitForTimeout(45)
    await button.dispatchEvent('pointerout', { relatedTarget: null })
    await page.waitForTimeout(400)
    assert.equal(requests.some(url => featurePattern.test(url)), false)
    await button.focus()
    await page.waitForFunction(() => [...document.styleSheets].some(s => /SiteSearchResults-/.test(s.href || '')))
    await page.waitForTimeout(150)
    assert.equal(requests.filter(url => featurePattern.test(url)).length, 2)
    await open(page); await ready(page)
    assert.equal(requests.filter(url => featurePattern.test(url)).length, 2)
  })
  pass('Short intent cancels; stable focus prepares once and the required open consumes it')

  for (const connection of [
    { effectiveType: '4g', downlink: 10, rtt: 20, saveData: true },
    { effectiveType: '3g', downlink: 1.6, rtt: 150, saveData: false },
  ]) await run(async (page, requests) => {
    await home(page); await page.locator('.nav-search-button').focus(); await page.waitForTimeout(500)
    assert.equal(requests.some(url => featurePattern.test(url)), false)
    await open(page); await ready(page)
  }, {}, connection)
  pass('Weak connections and Save-Data suppress intent but keep explicit search available')

  await run(async (page, requests) => {
    const release = await hold(page, /\/assets\/SiteSearchResults-[^/]+\.css$/)
    await home(page); await page.locator('.nav-search-button').focus()
    await page.waitForFunction(() => document.querySelector('link[data-search-style]'))
    await page.evaluate(() => {
      const anchor = document.createElement('a'); anchor.id = 'queued-route'; anchor.href = '/contact/'; anchor.textContent = 'Contact'; document.body.append(anchor); anchor.focus()
    })
    await page.waitForTimeout(400)
    assert.equal(requests.some(url => /\/assets\/ContactPage-/.test(url)), false, 'The page intent shares the single running slot')
    await page.locator('#queued-route').evaluate(el => el.click())
    await page.locator('.correspondence').waitFor()
    release()
    await page.waitForTimeout(200)
    assert.equal(await page.locator('.site-search-backdrop').count(), 0)
  })
  pass('Search and route intents share one running slot; required navigation bypasses the slot')

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
    assert.equal(requests.filter(url => featurePattern.test(url)).length, 2)
    assert.ok(cycles.at(-1).nodes <= cycles[0].nodes + 10)
    assert.ok(cycles.at(-1).jsEventListeners <= cycles[0].jsEventListeners + 5)
    await writeFile(`${output}/cycles.json`, JSON.stringify(cycles, null, 2))
  })
  pass('Twenty open/type/close cycles keep feature requests, DOM nodes and listeners bounded')
  console.log(`${checks} search checks passed`)
} finally { await browser.close() }
