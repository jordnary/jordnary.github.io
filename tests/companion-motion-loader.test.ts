import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMotionLoader } from '../src/lib/companion-motion-loader.ts'

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

test('failed motion caches reset after cooldown, with concurrent requests merged', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  let requests = 0
  let resets = 0
  const controller = new AbortController()
  const loader = createMotionLoader({
    async load() { return ++requests === 1 ? undefined : 'motion' },
    reset() { resets++ }, networkFailure: () => false,
  }, controller.signal)
  const first = loader.load('touch_body', 0)
  assert.equal(loader.load('touch_body', 0), first)
  assert.equal(await first, undefined)
  loader.connected()
  assert.equal(await loader.load('touch_body', 0), undefined)
  t.mock.timers.tick(30000)
  assert.equal(await loader.load('touch_body', 0), 'motion')
  assert.equal(requests, 2)
  assert.equal(resets, 1)
  controller.abort()
})

test('online releases only network cooldown and late motion completion does not replay', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const controller = new AbortController()
  let finish!: (value: string) => void
  let calls = 0
  const loader = createMotionLoader({
    load: async () => { if (++calls === 1) return undefined; return new Promise<string>((resolve) => { finish = resolve }) },
    reset() {}, networkFailure: () => true,
  }, controller.signal)
  await loader.load('mail', 0)
  loader.connected()
  const second = loader.load('mail', 0)
  await flush(); t.mock.timers.tick(8000)
  assert.equal(await second, undefined)
  assert.equal(await loader.load('mail', 0), undefined)
  assert.equal(calls, 2)
  finish('motion'); await flush()
  assert.equal(await second, undefined)
  controller.abort()
  assert.equal(await loader.load('mail', 0), undefined)
})
