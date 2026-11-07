import assert from 'node:assert/strict'
import test from 'node:test'
import { createDigitScene } from '../src/pages/notFoundMotion.ts'

type Scene = ReturnType<typeof createDigitScene>
const step = 1000 / 120
function advance(scene: Scene, milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds && !scene.asleep; elapsed += step) scene.step()
}
function visibleCount(scene: Scene) {
  const [, , width, height] = scene.viewBox.split(' ').map(Number)
  return scene.digits.filter(({ body, escaped }) => !escaped && body.bounds.min.x < width
    && body.bounds.max.x > 0 && body.bounds.min.y < height && body.bounds.max.y > 0).length
}

test('the leading digit reaches the floor within a second, then the pile settles', () => {
  const scene = createDigitScene(1440, 826)
  try {
    assert.ok(scene.digits.every(({ body }) => body.bounds.max.y < 20))
    advance(scene, 350)
    assert.ok(visibleCount(scene) > 0, 'The entrance has no long empty lead-in')
    advance(scene, 450)
    assert.ok(scene.digits[2].body.bounds.max.y > 1335, 'The leading four has reached the floor')
    advance(scene, 12000)
    assert.ok(scene.asleep)
    assert.equal(visibleCount(scene), 3)
    const positions = scene.digits.map(({ body }) => ({ ...body.position }))
    advance(scene, 1000)
    assert.deepEqual(scene.digits.map(({ body }) => body.position), positions)
  } finally { scene.dispose() }
})

test('continuous contraction stacks the digits without launching or losing them', () => {
  const scene = createDigitScene(1440, 826), scale = 826 / 1340
  try {
    advance(scene, 12000)
    const angles = scene.digits.map(({ body }) => body.angle)
    let lifted = false
    for (let width = 1404; width >= 576; width -= 36) {
      scene.resize(width, 826)
      for (let frame = 0; frame < 9; frame++) {
        scene.step()
        for (const { body, escaped } of scene.digits) {
          assert.equal(escaped, false)
          assert.ok(body.bounds.min.y * scale > -30, 'Squeezing must not throw a digit above the screen')
          assert.ok(Math.abs(body.velocity.x) * scale * 60 < 650, 'Sideways momentum stays controlled')
          assert.ok(-body.velocity.y * scale * 60 < 500, 'Upward rebound stays controlled')
          lifted ||= body.bounds.min.y * scale < 350
        }
      }
    }
    assert.ok(lifted)
    advance(scene, 12000)
    assert.equal(visibleCount(scene), 3)
    assert.ok(scene.digits.some(({ body }, i) => Math.abs(body.angle - angles[i]) > .15),
      'Contacts still allow the pile to turn and find a new resting pose')
  } finally { scene.dispose() }
})

test('abrupt shrinking retains a visible pile and does not recreate its bodies', () => {
  for (const [width, height] of [[440, 280], [390, 844], [900, 520]]) {
    const scene = createDigitScene(1440, 826)
    try {
      advance(scene, 12000)
      const bodies = scene.digits.map(digit => digit.body)
      scene.resize(width, height)
      assert.ok(visibleCount(scene) > 0, 'The resize itself must not blank the drawing')
      for (let frame = 0; frame < 360; frame++) {
        scene.step()
        assert.ok(visibleCount(scene) > 0, 'The smaller viewport keeps part of the pile in view')
        assert.ok(scene.digits.every(digit => !digit.escaped))
      }
      scene.resize(1440, 826)
      advance(scene, 12000)
      assert.deepEqual(scene.digits.map(digit => digit.body), bodies)
      assert.equal(visibleCount(scene), 3)
    } finally { scene.dispose() }
  }
})

test('a burst of small resize events cannot outrun the supporting floor', () => {
  const scene = createDigitScene(1440, 826)
  try {
    advance(scene, 12000)
    for (let height = 786; height >= 266; height -= 40) {
      scene.resize(1440, height)
      scene.step()
      assert.ok(visibleCount(scene) > 0, 'Accumulated resize movement keeps the pile visible')
    }
    advance(scene, 4000)
    assert.ok(visibleCount(scene) > 0)
    assert.ok(scene.digits.every(digit => !digit.escaped))
  } finally { scene.dispose() }
})

test('expansion lets one or two unsupported digits fall away through continuous motion', () => {
  for (const [width, lost] of [[1440, 1], [1200, 2]]) {
    const scene = createDigitScene(width, 826)
    try {
      advance(scene, 12000)
      const positions = scene.digits.map(({ body }) => ({ ...body.position }))
      scene.resize(2560, 1440)
      assert.deepEqual(scene.digits.map(({ body }) => body.position), positions,
        'Expansion preserves positions instead of scaling or replaying the digits')
      advance(scene, 400)
      assert.equal(visibleCount(scene), 3, 'Loss of support has a visible falling interval')
      assert.ok(scene.digits.every(({ body }, i) => body.position.y > positions[i].y + 100))
      let crossedBottom = false
      for (let frame = 0; frame < 600; frame++) {
        scene.step()
        const height = Number(scene.viewBox.split(' ')[3])
        crossedBottom ||= scene.digits.some(({ body, escaped }) => !escaped
          && body.bounds.min.y < height && body.bounds.max.y > height + 30)
      }
      assert.ok(crossedBottom, 'A falling digit is clipped progressively by the bottom edge')
      assert.equal(scene.digits.filter(digit => digit.escaped).length, lost)
      assert.equal(visibleCount(scene), 3 - lost)
      scene.resize(2800, 1600)
      advance(scene, 4000)
      assert.ok(scene.digits.filter(digit => digit.escaped).length >= lost,
        'A later resize does not bring departed digits back')
    } finally { scene.dispose() }
  }
})
