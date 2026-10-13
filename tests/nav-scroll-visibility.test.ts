import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createNavScrollVisibility } from '../src/lib/navScrollVisibility.ts'

function reader(initialTop = 300) {
  const visibility = createNavScrollVisibility(initialTop)
  let top = initialTop
  let now = 0
  return (movement: number, elapsed = 50, keepVisible = false, source: 'manual' | 'navigation' = 'manual') => {
    top += movement
    now += elapsed
    return visibility({ top, now, headerHeight: 72, keepVisible, source })
  }
}

test('repeated short reading corrections do not flicker, at fast or slow speeds', () => {
  for (const elapsed of [20, 180, 800]) {
    const scroll = reader()
    for (let cycle = 0; cycle < 12; cycle++) {
      for (const movement of [40, -24, 30, -32]) {
        assert.equal(scroll(movement, elapsed), false)
      }
    }
  }
})

test('pauses separate reading adjustments while sustained downward browsing hides', () => {
  const scroll = reader()
  for (let step = 0; step < 8; step++) assert.equal(scroll(45, 800), false)
  assert.equal(scroll(45), false)
  assert.equal(scroll(45), true)
})

test('a small upward gesture reveals immediately, including during the hide transition', () => {
  const scroll = reader()
  assert.equal(scroll(180), true)
  assert.equal(scroll(-4, 16), true)
  assert.equal(scroll(1, 16), true)
  assert.equal(scroll(-5, 16), false)
})

test('a short reversal remains visible but clear downward intent hides without a timed hold', () => {
  const scroll = reader()
  assert.equal(scroll(180), true)
  assert.equal(scroll(-10, 16), false)
  assert.equal(scroll(40, 16), false)
  assert.equal(scroll(140, 16), true)
  assert.equal(scroll(-8, 16), false)
})

test('recent backtracking increases resistance, and sustained downward movement overcomes it promptly', () => {
  assert.equal(reader()(135), true, 'An unambiguous initial downward gesture hides normally')
  for (const elapsed of [16, 100]) {
    const scroll = reader()
    for (let cycle = 0; cycle < 6; cycle++) {
      assert.equal(scroll(40, elapsed), false)
      assert.equal(scroll(-40, elapsed), false)
    }
    assert.equal(scroll(135, elapsed), false, 'Recent rereading dynamically protects the same downward distance')
    assert.equal(scroll(70, elapsed), true, 'Continuing downward overrides the protection without a timer')
    assert.equal(scroll(-8, 16), false, 'Reading resistance never delays upward reveal')
  }
})

test('waiting cannot hide a stationary header or reuse pre-pause travel', () => {
  const scroll = reader()
  assert.equal(scroll(180), true)
  assert.equal(scroll(-10), false)
  assert.equal(scroll(80), false)
  assert.equal(scroll(0, 900), false)
  assert.equal(scroll(20), false)
  assert.equal(scroll(-10), false)
})

test('anchor jumps and restoration reveal and reset without contributing to manual scroll intent', () => {
  const scroll = reader()
  assert.equal(scroll(180), true)
  for (const movement of [0, 300, 200, -100, 600]) {
    assert.equal(scroll(movement, 16, false, 'navigation'), false)
  }
  assert.equal(scroll(35), false)
  assert.equal(scroll(150), true)
  assert.equal(scroll(-8, 16), false)
})

test('minor trackpad noise does not prevent hiding after clear net downward movement', () => {
  const scroll = reader()
  for (let step = 0; step < 4; step++) {
    assert.equal(scroll(25), false)
    assert.equal(scroll(-0.5), false)
  }
  assert.equal(scroll(30), true)
})

test('open menus and keyboard focus reveal the header and discard prior downward intent', () => {
  const scroll = reader()
  assert.equal(scroll(180), true)
  assert.equal(scroll(0, 10, true), false)
  assert.equal(scroll(400, 50, true), false)
  assert.equal(scroll(0), false)
  assert.equal(scroll(40), false)
  assert.equal(scroll(90), true)
})

test('the top of the page stays visible and starts a fresh downward gesture', () => {
  const scroll = reader(0)
  assert.equal(scroll(50), false)
  assert.equal(scroll(80), false)
  assert.equal(scroll(70), true)
  assert.equal(scroll(-150), false)
  assert.equal(scroll(60), false)
})

test('mounting at a restored scroll position starts visible without synthetic movement', () => {
  const scroll = reader(900)
  assert.equal(scroll(0), false)
  assert.equal(scroll(30), false)
  assert.equal(scroll(100), true)
})
