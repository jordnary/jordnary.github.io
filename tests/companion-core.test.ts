import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCompanionCoreLoader } from '../src/lib/companion-core.ts'

const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve() }

test('Core consumers share one attempt; cancelling one retains the other', async () => {
  let calls = 0
  let finish!: () => void
  let present = false
  const load = createCompanionCoreLoader(() => {
    calls++
    return new Promise(resolve => { finish = resolve })
  }, () => present)
  const first = new AbortController(), second = new AbortController()
  const a = load(first.signal), b = load(second.signal)
  first.abort()
  await assert.rejects(a, { name: 'AbortError' }); await flush()
  assert.equal(calls, 1)
  present = true; finish(); await b
  await load(new AbortController().signal)
  assert.equal(calls, 1)
})

test('rapid reopen reuses an already dispatched script after the previous consumer cancels', async () => {
  let requests = 0
  let finish!: () => void
  const load = createCompanionCoreLoader(() => {
    requests++
    return new Promise(resolve => { finish = resolve })
  }, () => false)
  const first = new AbortController()
  const a = load(first.signal); await flush()
  first.abort(); await assert.rejects(a, { name: 'AbortError' })
  const b = load(new AbortController().signal); await flush()
  const c = load(new AbortController().signal); await flush()
  assert.equal(requests, 1)
  finish(); await Promise.all([b, c])
})

test('Core rejection resets shared state and cancellation before work avoids a request', async () => {
  let calls = 0
  const load = createCompanionCoreLoader(async () => { if (++calls === 1) throw new Error('network') }, () => false)
  const first = new AbortController()
  const cancelled = load(first.signal); first.abort()
  await assert.rejects(cancelled, { name: 'AbortError' }); await flush()
  assert.equal(calls, 0)
  const signal = new AbortController().signal
  await assert.rejects(load(signal), /network/)
  await load(signal)
  assert.equal(calls, 2)
})
