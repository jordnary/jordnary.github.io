import { createRoot } from 'react-dom/client'
import { Live2DCompanion } from '../src/components/Live2DCompanion'
import '../src/index.css'

// Run in a viewport narrower than 768px to exercise the real mobile CSS.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let passed = 0
function check(condition: unknown, label: string) {
  const item = document.createElement('li')
  item.textContent = `${condition ? 'PASS' : 'FAIL'}: ${label}`
  document.querySelector('#checks')!.append(item)
  if (!condition) throw new Error(label)
  passed++
}
async function until(predicate: () => unknown, timeout = 25000) {
  const deadline = performance.now() + timeout
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error('Expected mobile state timed out')
    await delay(50)
  }
}
const visible = () => {
  const tools = document.querySelector('.live2d-tools')
  return !!tools && getComputedStyle(tools).visibility === 'visible'
}
let selected = 0
const root = createRoot(document.querySelector('#fixture')!)
try {
  check(window.innerWidth < 768, 'Fixture uses a mobile viewport')
  root.render(<Live2DCompanion suspended={false} actions={[
    { id: 'test-action', label: 'Test mobile action', icon: <span>A</span>, onSelect: () => { selected++ } },
  ]} />)
  await until(() => document.querySelector('.live2d-launcher'))
  document.querySelector('.live2d-launcher')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  await until(() => document.querySelector('canvas.is-ready') && visible())
  check(visible(), 'Expanding on mobile briefly reveals the tools')
  check(!document.querySelector('.live2d-stage :focus-visible'), 'Pointer expansion does not transfer keyboard focus')
  const tool = document.querySelector('[aria-label="Test mobile action"]') as HTMLButtonElement
  check(getComputedStyle(tool).width === '32px' && getComputedStyle(tool).minHeight === '32px', 'Mobile tools shrink from 44px to 32px')
  await until(() => !visible(), 4500)
  check(!visible() && getComputedStyle(tool).pointerEvents === 'none', 'Idle tools automatically hide and stop intercepting taps')

  const canvas = document.querySelector('canvas.is-ready')!
  const rect = canvas.getBoundingClientRect()
  const touch = (target: Element = document.body, outside = false, type = 'pointerup') => {
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, pointerId: 2, pointerType: 'touch', isPrimary: true,
      clientX: outside ? 5 : rect.left + rect.width / 2,
      clientY: outside ? 5 : rect.bottom - 25,
    }))
  }
  touch()
  await until(visible, 1000)
  check(visible(), 'Touching the character area reveals hidden tools')
  touch(document.documentElement, false, 'pointerleave')
  await delay(700)
  check(visible(), 'Touch release pointerleave does not dismiss tools prematurely')
  await delay(1300)
  touch(tool)
  tool.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  await delay(1500)
  check(selected === 1 && visible(), 'Tool actions work and refresh the hide timer')
  await until(() => !visible(), 2500)
  check(!visible(), 'Tools hide after the refreshed timeout')
  touch()
  await until(visible, 1000)
  touch(document.body, true)
  await until(() => !visible(), 1000)
  check(!visible(), 'Touching outside dismisses the tools early')
  touch()
  await until(visible, 1000)
  window.dispatchEvent(new Event('scroll'))
  await until(() => !visible(), 1000)
  check(!visible(), 'Scrolling dismisses the tools early')
  touch()
  await until(visible, 1000)
  touch(document.body, false, 'pointercancel')
  await until(() => !visible(), 1000)
  check(!visible(), 'Canceled touch dismisses the tools')

  const pageButton = document.createElement('button')
  document.body.append(pageButton)
  touch(pageButton)
  await delay(400)
  check(!visible(), 'Underlying page controls do not reveal the tools')
  pageButton.remove()

  const container = document.querySelector('.live2d-canvas-wrap') as HTMLElement
  container.focus()
  await until(visible, 1000)
  await delay(3400)
  check(visible(), 'Keyboard focus keeps the tool rail accessible')
  container.blur()
  await until(() => !visible(), 1000)
  check(!visible(), 'Leaving keyboard focus restores the hidden state')
  document.querySelector('#result')!.textContent = `${passed} checks passed`
} catch (error) {
  document.querySelector('#result')!.textContent = `Failed: ${error instanceof Error ? error.message : 'Unknown test failure'}`
} finally {
  root.unmount()
}
