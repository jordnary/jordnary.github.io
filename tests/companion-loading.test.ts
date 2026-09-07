import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCompanionLoader, CompanionLoadError, classifyLoadError, type LoadState } from '../src/lib/companion-loading.ts'

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

test('a stalled attempt becomes slow, times out, aborts and disposes a late scene', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let complete!: (scene: { destroy: () => void }) => void
  let signal!: AbortSignal
  let destroyed = 0
  const states: LoadState[] = []
  const loader = createCompanionLoader({
    load: (next) => { signal = next; return new Promise((resolve) => { complete = resolve }) },
    change: (state) => states.push(state), ready: () => assert.fail('Late scene became ready'),
  })
  loader.start(); await flush()
  t.mock.timers.tick(5000)
  assert.equal(loader.state.slow, true)
  t.mock.timers.tick(25000)
  assert.equal(loader.state.failure, 'timeout')
  assert.equal(signal.aborted, true)
  complete({ destroy: () => { destroyed++ } }); await flush()
  assert.equal(destroyed, 1)
  loader.destroy()
  const count = states.length
  t.mock.timers.tick(100000)
  assert.equal(states.length, count)
})

test('rapid retry is deduplicated and a new attempt replaces a failed one', async () => {
  let calls = 0
  let destroyed = 0
  const loader = createCompanionLoader({
    async load() { if (++calls === 1) throw new CompanionLoadError('resource'); return { destroy: () => { destroyed++ } } },
    change() {}, ready() {},
  })
  loader.start(); loader.retry(); await flush()
  assert.equal(calls, 1)
  loader.retry(); loader.retry(); await flush()
  assert.equal(calls, 2)
  assert.equal(loader.state.status, 'ready')
  loader.destroy(); loader.destroy()
  assert.equal(destroyed, 1)
})

test('disposal before the import microtask prevents any resource request', async () => {
  const loader = createCompanionLoader({ load: async () => { assert.fail('Disposed load started') }, change() {}, ready() {} })
  loader.start(); loader.destroy(); await flush()
})

test('HTTP failures distinguish transient and permanent errors without retaining URLs', () => {
  for (const status of [0, 408, 429, 503]) assert.equal(classifyLoadError({ status }), 'network')
  for (const status of [400, 403, 404]) assert.equal(classifyLoadError({ status }), 'resource')
  assert.equal(classifyLoadError(new SyntaxError()), 'resource')
  assert.equal(classifyLoadError(new Error()), 'unknown')
})
