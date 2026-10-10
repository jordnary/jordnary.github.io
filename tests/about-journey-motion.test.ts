import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createChapterMotion } from '../src/components/aboutJourneyMotion.ts'

// Test the delayed visibility lifecycle without needing a rendering engine.
function chapterFixture() {
  const chapter = {
    dataset: {} as Record<string, string>, querySelectorAll: () => [],
    ownerDocument: { timeline: { currentTime: 1000 } },
  }
  const motion = createChapterMotion(chapter as unknown as HTMLElement)
  motion.reset(true)
  return { chapter, motion }
}

test('exit waits before changing visibility and repeated scroll frames do not postpone it', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { chapter, motion } = chapterFixture()
  motion.deferExit(450)
  t.mock.timers.tick(300)
  motion.deferExit(450)
  t.mock.timers.tick(149)
  assert.equal(chapter.dataset.reached, 'true')
  t.mock.timers.tick(1)
  assert.equal(chapter.dataset.reached, 'false')
})

test('reversing scroll cancels the pending exit and a later crossing gets a fresh delay', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { chapter, motion } = chapterFixture()
  motion.deferExit(450)
  t.mock.timers.tick(300)
  motion.cancelExit()
  t.mock.timers.tick(1000)
  assert.equal(chapter.dataset.reached, 'true')
  motion.deferExit(450)
  t.mock.timers.tick(449)
  assert.equal(chapter.dataset.reached, 'true')
  t.mock.timers.tick(1)
  assert.equal(chapter.dataset.reached, 'false')
})

test('revealing again or switching motion mode prevents a stale delayed exit', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { chapter, motion } = chapterFixture()
  motion.deferExit(450)
  motion.reveal(true)
  t.mock.timers.tick(1000)
  assert.equal(chapter.dataset.reached, 'true')
  motion.deferExit(450)
  motion.reset(true)
  t.mock.timers.tick(1000)
  assert.equal(chapter.dataset.reached, 'true')
})

test('leaving the page cancels its delayed exit without changing detached content', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { chapter, motion } = chapterFixture()
  motion.deferExit(450)
  motion.dispose()
  t.mock.timers.tick(1000)
  assert.equal(chapter.dataset.reached, undefined)
})

function animatedFixture() {
  const recordings: {
    name: string
    frames: Record<string, string>[]
    timing: { delay: number; duration: number }
    animation: { startTime: number | null; cancel: () => void }
  }[] = []
  const selectors = ['.journey-node', '.journey-rail', '.journey-card', '.journey-card-heading',
    '.journey-card h2', '.journey-card-copy', '.journey-card-tags', '.journey-digit-reel']
  const elements = new Map(selectors.map(selector => [selector,
    Array.from({ length: selector === '.journey-digit-reel' ? 2 : 1 }, (_, index) => ({
      style: { opacity: '1', transform: 'none', height: '368px' },
      children: [{}, {}, {}],
      animate(frames: Record<string, string>[], timing: { delay: number; duration: number }) {
        const animation = { startTime: null as number | null, cancel() {} }
        recordings.push({ name: `${selector}:${index}`, frames, timing, animation })
        return animation
      },
    })),
  ]))
  const chapter = {
    dataset: {}, querySelectorAll: (selector: string) => elements.get(selector) ?? [],
    ownerDocument: {
      timeline: { currentTime: 1000 },
      defaultView: { getComputedStyle: (element: { style: unknown }) => element.style },
    },
  }
  const motion = createChapterMotion(chapter as unknown as HTMLElement)
  motion.reset(false)
  return { motion, recordings, elements }
}

test('line, card, content and staggered digits share the same entrance finish frame', () => {
  const { motion, recordings } = animatedFixture()
  motion.reveal(true)
  const moving = recordings.filter(record => !record.name.startsWith('.journey-node'))
  assert.equal(new Set(moving.map(({ animation, timing }) => animation.startTime! + timing.delay + timing.duration)).size, 1)
  assert.equal(moving[0].animation.startTime! + moving[0].timing.delay + moving[0].timing.duration, 1666)
  const digits = moving.filter(record => record.name.startsWith('.journey-digit-reel'))
  assert.ok(digits[0].timing.delay < digits[1].timing.delay)
  const line = moving.find(record => record.name.startsWith('.journey-rail'))!
  assert.equal(line.frames[0].height, '0px')
  assert.ok(line.frames[1].height.includes('100%'))
  assert.equal('opacity' in line.frames[1], false)
  assert.equal('transform' in line.frames[1], false)
})

test('all layers finish exiting together, including reversed digit stagger and node', () => {
  const { motion, recordings } = animatedFixture()
  motion.reset(true)
  motion.reveal(false)
  assert.deepEqual([...new Set(recordings.map(({ animation, timing }) => animation.startTime! + timing.delay + timing.duration))], [1540])
  const digits = recordings.filter(record => record.name.startsWith('.journey-digit-reel'))
  assert.ok(digits[0].timing.delay > digits[1].timing.delay)
  const line = recordings.find(record => record.name.startsWith('.journey-rail'))!
  assert.equal(line.frames[1].height, '0px')
})

test('reversing a growing line starts shrinking from its rendered height', () => {
  const { motion, recordings, elements } = animatedFixture()
  motion.reveal(true)
  elements.get('.journey-rail')![0].style.height = '184px'
  recordings.length = 0
  motion.reveal(false)
  const line = recordings.find(record => record.name.startsWith('.journey-rail'))!
  assert.equal(line.frames[0].height, '184px')
  assert.equal(line.frames[1].height, '0px')
})
