import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { launch } from './search-support.mjs'

const baseURL = process.env.HOME_EDITORIAL_TEST_URL || 'http://127.0.0.1:4196/'
const browser = await launch()
const output = 'node_modules/.cache/snapshots'
const results = []
const measurements = []
const date = offset => new Date(Date.now() + offset).toISOString()
const sources = [
  { kind: 'code', file: 'github', index: 0, selector: '.github-repository-name',
    make: (version, time) => ({ fetchedAt: time, profile: { followers: 1, publicRepos: 1 }, repos: [{ name: `Snapshot ${version}`, description: 'A cached project', language: 'TypeScript', stars: 1, updatedAt: time, url: 'https://github.com/example/project' }] }), time: value => value.fetchedAt },
  { kind: 'reading', file: 'rss', index: 1, selector: '.rss-item-copy strong',
    make: (version, time) => ({ generatedAt: time, items: [{ id: 'article', title: `Snapshot ${version}`, description: 'A cached article', source: 'Example', sourceUrl: 'https://example.com', url: 'https://example.com/article', publishedAt: time }] }), time: value => value.generatedAt },
]
const pass = message => { results.push(message); console.log(`PASS: ${message}`) }
const gate = () => { let release; const promise = new Promise(resolve => { release = resolve }); return { promise, release } }
async function fixture(source, { cache = 'valid', storageMode = '', timeout = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const old = source.make(1, date(cache === 'expired' ? -8 * 86400000 : cache === 'future' ? 3600000 : -3600000))
  const key = `site-snapshot:${source.file}:v1`
  await context.addInitScript(({ old, key, file, sourceTime, cache, storageMode }) => {
    window.__snapshotOffset = 0
    const originalNow = Date.now
    Date.now = () => originalNow() + window.__snapshotOffset
    if (cache !== 'none') {
      const text = cache === 'corrupt' ? '{broken' : JSON.stringify({ version: cache === 'version' ? 9 : 1, sourceUpdatedAt: sourceTime, data: old })
      localStorage.setItem(key, text)
      if (file === 'github' && cache === 'valid') localStorage.setItem('github-site-snapshot:v1', JSON.stringify(old))
    }
    if (storageMode === 'disabled') Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled') } })
    if (storageMode === 'quota') Storage.prototype.setItem = () => { throw new Error('Quota exceeded') }
  }, { old, key, file: source.file, sourceTime: source.time(old), cache, storageMode })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let requests = 0
  let response = source.make(2, date(0))
  let mode = 'hold'
  const held = gate()
  await page.route(`**/data/${source.file}.json`, async route => {
    requests++
    if (mode === 'hold') await held.promise
    if (mode === 'offline') await route.abort('internetdisconnected').catch(() => {})
    else await route.fulfill({ status: mode === 'error' ? 503 : 200, json: mode === 'invalid' ? {} : response }).catch(() => {})
  })
  await page.goto(new URL('home/', baseURL).href)
  const reader = page.locator('.home-now-reader')
  const content = page.locator('.home-now-live-content')
  const item = page.locator(source.selector)
  const open = async () => {
    await page.locator('#now .home-gallery-open').nth(source.index).waitFor({ state: 'attached' })
    await page.evaluate(index => {
      window.__snapshotOpenStart = performance.now()
      document.querySelectorAll('#now .home-gallery-open')[index].click()
    }, source.index)
    await content.waitFor()
  }
  const close = async () => {
    await page.keyboard.press('Escape')
    await reader.waitFor({ state: 'detached' })
  }
  return { context, page, reader, content, item, old, key, errors, open, close, requests: () => requests,
    ready: () => page.locator('.home-now-live-content[aria-busy="false"]').waitFor({ timeout: timeout ? 15000 : 5000 }),
    mode: value => { mode = value }, response: value => { response = value }, release: held.release,
    dispose: async () => { held.release(); await context.close() } }
}
try {
  await mkdir(output, { recursive: true })
  for (const source of sources) {
    const f = await fixture(source)
    try {
      await f.open()
      await f.item.getByText('Snapshot 1', { exact: true }).waitFor()
      const initial = await f.page.evaluate(() => performance.now() - window.__snapshotOpenStart)
      assert.equal(await f.content.getAttribute('aria-busy'), 'true')
      assert.ok(await f.reader.getByText('显示上次成功的数据，正在检查更新。', { exact: false }).count())
      const sourceLabel = await f.reader.locator('.live-sync-note').textContent()
      assert.equal(f.requests(), 1)
      await f.close()
      await f.open()
      assert.equal(await f.item.textContent(), 'Snapshot 1')
      assert.equal(f.requests(), 1, 'Reopening shares the pending request')
      f.mode('ready'); f.release()
      await f.ready()
      assert.equal(await f.item.textContent(), 'Snapshot 2')
      assert.notEqual(await f.reader.locator('.live-sync-note').textContent(), sourceLabel)
      const saved = await f.page.evaluate(key => JSON.parse(localStorage.getItem(key)), f.key)
      assert.equal(saved.sourceUpdatedAt, source.time(saved.data))
      await f.close()
      await f.open()
      await f.ready()
      assert.equal(f.requests(), 1, 'Fresh memory skips another request')
      measurements.push({ source: source.file, cachedContentMs: Math.round(initial), freshReopenRequests: f.requests() - 1 })
      f.mode('offline')
      await f.reader.locator('.live-refresh-button').click()
      await f.ready()
      assert.equal(await f.item.textContent(), 'Snapshot 2')
      await f.reader.locator('.live-refresh-feedback.is-error').waitFor()
      assert.equal(f.requests(), 2, 'Explicit refresh bypasses freshness')
      f.mode('ready'); f.response(source.make(3, date(1000)))
      await f.page.evaluate(() => window.dispatchEvent(new Event('online')))
      await f.item.getByText('Snapshot 3', { exact: true }).waitFor()
      await f.ready()
      assert.equal(await f.reader.locator('.live-refresh-feedback.is-error').count(), 0, 'Successful background recovery clears obsolete failure feedback')
      assert.equal(f.requests(), 3)
      // Elapsed freshness alone never creates a polling request.
      await f.close()
      await f.page.evaluate(() => { window.__snapshotOffset += 6 * 60000; window.dispatchEvent(new Event('online')) })
      await f.page.waitForTimeout(100)
      assert.equal(f.requests(), 3, 'No consumers means no background refresh')
      await f.open()
      await f.ready()
      assert.equal(f.requests(), 4, 'A later visible consumer revalidates stale memory')
      // Visibility is synthetic here; actual background tab timing belongs to final acceptance.
      await f.page.evaluate(() => {
        window.__snapshotHidden = true
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__snapshotHidden })
        window.__snapshotOffset += 6 * 60000
        document.dispatchEvent(new Event('visibilitychange'))
        window.dispatchEvent(new Event('online'))
      })
      await f.page.waitForTimeout(100)
      assert.equal(f.requests(), 4)
      await f.page.evaluate(() => { window.__snapshotHidden = false; document.dispatchEvent(new Event('visibilitychange')) })
      await f.ready()
      assert.equal(f.requests(), 5)
      // Source age is checked independently of the just-completed freshness window.
      await f.page.evaluate(() => { window.__snapshotOffset += 8 * 86400000; document.dispatchEvent(new Event('visibilitychange')) })
      await f.ready()
      assert.equal(await f.item.count(), 0)
      await f.reader.locator('.live-state-error').waitFor()
      f.response(source.make(4, await f.page.evaluate(() => new Date(Date.now()).toISOString())))
      await f.reader.locator('.live-refresh-button').click()
      await f.ready()
      assert.equal(await f.item.textContent(), 'Snapshot 4')
      assert.deepEqual(f.errors, [])
      pass(`${source.file}: immediate cached content, pending ownership, fresh reopen, offline preservation, online/visible recovery, no idle polling`)
    } finally { await f.dispose() }

    for (const settings of [{ cache: 'expired' }, { cache: 'future' }, { cache: 'corrupt' }, { cache: 'version' }, { storageMode: 'disabled' }, { cache: 'none', storageMode: 'quota' }]) {
      const f = await fixture(source, settings)
      try {
        await f.open()
        assert.equal(await f.item.count(), 0, 'Invalid or inaccessible cache is not displayed')
        assert.equal(await f.content.getAttribute('aria-busy'), 'true')
        f.mode('ready'); f.release()
        await f.ready()
        assert.equal(await f.item.textContent(), 'Snapshot 2')
        await f.close(); await f.open(); await f.ready()
        assert.equal(f.requests(), 1, 'Storage failures retain successful memory data')
        assert.deepEqual(f.errors, [])
        pass(`${source.file}: ${settings.storageMode || settings.cache} cache recovers without replacing good network content`)
      } finally { await f.dispose() }
    }
    const timed = await fixture(source, { timeout: true })
    try {
      await timed.open()
      await timed.ready()
      assert.equal(await timed.item.textContent(), 'Snapshot 1')
      await timed.reader.getByText('暂时无法更新，显示上次成功的数据。', { exact: false }).waitFor()
      timed.mode('ready'); timed.release()
      await timed.reader.locator('.live-refresh-button').click()
      await timed.ready()
      assert.equal(await timed.item.textContent(), 'Snapshot 2')
      assert.deepEqual(timed.errors, [])
      pass(`${source.file}: real 10-second fetch timeout preserves stale content and manual refresh recovers`)
    } finally { await timed.dispose() }
  }
  await writeFile(`${output}/checks.json`, JSON.stringify({ results, measurements }, null, 2))
  console.log(JSON.stringify(measurements))
} catch (error) {
  console.error(`Snapshot browser checks failed: ${error.message}`)
  process.exitCode = 1
} finally { await browser.close() }
