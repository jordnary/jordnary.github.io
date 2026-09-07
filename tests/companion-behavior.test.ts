import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { companionInactivityDelay, companionMotions, createCompanionBehavior, type CompanionReaction } from '../src/lib/companion-behavior.ts'

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

test('published assets contain only the requested motions, with one-shot responses and looping idle', () => {
  const folder = new URL('../public/live2d/vampire/', import.meta.url)
  const model = JSON.parse(readFileSync(new URL('model.model3.json', folder), 'utf8'))
  const names = ['idle', ...Object.keys(companionMotions)].sort()
  assert.deepEqual(Object.keys(model.FileReferences.Motions).sort(), names)
  assert.deepEqual(readdirSync(new URL('motions/', folder)).sort(), names.map((name) => `${name}.motion3.json`).sort())
  for (const name of names) {
    const motion = JSON.parse(readFileSync(new URL(model.FileReferences.Motions[name][0].File, folder), 'utf8'))
    assert.equal(motion.Meta.Loop, name === 'idle')
    if (name !== 'idle') {
      assert.ok(Math.abs(motion.Meta.Duration * 1000 - companionMotions[name as CompanionReaction].duration) < 5)
      assert.equal(motion.Meta.FadeInTime, 0.25)
      assert.equal(motion.Meta.FadeOutTime, 0.35)
    }
  }
})

test('all requested responses follow four phases with their assigned dialogue', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const phases: string[] = [], played: string[] = []
  let idle = 0
  const behavior = createCompanionBehavior({
    prepare: async () => true, play: async (action) => { played.push(action); return true },
    idle: () => { idle++ }, reducedMotion: () => false, change: (state) => phases.push(state.phase),
  })
  for (const action of Object.keys(companionMotions) as CompanionReaction[]) {
    assert.equal(behavior.request(action), true)
    assert.equal(behavior.state.phase, 'noticing')
    if (!action.startsWith('main_')) assert.equal(behavior.request('touch_body'), false)
    t.mock.timers.tick(240); await flush()
    assert.equal(behavior.state.phase, 'responding')
    assert.equal(behavior.state.text, companionMotions[action].text)
    if (!action.startsWith('main_')) assert.equal(behavior.request('touch_special'), false)
    behavior.finish()
    assert.equal(behavior.state.phase, 'recovering')
    t.mock.timers.tick(450)
    assert.equal(behavior.state.phase, 'idle')
  }
  assert.deepEqual(played, Object.keys(companionMotions))
  assert.deepEqual(phases, Array(8).fill(['noticing', 'responding', 'recovering', 'idle']).flat())
  assert.equal(idle, 8)
  behavior.destroy()
})

test('late motion loads cannot replay after suspension, disabling or disposal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let ready!: (value: boolean) => void
  let plays = 0
  const behavior = createCompanionBehavior({ prepare: () => new Promise((resolve) => { ready = resolve }),
    play: async () => { plays++; return true }, idle: () => {}, reducedMotion: () => false, change: () => {},
  })
  behavior.request('touch_head')
  behavior.reset()
  ready(true)
  t.mock.timers.tick(10000); await flush()
  assert.equal(plays, 0)
  assert.equal(behavior.state.phase, 'idle')
  behavior.request('touch_body')
  behavior.destroy()
  ready(true)
  t.mock.timers.tick(10000); await flush()
  assert.equal(plays, 0)
  assert.equal(behavior.request('touch_head'), false)
})

test('reduced motion keeps text responses while skipping animation loads and playback', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const behavior = createCompanionBehavior({ prepare: async () => { assert.fail('No load in reduced motion') },
    play: async () => { assert.fail('No animation in reduced motion') }, idle: () => {}, reducedMotion: () => true, change: () => {},
  })
  behavior.request('touch_body')
  t.mock.timers.tick(1); await flush()
  assert.equal(behavior.state.text, companionMotions.touch_body.text)
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
    behavior.request('touch_head')
    t.mock.timers.tick(240); await flush()
    if (failure !== 'stall') assert.equal(behavior.state.text, companionMotions.touch_head.text)
    t.mock.timers.tick(15000); await flush()
    t.mock.timers.tick(450)
    assert.equal(behavior.state.phase, 'idle', failure)
    assert.equal(behavior.request('touch_body'), true)
    behavior.destroy()
  }
})

test('inactivity chooses each main action and schedules another only after a full interval', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const random = t.mock.method(Math, 'random', () => 0)
  const played: string[] = []
  const behavior = createCompanionBehavior({
    prepare: async () => true, play: async (action) => { played.push(action); return true },
    idle: () => {}, reducedMotion: () => false, change: () => {},
  })
  behavior.setAutoplay(true)
  for (let index = 0; index < 3; index++) {
    random.mock.mockImplementation(() => (index + 0.5) / 3)
    t.mock.timers.tick(companionInactivityDelay - (index === 0 ? 0 : 690) - 1)
    assert.equal(behavior.state.phase, 'idle')
    t.mock.timers.tick(1)
    t.mock.timers.tick(240); await flush()
    assert.equal(behavior.state.reaction, `main_${index + 1}`)
    behavior.finish()
    t.mock.timers.tick(450)
  }
  assert.deepEqual(played, ['main_1', 'main_2', 'main_3'])
  behavior.destroy()
})

test('character clicks postpone inactivity even when a response is busy; disabled and disposed timers stay silent', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const behavior = createCompanionBehavior({ prepare: async () => true, play: async () => true,
    idle: () => {}, reducedMotion: () => false, change: () => {},
  })
  behavior.setAutoplay(true)
  t.mock.timers.tick(companionInactivityDelay - 1000)
  behavior.request('touch_head')
  t.mock.timers.tick(240); await flush()
  t.mock.timers.tick(1000)
  assert.equal(behavior.request('touch_body'), false)
  behavior.finish()
  t.mock.timers.tick(companionInactivityDelay - 1)
  assert.equal(behavior.state.phase, 'idle')
  t.mock.timers.tick(1)
  assert.ok(behavior.state.reaction?.startsWith('main_'))
  behavior.setAutoplay(false)
  behavior.reset()
  t.mock.timers.tick(companionInactivityDelay * 2); await flush()
  assert.equal(behavior.state.phase, 'idle')
  behavior.setAutoplay(true)
  t.mock.timers.tick(companionInactivityDelay - 1)
  assert.equal(behavior.state.phase, 'idle')
  behavior.destroy()
  t.mock.timers.tick(companionInactivityDelay); await flush()
  assert.equal(behavior.state.phase, 'idle')
})

test('manual touch takes priority over automatic chatter and mail interrupts an existing response', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const played: string[] = []
  const behavior = createCompanionBehavior({ prepare: async () => true,
    play: async (action) => { played.push(action); return true },
    idle: () => {}, reducedMotion: () => false, change: () => {},
  })
  behavior.request('main_2')
  assert.equal(behavior.request('touch_body'), true)
  t.mock.timers.tick(240); await flush()
  assert.deepEqual(played, ['touch_body'])
  assert.equal(behavior.request('mail'), true)
  t.mock.timers.tick(240); await flush()
  assert.deepEqual(played, ['touch_body', 'mail'])
  assert.equal(behavior.state.text, companionMotions.mail.text)
  behavior.destroy()
})
