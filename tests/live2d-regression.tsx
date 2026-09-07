import { createRoot } from 'react-dom/client'
import { Live2DCompanion } from '../src/components/Live2DCompanion'
import '../src/index.css'

// This browser fixture is served by Vite only; it is not a production build entry.
// Use the actual model, renderer, DOM events and CSS without adding a test dependency.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const nextPaint = async () => { await delay(60) }
const checks = document.querySelector('#checks')!
let passed = 0
function check(condition: unknown, label: string) {
  const item = document.createElement('li')
  item.textContent = `${condition ? 'PASS' : 'FAIL'}: ${label}`
  checks.append(item)
  if (!condition) throw new Error(label)
  passed++
}
async function until(predicate: () => unknown) {
  const deadline = performance.now() + 25000
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error('Expected browser state timed out')
    await delay(100)
  }
}

class TestMedia extends EventTarget {
  matches: boolean
  media: string
  onchange = null
  constructor(media: string, matches: boolean) { super(); this.media = media; this.matches = matches }
  addListener(callback: EventListener) { this.addEventListener('change', callback) }
  removeListener(callback: EventListener) { this.removeEventListener('change', callback) }
  set(matches: boolean) {
    this.matches = matches
    this.dispatchEvent(new MediaQueryListEvent('change', { matches, media: this.media }))
  }
}

const compact = new TestMedia('(max-width: 767px), (pointer: coarse), (hover: none)', true)
const reduced = new TestMedia('(prefers-reduced-motion: reduce)', true)
const originalMatchMedia = window.matchMedia.bind(window)
window.matchMedia = (query) => {
  if (query.includes('max-width: 767px')) return compact as unknown as MediaQueryList
  if (query === reduced.media) return reduced as unknown as MediaQueryList
  return originalMatchMedia(query)
}
const storageKey = 'site-live2d-collapsed'
const originalPreference = localStorage.getItem(storageKey)
localStorage.removeItem(storageKey)
const root = createRoot(document.querySelector('#fixture')!)
let actionCount = 0
const render = (suspended = false) => root.render(<Live2DCompanion suspended={suspended} actions={[
  { id: 'test-action', label: 'Test page action', icon: <span>A</span>, onSelect: () => { actionCount++ } },
  { id: 'test-link', label: 'Test external link', icon: <span>L</span>, href: 'https://example.com/', external: true },
]} />)
const dialogue = () => document.querySelector('.live2d-dialogue')?.textContent ?? ''
const tools = () => document.querySelector('.live2d-tools') as HTMLElement
const visible = () => getComputedStyle(tools()).visibility === 'visible'

