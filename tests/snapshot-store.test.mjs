import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { createSnapshotStore, SNAPSHOT_FRESH_MS, SNAPSHOT_MAX_AGE_MS } from '../src/lib/snapshot-store.ts'
import { isGitHubSnapshot } from '../src/lib/github-snapshot.ts'
import { isRssFeed } from '../src/lib/rss-snapshot.ts'

const start = Date.parse('2026-11-06T00:00:00Z')
const json = value => new Response(JSON.stringify(value))
const envelope = (data, sourceTime) => JSON.stringify({ version: 1, sourceUpdatedAt: sourceTime(data), data })
const sources = [
  { name: 'GitHub', validate: isGitHubSnapshot, sourceTime: data => data.fetchedAt,
    make: (time, id = 1) => ({ fetchedAt: new Date(time).toISOString(), profile: { followers: id, publicRepos: 1 }, repos: [] }) },
  { name: 'RSS', validate: isRssFeed, sourceTime: data => data.generatedAt,
    make: (time, id = 1) => ({ generatedAt: new Date(time).toISOString(), items: [{ id: String(id), title: 'Article', description: 'Excerpt', publishedAt: null, source: 'Example', sourceUrl: 'https://example.com', url: 'https://example.com/article' }] }) },
]
function setup(source, { cached, storageError, timeoutMs } = {}) {
  let time = start
  let calls = 0
  let reply = async () => json(source.make(time))
  const values = new Map(cached === undefined ? [] : [['current', cached]])
  const storage = { getItem: key => values.get(key), setItem: (key, value) => { if (storageError === 'write') throw new Error('Quota'); values.set(key, value) }, removeItem: key => values.delete(key) }
  const options = { key: 'current', legacyKey: 'legacy', url: '/data/example.json', validate: source.validate, sourceTime: source.sourceTime, now: () => time, timeoutMs,
    storage: () => { if (storageError === 'read') throw new Error('Disabled'); return storage },
    fetchImpl: async (url, options) => { calls++; assert.equal(url, '/data/example.json'); assert.equal(options.cache, 'no-cache'); return reply(options.signal) },
  }
  return { store: createSnapshotStore(options), recreate: () => createSnapshotStore(options), values, calls: () => calls,
    advance: ms => { time += ms }, reply: fn => { reply = fn } }
}
for (const source of sources) {
  test(`${source.name}: cached content is synchronous, revalidation atomic, and consumers share ownership`, async () => {
    const cached = source.make(start - 3600000)
    const next = source.make(start, 2)
    const fixture = setup(source, { cached: envelope(cached, source.sourceTime) })
    let release
    fixture.reply(() => new Promise(resolve => { release = () => resolve(json(next)) }))
    assert.deepEqual(fixture.store.getSnapshot().data, cached)
    assert.equal(fixture.calls(), 0)
    const events = []
    let detachedEvents = 0
    const detach = fixture.store.subscribe(() => detachedEvents++)
    const stop = fixture.store.subscribe(() => events.push(fixture.store.getSnapshot()))
    const request = fixture.store.refresh()
    assert.equal(request, fixture.store.refresh(true))
    await Promise.resolve()
    assert.equal(fixture.calls(), 1)
    assert.deepEqual(fixture.store.getSnapshot().data, cached)
    detach()
    release()
    assert.equal(await request, true)
    assert.equal(detachedEvents, 1)
    assert.deepEqual(events.map(event => event.status), ['loading', 'ready'])
    assert.deepEqual(events[1].data, next)
    stop()
    assert.deepEqual(JSON.parse(fixture.values.get('current')), { version: 1, sourceUpdatedAt: source.sourceTime(next), data: next })
  })
  test(`${source.name}: freshness, forced refresh, new-session validation and source expiry are separate`, async () => {
    const fixture = setup(source)
    await fixture.store.refresh()
    fixture.advance(SNAPSHOT_FRESH_MS - 1)
    await fixture.store.refresh()
    assert.equal(fixture.calls(), 1)
    await fixture.store.refresh(true)
    assert.equal(fixture.calls(), 2)
    fixture.advance(SNAPSHOT_FRESH_MS)
    await fixture.store.refresh()
    assert.equal(fixture.calls(), 3)
    const reopened = fixture.recreate()
    assert.ok(reopened.getSnapshot().data)
    await reopened.refresh()
    assert.equal(fixture.calls(), 4, 'Persistent data is revalidated in a new session')
    fixture.advance(SNAPSHOT_MAX_AGE_MS + 1)
    assert.equal(fixture.store.getSnapshot().data, null, 'Expired memory is never displayed on reopen')
    assert.equal(fixture.recreate().getSnapshot().data, null)
  })
  test(`${source.name}: failures, malformed JSON, outdated responses and expiry never replace good data`, async () => {
    const fixture = setup(source)
    const good = source.make(start)
    await fixture.store.refresh()
    const saved = fixture.values.get('current')
    for (const reply of [() => { throw new Error('Offline') }, () => new Response('', { status: 503 }), () => new Response('{broken'), () => json({}),
      () => json(source.make(start - SNAPSHOT_MAX_AGE_MS - 1)), () => json(source.make(start - 1)), () => json(source.make(start + 3600000))]) {
      fixture.reply(reply)
      assert.equal(await fixture.store.refresh(true), false)
      assert.deepEqual(fixture.store.getSnapshot(), { data: good, status: 'error', stale: true })
      assert.equal(fixture.values.get('current'), saved)
    }
    fixture.reply(() => json(source.make(start, 2)))
    assert.equal(await fixture.store.refresh(), true, 'A later consumer retries failure without a freshness delay')
    fixture.advance(SNAPSHOT_MAX_AGE_MS + 1)
    assert.equal(await fixture.store.refresh(), false)
    assert.equal(fixture.store.getSnapshot().data, null)
  })
  test(`${source.name}: corrupted, incompatible, inconsistent and expired persisted records are ignored`, async () => {
    const good = source.make(start)
    for (const cached of ['{broken', '{}', JSON.stringify(good), JSON.stringify({ version: 9, data: good }),
      JSON.stringify({ version: 1, data: good, sourceUpdatedAt: 'wrong' }), envelope(source.make(start - SNAPSHOT_MAX_AGE_MS - 1), source.sourceTime), envelope(source.make(start + 3600000), source.sourceTime)]) {
      const fixture = setup(source, { cached })
      assert.equal(fixture.store.getSnapshot().data, null)
      assert.equal(await fixture.store.refresh(), true)
      assert.deepEqual(fixture.store.getSnapshot().data, good)
    }
  })
  test(`${source.name}: storage denial/quota does not affect successful network data or memory reuse`, async () => {
    for (const storageError of ['read', 'write']) {
      const fixture = setup(source, { storageError })
      assert.equal(await fixture.store.refresh(), true)
      assert.ok(fixture.store.getSnapshot().data)
      await fixture.store.refresh()
      assert.equal(fixture.calls(), 1)
    }
  })
  test(`${source.name}: bounded timeouts reset the request and preserve valid stale content`, async () => {
    const cached = source.make(start - 1000)
    const fixture = setup(source, { cached: envelope(cached, source.sourceTime), timeoutMs: 15 })
    fixture.reply(signal => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })))
    const request = fixture.store.refresh()
    await delay(30)
    assert.equal(await request, false)
    assert.deepEqual(fixture.store.getSnapshot().data, cached)
    fixture.reply(() => json(source.make(start)))
    assert.equal(await fixture.store.refresh(), true)
  })
}
test('valid GitHub legacy data migrates without changing its source time', async () => {
  const source = sources[0]
  const fixture = setup(source)
  const cached = source.make(start - 1000)
  fixture.values.set('legacy', JSON.stringify(cached))
  assert.deepEqual(fixture.store.getSnapshot().data, cached)
  fixture.reply(() => json(cached))
  await fixture.store.refresh()
  assert.equal(fixture.values.has('legacy'), false)
  assert.equal(JSON.parse(fixture.values.get('current')).sourceUpdatedAt, cached.fetchedAt)
})
test('RSS validates source timestamps, item dates, links and unique IDs while allowing an empty feed', () => {
  const good = sources[1].make(start)
  assert.equal(isRssFeed({ ...good, items: [] }), true)
  for (const invalid of [{ ...good, generatedAt: 'invalid' }, { ...good, items: [good.items[0], good.items[0]] },
    ...['url', 'sourceUrl', 'publishedAt'].map(field => ({ ...good, items: [{ ...good.items[0], [field]: 'invalid' }] }))]) {
    assert.equal(isRssFeed(invalid), false)
  }
})
