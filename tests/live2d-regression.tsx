import { createRoot } from 'react-dom/client'
import { Live2DCompanion } from '../src/components/Live2DCompanion'
import { githubProfileUrl } from '../src/lib/github'
import { contactProfile } from '../src/data/contact'
import { companionMotions } from '../src/lib/companion-behavior'
import { Contact } from '../src/components/Contact'
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
async function until(predicate: () => unknown, timeout = 25000) {
  const deadline = performance.now() + timeout
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
    if (this.media === '(prefers-reduced-motion: reduce)') document.documentElement.dataset.testReducedMotion = String(matches)
    this.dispatchEvent(new MediaQueryListEvent('change', { matches, media: this.media }))
  }
}

const compact = new TestMedia('(max-width: 767px), (pointer: coarse), (hover: none)', true)
const reduced = new TestMedia('(prefers-reduced-motion: reduce)', true)
document.documentElement.dataset.testReducedMotion = 'true'
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
const phase = () => document.querySelector('.live2d-stage')?.getAttribute('data-phase')
const reaction = () => document.querySelector('.live2d-stage')?.getAttribute('data-reaction')
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
  check(phase() === 'idle' && !dialogue(), 'An initially expanded page starts in idle without playing home')
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
      clientX: rect.left + point.x / canvas.clientWidth * rect.width,
      clientY: rect.top + point.y / canvas.clientHeight * rect.height,
    }
  }
  const mouse = (type: string, point = solid!, target?: Element, extra: PointerEventInit = {}) => {
    const position = coordinates(point)
    const receiver = target ?? document.elementFromPoint(position.clientX, position.clientY) ?? document.body
    receiver.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, detail: 1, ...position, ...extra }))
  }
  const click = (point = solid!, target?: Element, extra: PointerEventInit = {}) => {
    mouse('pointerdown', point, target, extra)
    mouse('pointerup', point, target, extra)
    mouse('click', point, target, extra)
  }
  // Warm the current frame, then derive test points from an independent 2D alpha copy.
  mouse('pointerdown', { x: container.clientWidth / 2, y: container.clientHeight / 2 })
  context.clearRect(0, 0, copy.width, copy.height)
  context.drawImage(canvas, 0, 0, copy.width, copy.height)
  const mountedPixels = context.getImageData(0, 0, copy.width, copy.height).data
  const artwork = { left: copy.width, right: 0, top: copy.height, bottom: 0 }
  for (let y = 0; y < copy.height; y++) {
    for (let x = 0; x < copy.width; x++) {
      if (mountedPixels[(y * copy.width + x) * 4 + 3] < 24) continue
      artwork.left = Math.min(artwork.left, x)
      artwork.right = Math.max(artwork.right, x + 1)
      artwork.top = Math.min(artwork.top, y)
      artwork.bottom = Math.max(artwork.bottom, y + 1)
    }
  }
  solid = undefined
  for (let y = Math.floor(copy.height * 0.45); y < copy.height * 0.85; y += 5) {
    for (let x = Math.floor(copy.width * 0.3); x < copy.width * 0.75; x += 5) {
      if (!transparent && mountedPixels[(y * copy.width + x) * 4 + 3] === 0) {
        transparent = { x: (x + 0.5) / copy.width * canvas.clientWidth, y: (y + 0.5) / copy.height * canvas.clientHeight }
      }
    }
  }
  const artworkPoint = (x: number, y: number) => ({
    x: (artwork.left + (artwork.right - artwork.left) * x) / copy.width * canvas.clientWidth,
    y: (artwork.top + (artwork.bottom - artwork.top) * y) / copy.height * canvas.clientHeight,
  })
  // Annotated torso and head landmarks, relative to the artwork (not canvas padding).
  solid = artworkPoint(0.36, 0.64)
  mouse('pointercancel', { x: 0, y: 0 })
  check(solid && transparent, 'Independent alpha snapshot has solid artwork and internal transparent space')
  const bodyPosition = coordinates(solid)
  check(document.elementFromPoint(bodyPosition.clientX, bodyPosition.clientY)?.closest('main[tabindex="-1"]'), 'Character clicks pass through to content inside the navigation focus target')
  click({ x: -1, y: 0 })
  click({ x: canvas.clientWidth, y: canvas.clientHeight })
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
    x: (railRect.left + railRect.width / 2 - modelRect.left) / modelRect.width * canvas.clientWidth,
    y: (railRect.bottom - 12 - modelRect.top) / modelRect.height * canvas.clientHeight,
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

  click(artworkPoint(0.65, 0.15))
  await nextPaint()
  check(!dialogue(), 'Opaque backdrop pixels do not trigger a character reaction')
  click(artworkPoint(0.42, 0.36))
  await nextPaint()
  check(reaction() === 'touch_head' && dialogue() === companionMotions.touch_head.text, 'A head click selects the head-pat response and its own dialogue')
  await until(() => phase() === 'idle')

  click(artworkPoint(0.4, 0.5))
  await nextPaint()
  check(reaction() === 'touch_special' && dialogue() === companionMotions.touch_special.text, 'A chest click selects touch_special and its exact dialogue')
  await until(() => phase() === 'idle')

  click()
  await nextPaint()
  const firstLine = dialogue()
  check(firstLine.length > 0, 'A primary click on the body speaks')
  check(reaction() === 'touch_body' && dialogue() === companionMotions.touch_body.text, 'Other body parts select touch_body and its exact dialogue')
  click()
  await nextPaint()
  check(dialogue() === firstLine, 'Rapid clicks cannot interrupt an active touch response')
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

  await until(() => phase() === 'idle')
  for (const [tag, attributes, label] of [
    ['button', { tabindex: '-1' }, 'Native buttons outside the tab order'],
    ['a', { tabindex: '-1', href: '#page-content' }, 'Links outside the tab order'],
    ['div', { tabindex: '-1', role: 'button' }, 'ARIA buttons outside the tab order'],
    ['div', { tabindex: '0' }, 'Tabbable custom controls'],
    ['div', { contenteditable: 'true' }, 'Editable content'],
  ] as const) {
    const control = document.createElement(tag)
    for (const [name, value] of Object.entries(attributes)) control.setAttribute(name, value)
    const child = document.createElement('span')
    child.textContent = label
    control.append(child)
    document.querySelector('#page-content')!.append(control)
    // Prevent native navigation while still exercising the companion's window listener.
    const preventNavigation = (event: MouseEvent) => event.preventDefault()
    window.addEventListener('click', preventNavigation, { once: true })
    click(solid, child)
    await nextPaint()
    check(phase() === 'idle' && !dialogue(), `${label} keep priority over an idle character, including their descendants`)
    control.remove()
  }
  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await nextPaint()
  check(dialogue() === firstLine && reaction() === 'touch_body', 'Keyboard chat uses the same body action and dialogue')
  const secondLine = dialogue()
  const mail = document.querySelector('[aria-label="通过 Gmail 联系我"]') as HTMLAnchorElement
  // Exercise the link handler without opening an external mail application.
  mail.addEventListener('click', (event) => event.preventDefault(), { once: true })
  mail.click()
  await nextPaint()
  check(reaction() === 'mail' && dialogue() === companionMotions.mail.text, 'The mailbox link triggers mail even while a touch response is active')
  await until(() => phase() === 'idle')
  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await nextPaint()
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
  check(document.querySelector('.live2d-companion')?.hasAttribute('hidden') && !dialogue() && phase() === 'idle', 'Search suspension hides the companion and cancels its response')
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
  const { Live2DModel } = await import('pixi-live2d-display/cubism4')
  const originalMotion = Live2DModel.prototype.motion
  const entranceMotions: string[] = []
  Live2DModel.prototype.motion = function (...args) {
    entranceMotions.push(args[0])
    return originalMotion.apply(this, args)
  }
  reduced.set(false)
  ;(document.querySelector('.live2d-launcher') as HTMLButtonElement).click()
  render(true)
  await until(() => document.querySelector('canvas.is-ready'))
  check(phase() === 'idle' && !dialogue(), 'An expansion that finishes loading while suspended waits before playing home')
  check(entranceMotions.join(',') === 'home', 'Expansion prepares home as its first motion without ever starting idle')
  await delay(8500)
  check(phase() === 'idle' && entranceMotions.join(',') === 'home', 'A hidden entrance stays on its first frame beyond the normal motion timeout')
  render()
  await until(() => reaction() === 'home' && phase() === 'responding')
  check(!dialogue(), 'Expanding from collapsed triggers home while keeping dialogue hidden when chat is disabled')
  check(entranceMotions.join(',') === 'home', 'Revealing the prepared canvas does not restart home')
  const entranceStarted = performance.now()
  await until(() => phase() === 'recovering')
  check(performance.now() - entranceStarted < 7500, 'Home returns to idle through its actual finish event')
  await until(() => phase() === 'idle')
  check(entranceMotions[0] === 'home' && entranceMotions.slice(1).every((motion) => motion === 'idle'), 'Entrance playback is home followed only by idle')
  Live2DModel.prototype.motion = originalMotion
  reduced.set(true)
  check(document.querySelector('[aria-label="开启人物点击对话"]')?.getAttribute('aria-pressed') === 'false', 'Chat stays disabled after mobile transitions and collapse/reopen')
  root.unmount()
  root = createRoot(document.querySelector('#fixture')!)
  render()
  await until(() => document.querySelector('canvas.is-ready'))
  check(phase() === 'idle', 'Restoring an expanded preference on a fresh mount does not replay home')
  const restoredContainer = document.querySelector('.live2d-canvas-wrap') as HTMLElement
  restoredContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await nextPaint()
  check(!dialogue() && restoredContainer.getAttribute('aria-disabled') === 'true', 'A fresh mount restores the disabled chat preference from storage')
  ;(document.querySelector('[aria-label="开启人物点击对话"]') as HTMLButtonElement).click()
  await nextPaint()
  restoredContainer.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
  await nextPaint()
  check(!!dialogue(), 'Keyboard users can re-enable chat after restoring a disabled preference')

  await until(() => phase() === 'idle')
  reduced.set(false)
  restoredContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await nextPaint()
  check(phase() === 'noticing' && !dialogue(), 'Animated body response first notices the user without speaking over the transition')
  await until(() => phase() === 'responding')
  const responseStarted = performance.now()
  check(reaction() === 'touch_body' && !!dialogue(), 'The body response starts after attention')
  await until(() => phase() === 'recovering')
  check(performance.now() - responseStarted < 8500, 'Body recovery uses the actual motion finish rather than its timeout fallback')
  check(!dialogue(), 'Actual motion completion starts recovery and clears dialogue')
  await until(() => phase() === 'idle')
  check(phase() === 'idle', 'A real non-looping body response returns to idle')

  await until(() => phase() === 'responding' && reaction()?.startsWith('main_'), 95000)
  const ambient = reaction() as 'main_1' | 'main_2' | 'main_3'
  check(dialogue() === companionMotions[ambient].text, 'Real inactivity triggers a random main action with its matching dialogue')
  restoredContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await until(() => phase() === 'responding' && reaction() === 'touch_body')
  check(dialogue() === companionMotions.touch_body.text, 'A deliberate interaction replaces automatic chatter')

  // Exercise the actual contact handler without changing the browser clipboard.
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  const originalCopy = document.execCommand
  try {
    let resolveCopy!: () => void
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>((resolve) => { resolveCopy = resolve }) } })
    root.render(<><Contact /><Live2DCompanion suspended={false} /></>)
    await nextPaint()
    ;(document.querySelector('.contact-copy-button') as HTMLButtonElement).click()
    await nextPaint()
    check(!document.querySelector('.toast'), 'Pending copy operations do not claim completion')
    resolveCopy()
    await until(() => document.querySelector('.toast'))
    check(document.querySelector('.toast')?.textContent === '已复制邮箱', 'Successful copying shows its success toast')
    await until(() => !document.querySelector('.toast'))
    check(!dialogue(), 'Copy success does not trigger unused completion actions')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Clipboard unavailable')) } })
    document.execCommand = () => false
    ;(document.querySelector('.contact-copy-button') as HTMLButtonElement).click()
    await until(() => document.querySelector('.toast'))
    check(document.querySelector('.toast')?.textContent?.startsWith('复制失败'), 'Failed clipboard and fallback operations display a failure message')
    await until(() => !document.querySelector('.toast'))
    await nextPaint()
    check(!dialogue(), 'Failed operations do not trigger a character response')
  } finally {
    document.execCommand = originalCopy
    if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
    else Reflect.deleteProperty(navigator, 'clipboard')
  }

  document.querySelector('#result')!.textContent = `${passed} checks passed`
} catch (error) {
  document.querySelector('#result')!.textContent = `Failed: ${error instanceof Error ? error.message : 'Unknown test failure'}`
} finally {
  root.unmount()
  delete document.documentElement.dataset.testReducedMotion
  window.matchMedia = originalMatchMedia
  if (originalPreference === null) localStorage.removeItem(storageKey)
  else localStorage.setItem(storageKey, originalPreference)
  if (originalChatPreference === null) localStorage.removeItem(chatStorageKey)
  else localStorage.setItem(chatStorageKey, originalChatPreference)
}
