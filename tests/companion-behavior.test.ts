import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCompanionBehavior } from '../src/lib/companion-behavior.ts'

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

test('responses follow all four phases and ignore competing clicks and completion events', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const phases: string[] = [], played: string[] = []
  let idle = 0
  const behavior = createCompanionBehavior({
    prepare: async () => true, play: async (action) => { played.push(action); return true },
    idle: () => { idle++ }, reducedMotion: () => false, change: (state) => phases.push(state.phase),
  })
  for (const action of ['headpat', 'greeting', 'complete'] as const) {
    assert.equal(behavior.request(action, action), true)
    assert.equal(behavior.state.phase, 'noticing')
    assert.equal(behavior.request('greeting', 'duplicate'), false)
    t.mock.timers.tick(240); await flush()
    assert.equal(behavior.state.phase, 'responding')
    assert.equal(behavior.state.text, action)
    assert.equal(behavior.request('complete', 'interrupt'), false)
    behavior.finish()
    assert.equal(behavior.state.phase, 'recovering')
    t.mock.timers.tick(450)
    assert.equal(behavior.state.phase, 'idle')
  }
  assert.deepEqual(played, ['headpat', 'greeting', 'complete'])
  assert.deepEqual(phases, Array(3).fill(['noticing', 'responding', 'recovering', 'idle']).flat())
  assert.equal(idle, 3)
  assert.equal(behavior.request('complete', 'duplicate completion'), false)
  behavior.destroy()
})

test('late motion loads cannot replay after suspension, disabling or disposal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let ready!: (value: boolean) => void
  let plays = 0
  const behavior = createCompanionBehavior({ prepare: () => new Promise((resolve) => { ready = resolve }),
    play: async () => { plays++; return true }, idle: () => {}, reducedMotion: () => false, change: () => {},
  })
  behavior.request('headpat', 'old response')
  behavior.reset()
  ready(true)
  t.mock.timers.tick(10000); await flush()
  assert.equal(plays, 0)
  assert.equal(behavior.state.phase, 'idle')
  behavior.request('greeting', 'disposed response')
  behavior.destroy()
  ready(true)
  t.mock.timers.tick(10000); await flush()
  assert.equal(plays, 0)
  assert.equal(behavior.request('headpat', 'ignored'), false)
})

test('reduced motion keeps text responses while skipping animation loads and playback', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const behavior = createCompanionBehavior({ prepare: async () => { assert.fail('No load in reduced motion') },
    play: async () => { assert.fail('No animation in reduced motion') }, idle: () => {}, reducedMotion: () => true, change: () => {},
  })
  behavior.request('greeting', 'Hello')
  t.mock.timers.tick(1); await flush()
  assert.equal(behavior.state.text, 'Hello')
  t.mock.timers.tick(1801)
  assert.equal(behavior.state.phase, 'idle')
  behavior.destroy()
})

test('failed, stalled and unfinished motions recover without trapping the character', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const failure of ['load', 'start', 'stall', 'finish']) {
    const behavior = createCompanionBehavior({
      prepare: () => failure === 'stall' ? new Promise(() => {}) : failure === 'load' ? Promise.reject(new Error('Unavailable')) : Promise.resolve(true),
      play: async () => failure !== 'start', idle: () => {}, reducedMotion: () => false, change: () => {},
    })
    behavior.request('headpat', 'Fallback')
    t.mock.timers.tick(240); await flush()
    if (failure !== 'stall') assert.equal(behavior.state.text, 'Fallback')
    t.mock.timers.tick(15000); await flush()
    t.mock.timers.tick(450)
    assert.equal(behavior.state.phase, 'idle', failure)
    assert.equal(behavior.request('greeting', 'Recovered'), true)
    behavior.destroy()
  }
})
