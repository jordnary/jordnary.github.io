import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syncRssSnapshot } from '../scripts/sync-rss.mjs'
import { isRssFeed } from '../src/lib/rss-snapshot.ts'
import { rssSnapshotStore } from '../src/lib/rss.ts'

const previous = { generatedAt: '2026-11-01T00:00:00Z', items: [] }
async function output(t) {
  const directory = await mkdtemp(join(tmpdir(), 'rss-snapshot-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return join(directory, 'rss.json')
}
test('RSS sync writes a bounded validated snapshot atomically and accepts a partial source success', async t => {
  const outputPath = await output(t)
  const fetchImpl = async url => {
    if (String(url).includes('hnrss')) throw new Error('Unavailable')
    return new Response(`<rss><channel>${Array.from({ length: 20 }, (_, i) => `<item><title>Article ${i}</title><link>https://example.com/${i}</link><pubDate>2026-11-01</pubDate><description>Excerpt</description></item>`).join('')}</channel></rss>`)
  }
  const { snapshot, reused } = await syncRssSnapshot({ outputPath, fetchImpl })
  assert.equal(reused, false)
  assert.equal(snapshot.items.length, 12)
  assert.equal(isRssFeed(snapshot), true)
  assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), snapshot)
  assert.deepEqual(await readdir(join(outputPath, '..')), ['rss.json'])
})
test('RSS all-source failure retains local data and its original source timestamp', async t => {
  const outputPath = await output(t)
  await writeFile(outputPath, JSON.stringify(previous))
  const { snapshot, reused } = await syncRssSnapshot({ outputPath, fetchImpl: async () => { throw new Error('Offline') } })
  assert.equal(reused, true)
  assert.deepEqual(snapshot, previous)
  assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), previous)
})
test('RSS fresh runners restore published data; the newest valid fallback wins', async t => {
  const outputPath = await output(t)
  const newer = { ...previous, generatedAt: '2026-11-02T00:00:00Z' }
  const fetchImpl = async (url, options) => {
    if (!String(url).endsWith('/data/rss.json')) return new Response('', { status: 503 })
    assert.equal(String(url), 'https://example.com/site/data/rss.json')
    assert.equal(options.headers, undefined)
    return new Response(JSON.stringify(newer))
  }
  for (const local of [null, previous]) {
    if (local) await writeFile(outputPath, JSON.stringify(local))
    assert.deepEqual(await syncRssSnapshot({ outputPath, siteUrl: 'https://example.com/site', fetchImpl }), { snapshot: newer, reused: true })
  }
})
test('RSS unavailable/invalid sources with no valid fallback stop publication without fabricating a timestamp', async t => {
  const outputPath = await output(t)
  await assert.rejects(syncRssSnapshot({ outputPath, fetchImpl: async () => new Response('{}') }), /deployment stopped/)
  await assert.rejects(readFile(outputPath), { code: 'ENOENT' })
})
test('browser RSS adapter uses only the same-origin JSON snapshot and memory freshness', async t => {
  let calls = 0
  const recent = { generatedAt: new Date().toISOString(), items: [] }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++
    assert.equal(url, '/data/rss.json')
    assert.equal(options.cache, 'no-cache')
    return new Response(JSON.stringify(recent))
  })
  assert.equal(await rssSnapshotStore.refresh(), true)
  assert.deepEqual(rssSnapshotStore.getSnapshot().data, recent)
  assert.equal(await rssSnapshotStore.refresh(), true)
  assert.equal(calls, 1)
})
