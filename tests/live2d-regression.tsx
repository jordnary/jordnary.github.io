import { createRoot } from 'react-dom/client'
import { Live2DCompanion } from '../src/components/Live2DCompanion'
import { githubProfileUrl } from '../src/lib/github'
import { contactProfile } from '../src/data/contact'
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
const chatStorageKey = 'site-live2d-chat-enabled'
const originalPreference = localStorage.getItem(storageKey)
const originalChatPreference = localStorage.getItem(chatStorageKey)
localStorage.removeItem(storageKey)
localStorage.removeItem(chatStorageKey)
let root = createRoot(document.querySelector('#fixture')!)
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
  check(container.clientWidth >= 192 && container.clientWidth <= 240 && container.clientHeight <= 336, 'Desktop canvas uses the compact reference size')
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
  const artwork = { left: copy.width, right: 0, top: copy.height }
  for (let y = 0; y < copy.height; y++) {
    for (let x = 0; x < copy.width; x++) {
      if (mountedPixels[(y * copy.width + x) * 4 + 3] < 24) continue
      artwork.left = Math.min(artwork.left, x)
      artwork.right = Math.max(artwork.right, x + 1)
      artwork.top = Math.min(artwork.top, y)
    }
  }
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
  mouse('pointermove', transparent!)
  await delay(800)
  check(visible(), 'Pausing in transparent space keeps tools visible beyond the old hide delay')
  click(transparent!)
  await nextPaint()
  check(!dialogue(), 'The expanded hover area does not expand the dialogue hit area')
  const railRect = tools().getBoundingClientRect()
  const modelRect = canvas.getBoundingClientRect()
  const railPoint = {
    x: (railRect.left + railRect.width / 2 - modelRect.left) / modelRect.width * container.clientWidth,
    y: (railRect.bottom - 12 - modelRect.top) / modelRect.height * container.clientHeight,
  }
  for (let step = 1; step <= 4; step++) {
    mouse('pointermove', {
      x: solid!.x + (railPoint.x - solid!.x) * step / 4,
      y: solid!.y + (railPoint.y - solid!.y) * step / 4,
    })
    await delay(600)
    check(visible(), `Slow travel to the tool rail stays open at step ${step}`)
  }
  mouse('pointermove', { x: -20, y: 0 })
  await nextPaint()
  check(visible(), 'Tools remain visible while crossing the gap')
  mouse('pointermove', solid!, tools())
  // Allow the last extended tool's staggered transition to finish before measuring.
  await delay(450)
  check(visible(), 'Entering the tool rail cancels delayed hiding')
  const canvasRect = canvas.getBoundingClientRect()
  const toolRects = Array.from(tools().querySelectorAll('.live2d-tool'), (tool) => tool.getBoundingClientRect())
  const toolsInside = toolRects.every((rect) => rect.left >= canvasRect.left + canvasRect.width * 0.75 && rect.right <= canvasRect.right && rect.top >= 0 && rect.bottom <= window.innerHeight)
  check(toolsInside, 'Tools sit inside the right side of the canvas without reserving external space')
  check(Math.abs(canvasRect.bottom - toolRects.at(-1)!.bottom - 8) <= 1, 'The tool rail is anchored beside the lower part of the character')
  check(document.documentElement.clientWidth - canvasRect.right <= 3 && window.innerHeight - canvasRect.bottom <= 8, 'The character canvas moves a few pixels closer to the right edge')
  check(toolRects.every((rect) => rect.width >= 24 && rect.width <= 28 && rect.height >= 24 && rect.height <= 28), 'Tool buttons scale with the character and retain a usable target size')
  mouse('pointermove', { x: -20, y: 0 })
  await until(() => !visible())
  check(!visible(), 'Leaving the character and tools hides the rail')

  click()
  await nextPaint()
  const firstLine = dialogue()
  check(firstLine.length > 0, 'A primary click on visible artwork speaks')
  const bubbleRect = document.querySelector('.live2d-dialogue p')!.getBoundingClientRect()
  const artworkCenter = canvasRect.left + (artwork.left + artwork.right) / 2 / copy.width * canvasRect.width
  const artworkTop = canvasRect.top + artwork.top / copy.height * canvasRect.height
  check(Math.abs(bubbleRect.left + bubbleRect.width / 2 - artworkCenter) < 3, 'Dialogue is horizontally centered above visible artwork')
  check(artworkTop - bubbleRect.bottom >= 4 && artworkTop - bubbleRect.bottom <= 18, 'Dialogue sits close above the artwork without covering it')
  check(bubbleRect.left >= 0 && bubbleRect.right <= document.documentElement.clientWidth && bubbleRect.top >= 0, 'The resized dialogue stays within the viewport')
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
  const github = document.querySelector('[aria-label="访问 GitHub 主页"]') as HTMLAnchorElement
  check(github.href === githubProfileUrl && github.target === '_blank' && github.rel.includes('noopener'), 'Built-in GitHub action links to the configured profile in a new tab')
  const email = document.querySelector('[aria-label="通过 Gmail 联系我"]') as HTMLAnchorElement
  check(email.href === `mailto:${contactProfile.email}`, 'Built-in email action addresses the configured Gmail contact')
  check(document.querySelector('[aria-label="关闭人物点击对话"]')?.getAttribute('aria-pressed') === 'true', 'Character chat is enabled by default')

  const beforeSuspension = coordinates(solid!)
  render(true)
  await nextPaint()
  click(solid!, document.body, beforeSuspension)
  await nextPaint()
  check(document.querySelector('.live2d-companion')?.hasAttribute('hidden') && dialogue() === secondLine, 'Search suspension hides the companion and blocks interaction')
  render()
  await nextPaint()
  ;(document.querySelector('[aria-label="关闭人物点击对话"]') as HTMLButtonElement).click()
  await nextPaint()
  check(!dialogue() && container.getAttribute('aria-disabled') === 'true', 'Disabling chat immediately clears its bubble and updates accessibility state')
  check(localStorage.getItem(chatStorageKey) === 'false' && document.querySelector('[aria-label="开启人物点击对话"]')?.getAttribute('aria-pressed') === 'false', 'Disabled chat preference and tool state agree')
  click()
  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  container.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
  await nextPaint()
  check(!dialogue(), 'Disabled chat blocks both pointer and keyboard dialogue')
  mouse('pointermove', solid!, tools())
  await until(visible)
  action.click()
  check(visible() && actionCount === 2, 'Disabling chat leaves the tool rail and other actions usable')
  ;(document.querySelector('[aria-label="开启人物点击对话"]') as HTMLButtonElement).click()
  await nextPaint()
  click()
  await nextPaint()
  check(!!dialogue() && localStorage.getItem(chatStorageKey) === 'true', 'Re-enabling chat restores character clicks and persists the setting')
  ;(document.querySelector('[aria-label="关闭人物点击对话"]') as HTMLButtonElement).click()
  await nextPaint()
  ;(document.querySelector('[aria-label="收起看板娘"]') as HTMLButtonElement).click()
  await nextPaint()
  check(!document.querySelector('.live2d-companion canvas') && !!document.querySelector('.live2d-launcher'), 'Collapse unmounts the canvas and preserves the launcher')
  // Measure after the launcher's arrival animation reaches its resting position.
  await delay(300)
  const launcherRect = document.querySelector('.live2d-launcher')!.getBoundingClientRect()
  check(document.documentElement.clientWidth - launcherRect.right >= 23 && window.innerHeight - launcherRect.bottom >= 23, 'The collapsed launcher has comfortable right and bottom margins')
  check(launcherRect.width >= 43.5 && launcherRect.height >= 43.5, 'The collapsed launcher retains its accessible target size')
  check(localStorage.getItem(storageKey) === 'true', 'Desktop collapse preference is persisted')
  compact.set(true)
  await nextPaint()
  check(!document.querySelector('.live2d-companion'), 'Mobile also removes the collapsed launcher')
  compact.set(false)
  await nextPaint()
  check(!!document.querySelector('.live2d-launcher'), 'Returning to desktop preserves its collapsed preference')
  ;(document.querySelector('.live2d-launcher') as HTMLButtonElement).click()
  await until(() => document.querySelector('canvas.is-ready'))
  check(document.querySelector('[aria-label="开启人物点击对话"]')?.getAttribute('aria-pressed') === 'false', 'Chat stays disabled after mobile transitions and collapse/reopen')
  root.unmount()
  root = createRoot(document.querySelector('#fixture')!)
  render()
  await until(() => document.querySelector('canvas.is-ready'))
  const restoredContainer = document.querySelector('.live2d-canvas-wrap') as HTMLElement
  restoredContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await nextPaint()
  check(!dialogue() && restoredContainer.getAttribute('aria-disabled') === 'true', 'A fresh mount restores the disabled chat preference from storage')
  ;(document.querySelector('[aria-label="开启人物点击对话"]') as HTMLButtonElement).click()
  await nextPaint()
  restoredContainer.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
  await nextPaint()
  check(!!dialogue(), 'Keyboard users can re-enable chat after restoring a disabled preference')

  document.querySelector('#result')!.textContent = `${passed} checks passed`
} catch (error) {
  document.querySelector('#result')!.textContent = `Failed: ${error instanceof Error ? error.message : 'Unknown test failure'}`
} finally {
  root.unmount()
  window.matchMedia = originalMatchMedia
  if (originalPreference === null) localStorage.removeItem(storageKey)
  else localStorage.setItem(storageKey, originalPreference)
  if (originalChatPreference === null) localStorage.removeItem(chatStorageKey)
  else localStorage.setItem(chatStorageKey, originalChatPreference)
}
