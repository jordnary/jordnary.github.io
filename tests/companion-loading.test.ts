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

test('transient failures retry twice, stop while hidden, and do not loop on online events', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  let available = false
  let online = true
  let attempts = 0
  const loader = createCompanionLoader({
    async load() { attempts++; throw new CompanionLoadError('network') },
    change() {}, ready() {}, available: () => available, online: () => online,
  })
  loader.start(); await flush()
  t.mock.timers.tick(10000); await flush()
  assert.equal(attempts, 1)
  available = true; online = false; loader.sync()
  assert.equal(loader.state.status, 'offline')
  online = true; loader.connected(); loader.connected()
  t.mock.timers.tick(0); await flush()
  assert.equal(attempts, 2)
  t.mock.timers.tick(4999); await flush()
  assert.equal(attempts, 2)
  t.mock.timers.tick(1); await flush()
  assert.equal(attempts, 3)
  assert.equal(loader.state.status, 'error')
  loader.connected(); t.mock.timers.tick(60000); await flush()
  assert.equal(attempts, 3)
  loader.destroy()
})

test('WebGL recovery waits for restoration or timeout and is limited to two per minute', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  let attempts = 0
  let destroys = 0
  const loader = createCompanionLoader({
    async load() { attempts++; return { destroy() { destroys++ } } }, change() {}, ready() {},
  })
  loader.start(); await flush()
  loader.contextLost(); loader.contextLost()
  assert.equal(destroys, 1)
  t.mock.timers.tick(9999); await flush()
  assert.equal(attempts, 1)
  loader.contextRestored(); t.mock.timers.tick(0); await flush()
  assert.equal(attempts, 2)
  loader.contextLost(); t.mock.timers.tick(10000); await flush()
  assert.equal(attempts, 3)
  loader.contextLost(); loader.contextRestored(); t.mock.timers.tick(10000); await flush()
  assert.equal(attempts, 3)
  assert.equal(loader.state.failure, 'webgl')
  assert.equal(loader.state.status, 'error')
  loader.destroy()
})

test('a failed WebGL rebuild does not create another automatic network retry loop', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  let attempts = 0
  const loader = createCompanionLoader({
    async load() {
      if (++attempts > 1) throw new CompanionLoadError('network')
      return { destroy() {} }
    }, change() {}, ready() {},
  })
  loader.start(); await flush()
  loader.contextLost(); loader.contextRestored()
  t.mock.timers.tick(0); await flush()
  assert.equal(loader.state.status, 'error')
  t.mock.timers.tick(60000); await flush()
  assert.equal(attempts, 2)
  loader.destroy()
})
