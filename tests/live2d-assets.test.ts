import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadCompanionAssets } from '../src/lib/live2d-assets.ts'

const source = { Version: 3, FileReferences: { Moc: 'model.moc3', Textures: ['texture.webp'], Physics: 'physics.json' } }
const modelURL = 'https://example.test/live2d/model.model3.json'

test('essential resource failure aborts sibling requests and reports a permanent error', async (t) => {
  const signals: AbortSignal[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    if (url === modelURL) return Response.json(source)
    signals.push(options.signal as AbortSignal)
    if (url.endsWith('.moc3')) return new Response('', { status: 404 })
    return new Promise((_resolve, reject) => options.signal!.addEventListener('abort', () => reject(options.signal!.reason)))
  })
  await assert.rejects(loadCompanionAssets(modelURL, new AbortController().signal), { kind: 'resource' })
  assert.ok(signals.length >= 2)
  assert.ok(signals.every((signal) => signal.aborted))
})

test('aborting a hanging fetch cancels the actual request', async (t) => {
  let requested!: AbortSignal
  t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => {
    requested = options.signal as AbortSignal
    return new Promise((_resolve, reject) => requested.addEventListener('abort', () => reject(requested.reason)))
  })
  const controller = new AbortController()
  const pending = loadCompanionAssets(modelURL, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(requested.aborted, true)
})

test('invalid settings are rejected before fetching their referenced files', async (t) => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => { requests++; return Response.json({ Version: 3, FileReferences: { Textures: [] } }) })
  await assert.rejects(loadCompanionAssets(modelURL, new AbortController().signal), { kind: 'resource' })
  assert.equal(requests, 1)
})