try {
  render()
  await nextPaint()
  check(!document.querySelector('.live2d-companion'), 'Mobile has neither a model nor a launcher')
  check(!performance.getEntriesByType('resource').some((entry) => /\/src\/lib\/live2d|\/live2d\/vampire|cubism|pixi/.test(entry.name)), 'Mobile does not request the rendering runtime or model assets')

  compact.set(false)
  await until(() => document.querySelector('canvas.is-ready'))
  const canvas = document.querySelector('.live2d-canvas-wrap canvas') as HTMLCanvasElement
  const container = document.querySelector('.live2d-canvas-wrap') as HTMLElement
  check(container.clientWidth >= 272 && container.clientHeight > 280, 'Desktop canvas is larger than the initial version')
  check(!visible(), 'Tools are hidden before interaction')
  check(!document.querySelector('.live2d-chat'), 'There is no separate chat control')

  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const context = copy.getContext('2d')!
  let solid: { x: number; y: number } | undefined
  let transparent: { x: number; y: number } | undefined
  const coordinates = (point: { x: number; y: number }) => {
    const rect = canvas.getBoundingClientRect()
    return {
      clientX: rect.left + point.x / container.clientWidth * rect.width,
      clientY: rect.top + point.y / container.clientHeight * rect.height,
    }
  }
  const mouse = (type: string, point = solid!, target: Element = document.body, extra: PointerEventInit = {}) => {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, detail: 1, ...coordinates(point), ...extra }))
  }
  const click = (point = solid!, target: Element = document.body, extra: PointerEventInit = {}) => {
    mouse('pointerdown', point, target, extra)
    mouse('pointerup', point, target, extra)
    mouse('click', point, target, extra)
  }
  // Warm the current frame, then derive test points from an independent 2D alpha copy.
  mouse('pointerdown', { x: container.clientWidth / 2, y: container.clientHeight / 2 })
  context.clearRect(0, 0, copy.width, copy.height)
  context.drawImage(canvas, 0, 0, copy.width, copy.height)
  const mountedPixels = context.getImageData(0, 0, copy.width, copy.height).data
  solid = undefined
  for (let y = Math.floor(copy.height * 0.45); y < copy.height * 0.85; y += 5) {
    for (let x = Math.floor(copy.width * 0.3); x < copy.width * 0.75; x += 5) {
      if (!solid && [0, -5, 5, -5 * copy.width, 5 * copy.width].every((offset) => mountedPixels[((y * copy.width + x) + offset) * 4 + 3] > 250)) {
        solid = { x: (x + 0.5) / copy.width * container.clientWidth, y: (y + 0.5) / copy.height * container.clientHeight }
      }
      if (!transparent && mountedPixels[(y * copy.width + x) * 4 + 3] === 0) {
        transparent = { x: (x + 0.5) / copy.width * container.clientWidth, y: (y + 0.5) / copy.height * container.clientHeight }
      }
    }
  }
  mouse('pointercancel', { x: 0, y: 0 })
  check(solid && transparent, 'Independent alpha snapshot has solid artwork and internal transparent space')
  click({ x: -1, y: 0 })
  click({ x: container.clientWidth, y: container.clientHeight })
  await nextPaint()
  check(!dialogue(), 'Outside canvas edges do not speak')
  click(transparent!)
  await nextPaint()
  check(!dialogue(), 'Clicking transparent artwork space does not speak')
  mouse('pointermove')
  await until(visible)
  check(visible(), 'Hovering solid artwork reveals tools without a click')
  mouse('pointermove', { x: -20, y: 0 })
  await nextPaint()
  check(visible(), 'Tools remain visible while crossing the gap')
  mouse('pointermove', solid!, tools())
  await delay(300)
  check(visible(), 'Entering the tool rail cancels delayed hiding')
  mouse('pointermove', { x: -20, y: 0 })
  await until(() => !visible())
  check(!visible(), 'Leaving the character and tools hides the rail')

  click()
  await nextPaint()
  const firstLine = dialogue()
  check(firstLine.length > 0, 'A primary click on visible artwork speaks')
  click(solid!, document.body, { ctrlKey: true })
  click(solid!, document.body, { button: 2 })
  click(solid!, document.body, { pointerType: 'touch' })
  await nextPaint()
  check(dialogue() === firstLine, 'Modified, secondary and touch clicks do not speak')
  mouse('pointerdown')
  mouse('pointermove', { x: solid!.x + 20, y: solid!.y })
  mouse('click')
  await nextPaint()
  check(dialogue() === firstLine, 'Dragging out and back does not speak')

  const underlyingButton = document.createElement('button')
  underlyingButton.textContent = 'Underlying page control'
  document.body.append(underlyingButton)
  click(solid!, underlyingButton)
  await nextPaint()
  check(dialogue() === firstLine, 'Underlying page controls take priority over character clicks')
  underlyingButton.remove()
  const selection = window.getSelection()!
  const range = document.createRange()
  range.selectNodeContents(document.querySelector('h1')!)
  selection.addRange(range)
  click()
  await nextPaint()
  check(dialogue() === firstLine, 'Selecting page text suppresses character clicks')
  selection.removeAllRanges()

  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await nextPaint()
  check(dialogue() !== firstLine, 'The character itself supports keyboard chat')
  const secondLine = dialogue()
  const action = document.querySelector('[aria-label="Test page action"]') as HTMLButtonElement
  action.click()
  await nextPaint()
  check(actionCount === 1 && dialogue() === secondLine, 'Reusable action controls invoke their handler without speaking')
  const link = document.querySelector('[aria-label="Test external link"]') as HTMLAnchorElement
  check(link.target === '_blank' && link.rel.includes('noopener') && link.href === 'https://example.com/', 'Reusable external links have the expected navigation attributes')

  const beforeSuspension = coordinates(solid!)
  render(true)
  await nextPaint()
  click(solid!, document.body, beforeSuspension)
  await nextPaint()
  check(document.querySelector('.live2d-companion')?.hasAttribute('hidden') && dialogue() === secondLine, 'Search suspension hides the companion and blocks interaction')
  render()
  await nextPaint()
  ;(document.querySelector('[aria-label="收起看板娘"]') as HTMLButtonElement).click()
  await nextPaint()
  check(!document.querySelector('.live2d-companion canvas') && !!document.querySelector('.live2d-launcher'), 'Collapse unmounts the canvas and preserves the launcher')
  check(localStorage.getItem(storageKey) === 'true', 'Desktop collapse preference is persisted')
  compact.set(true)
  await nextPaint()
  check(!document.querySelector('.live2d-companion'), 'Mobile also removes the collapsed launcher')
  compact.set(false)
  await nextPaint()
  check(!!document.querySelector('.live2d-launcher'), 'Returning to desktop preserves its collapsed preference')

  document.querySelector('#result')!.textContent = `${passed} checks passed`
} catch (error) {
  document.querySelector('#result')!.textContent = `Failed: ${error instanceof Error ? error.message : 'Unknown test failure'}`
} finally {
  root.unmount()
  window.matchMedia = originalMatchMedia
  if (originalPreference === null) localStorage.removeItem(storageKey)
  else localStorage.setItem(storageKey, originalPreference)
}
