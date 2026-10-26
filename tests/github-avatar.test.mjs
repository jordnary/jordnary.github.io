import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { syncGitHubAvatar } from '../scripts/sync-github-avatar.mjs'

const avatarUrl = 'https://avatars.githubusercontent.com/u/1?v=4'
const image = color => sharp({ create: { width: 512, height: 512, channels: 3, background: color } }).png().toBuffer()
async function output(t) {
  const directory = await mkdtemp(join(tmpdir(), 'avatar-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return join(directory, 'github-avatar.webp')
}

test('avatar sync creates a small local WebP without sending API credentials', async (t) => {
  const outputPath = await output(t)
  const source = await image('#334455')
  const result = await syncGitHubAvatar({ avatarUrl, outputPath, fetchImpl: async (url, options) => {
    assert.equal(url.origin, 'https://avatars.githubusercontent.com')
    assert.equal(url.searchParams.get('s'), '256')
    assert.equal(options.headers?.Authorization, undefined)
    assert.ok(options.signal)
    return new Response(source)
  } })
  assert.equal(result.status, 'updated')
  const metadata = await sharp(await readFile(outputPath)).metadata()
  assert.equal(metadata.format, 'webp')
  assert.equal(metadata.width, 256)
  assert.equal(metadata.height, 256)
  assert.ok(result.bytes < source.length)
  assert.deepEqual(await readdir(join(outputPath, '..')), ['github-avatar.webp'])
})

test('unchanged content keeps the asset and timestamp, while a new image at the same URL replaces it', async (t) => {
  const outputPath = await output(t)
  let source = await image('#334455')
  const options = { avatarUrl, outputPath, fetchImpl: async () => new Response(source) }
  await syncGitHubAvatar(options)
  const previous = await readFile(outputPath)
  await utimes(outputPath, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'))
  const before = (await stat(outputPath)).mtimeMs
  assert.equal((await syncGitHubAvatar(options)).status, 'unchanged')
  assert.equal((await stat(outputPath)).mtimeMs, before)
  assert.deepEqual(await readFile(outputPath), previous)

  source = await image('#aa8844')
  assert.equal((await syncGitHubAvatar(options)).status, 'updated')
  assert.notDeepEqual(await readFile(outputPath), previous)
  assert.deepEqual(await readdir(join(outputPath, '..')), ['github-avatar.webp'])
})

test('offline, HTTP failures and corrupt images preserve the bundled default', async (t) => {
  const outputPath = await output(t)
  const previous = await sharp(await image('#334455')).webp().toBuffer()
  await writeFile(outputPath, previous)
  for (const fetchImpl of [
    async () => { throw new Error('Offline') },
    async () => new Response('', { status: 503 }),
    async () => new Response('<html>not an image</html>'),
  ]) {
    assert.equal((await syncGitHubAvatar({ avatarUrl, outputPath, fetchImpl })).status, 'retained')
    assert.deepEqual(await readFile(outputPath), previous)
  }
  assert.deepEqual(await readdir(join(outputPath, '..')), ['github-avatar.webp'])
})

test('a snapshot without an avatar retains the default without making a request', async (t) => {
  const outputPath = await output(t)
  const previous = await sharp(await image('#334455')).webp().toBuffer()
  await writeFile(outputPath, previous)
  const result = await syncGitHubAvatar({ outputPath, fetchImpl: async () => assert.fail('No avatar request expected') })
  assert.equal(result.status, 'retained')
  assert.deepEqual(await readFile(outputPath), previous)
})

test('failed first sync does not create a broken default image', async (t) => {
  const outputPath = await output(t)
  await assert.rejects(syncGitHubAvatar({ avatarUrl, outputPath, fetchImpl: async () => new Response('', { status: 503 }) }), /no local avatar/)
  assert.deepEqual(await readdir(join(outputPath, '..')), [])
})
