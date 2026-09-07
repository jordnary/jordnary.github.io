import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syncGitHubSnapshot } from '../scripts/sync-github.mjs'
import { getGitHubSnapshot } from '../src/lib/github.ts'

const previous = {
  profile: { followers: 2, publicRepos: 5 }, repos: [], fetchedAt: '2025-01-01T00:00:00.000Z',
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
async function output(t) {
  const directory = await mkdtemp(join(tmpdir(), 'snapshot-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return join(directory, 'github.json')
}

test('sync publishes only three public original repositories and overwrites a single file', async (t) => {
  const outputPath = await output(t)
  const repo = { private: false, fork: false, archived: false, description: null,
    language: 'TypeScript', stargazers_count: 1, updated_at: previous.fetchedAt }
  const repos = [
    { ...repo, private: true }, { ...repo, fork: true }, { ...repo, archived: true },
    ...Array.from({ length: 5 }, (_, i) => ({ ...repo, name: `repo-${i}`, html_url: `https://github.com/example/repo-${i}` })),
  ]
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    assert.ok(options.signal)
    return json(url.includes('/repos?') ? repos : { followers: 2, public_repos: 5 })
  }
  for (let i = 0; i < 2; i++) await syncGitHubSnapshot({ outputPath, token: 'test-token', fetchImpl })
  const result = JSON.parse(await readFile(outputPath, 'utf8'))
  assert.deepEqual(result.repos.map((repo) => repo.name), ['repo-0', 'repo-1', 'repo-2'])
  assert.deepEqual(await readdir(join(outputPath, '..')), ['github.json'])
  assert.ok(!JSON.stringify(result).includes('test-token'))
})

test('fresh runner restores published snapshot after API rate limiting without changing its timestamp or sending credentials', async (t) => {
  const outputPath = await output(t)
  const result = await syncGitHubSnapshot({ outputPath, siteUrl: 'https://example.com/site', token: 'test-token',
    fetchImpl: async (url, options) => {
      if (String(url).startsWith('https://api.github.com/')) return json({}, 403)
      assert.equal(String(url), 'https://example.com/site/data/github.json')
      assert.equal(options.headers.Authorization, undefined)
      return json(previous)
    },
  })
  assert.equal(result.reused, true)
  assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), previous)
})

test('offline sync retains local snapshot, including its original timestamp', async (t) => {
  const outputPath = await output(t)
  await writeFile(outputPath, JSON.stringify(previous))
  const result = await syncGitHubSnapshot({ outputPath, fetchImpl: async () => { throw new Error('Offline') } })
  assert.deepEqual(result.snapshot, previous)
  assert.equal(result.reused, true)
})

test('invalid API data falls back to the newest valid snapshot', async (t) => {
  const outputPath = await output(t)
  await writeFile(outputPath, JSON.stringify(previous))
  const newer = { ...previous, fetchedAt: '2025-02-01T00:00:00.000Z' }
  const result = await syncGitHubSnapshot({ outputPath, fetchImpl: async (url) =>
    json(String(url).includes('api.github.com') ? {} : newer),
  })
  assert.deepEqual(result.snapshot, newer)
})

test('missing or corrupt fallback stops deployment without writing empty data', async (t) => {
  const outputPath = await output(t)
  await assert.rejects(syncGitHubSnapshot({ outputPath, fetchImpl: async () => json({}) }), /deployment stopped/)
  await assert.rejects(readFile(outputPath), { code: 'ENOENT' })
})

test('browser requests only the site snapshot and uses persistent cache on a failed refresh', async (t) => {
  const storage = new Map()
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/data/github.json')
    assert.equal(options.cache, 'no-cache')
    return json(previous)
  })
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    setItem: (key, value) => storage.set(key, value), getItem: (key) => storage.get(key),
  } } })
  t.after(() => { if (original) Object.defineProperty(globalThis, 'window', original); else delete globalThis.window })
  assert.deepEqual(await getGitHubSnapshot(), { snapshot: previous, fromCache: false })
  globalThis.fetch.mock.mockImplementation(async () => json({}, 503))
  assert.deepEqual(await getGitHubSnapshot(), { snapshot: previous, fromCache: true })
  storage.clear()
  await assert.rejects(getGitHubSnapshot(), /503/)
  storage.set('github-site-snapshot:v1', '{broken')
  await assert.rejects(getGitHubSnapshot(), /503/)
})
