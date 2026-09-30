import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App'
import { companionIntroductions } from '../src/data/companion-introductions'
import { getRouteHref, sitePages, siteRoutes, type SitePage } from '../src/lib/routes'
import '../src/index.css'

// Exercise production navigation and the real WebGL scene in one document.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(predicate: () => unknown, timeout = 25000) {
  const deadline = performance.now() + timeout
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error('Expected navigation state timed out')
    await delay(50)
  }
}
let passed = 0
const check = (condition: unknown, label: string) => {
  const item = document.createElement('li')
  item.textContent = `${condition ? 'PASS' : 'FAIL'}: ${label}`
  document.querySelector('#checks')!.append(item)
  if (!condition) throw new Error(label)
  passed++
}
const originalUrl = window.location.href
const originalState = history.state
const preferenceKeys = ['site-live2d-collapsed', 'site-live2d-chat-enabled']
const preferences = preferenceKeys.map((key) => localStorage.getItem(key))
preferenceKeys.forEach((key) => localStorage.removeItem(key))
const sessionKeys = ['site-live2d-collapsed-desktop', 'site-live2d-collapsed-mobile']
const sessionPreferences = sessionKeys.map((key) => sessionStorage.getItem(key))
sessionKeys.forEach((key) => sessionStorage.removeItem(key))
const root = createRoot(document.querySelector('#root')!)
const modelRequests = () => performance.getEntriesByType('resource').filter((entry) => /\/live2d\/vampire\//.test(entry.name)).length
const phase = () => document.querySelector('.live2d-stage')?.getAttribute('data-phase')
const dialogue = () => document.querySelector('.live2d-dialogue')?.textContent
const navigate = async (page: SitePage) => {
  const link = document.querySelector<HTMLAnchorElement>(`nav a[href="${getRouteHref(page)}"]`)!
  link.click()
  await until(() => document.body.dataset.page === page)
  await delay(80)
}
try {
  history.replaceState(null, '', getRouteHref('home'))
  root.render(<StrictMode><App page="home" /></StrictMode>)
  await until(() => document.querySelector('canvas.is-ready'))
  const canvas = document.querySelector('.live2d-canvas-wrap canvas')!
  const companion = document.querySelector('.live2d-companion')!
  check(phase() === 'idle', 'Fresh navigation begins with idle, without home')
  await until(() => dialogue() === companionIntroductions.home)
  const initialRequests = modelRequests()
  for (const page of sitePages.slice(1)) {
    await navigate(page)
    check(dialogue() === companionIntroductions[page] && phase() === 'idle', `${page}: page introduction replaces the previous line without a reaction`)
  }
  check(modelRequests() === initialRequests, 'Introductions do not request motion assets')
  await delay(6200)
  check(dialogue() === '', 'Introduction disappears after six seconds')
  await navigate('contact')
  check(dialogue() === '', 'Clicking the current page does not repeat its introduction')
  await navigate('home')
  const character = document.querySelector('.live2d-canvas-wrap')!
  character.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await until(() => phase() === 'responding')
  const manualDialogue = dialogue()
  const requests = modelRequests()
  for (const page of [...sitePages.slice(1), 'home'] as SitePage[]) {
    await navigate(page)
    check(document.title === siteRoutes[page].title
      && document.querySelector('meta[name="description"]')?.getAttribute('content') === siteRoutes[page].description
      && !!document.querySelector(`nav a[aria-current="page"][href="${getRouteHref(page)}"]`), `${page}: content, metadata and active navigation agree`)
    check(document.querySelector('.live2d-canvas-wrap canvas') === canvas
      && canvas.classList.contains('is-ready') && document.querySelector('.live2d-companion') === companion,
    `${page}: the same ready canvas and companion remain mounted`)
    check(phase() === 'responding' && document.querySelector('.live2d-stage')?.getAttribute('data-reaction') === 'touch_body', `${page}: navigation preserves the playing response`)
    check(dialogue() === manualDialogue, `${page}: manual dialogue takes priority over introductions`)
    check(modelRequests() === requests, `${page}: no model, texture or motion reload`)
  }

  window.scrollTo({ top: 350, behavior: 'instant' })
  await delay(80)
  const homeScroll = window.scrollY
  await navigate('about')
  check(window.scrollY === 0 && document.activeElement === document.querySelector('main'), 'Page navigation resets scroll and focuses the new content')
  history.back()
  await until(() => document.body.dataset.page === 'home')
  await delay(100)
  check(Math.abs(window.scrollY - homeScroll) < 2, 'Back restores the previous page and its scroll position')
  history.forward()
  await until(() => document.body.dataset.page === 'about')
  await delay(100)
  check(document.querySelector('.live2d-canvas-wrap canvas') === canvas, 'Forward also preserves the model instance')

  // Use the real search result and close handler for cross-page hash navigation.
  document.querySelector<HTMLButtonElement>('.nav-search-button')!.click()
  await until(() => document.querySelector('.site-search-result'))
  const searchLink = document.querySelector<HTMLAnchorElement>(`.site-search-result[href="${getRouteHref('home')}#explore"]`)!
  check(!!searchLink, 'Search exposes the home section link')
  searchLink.click()
  await until(() => document.body.dataset.page === 'home' && !document.querySelector('.site-search-backdrop'))
  await delay(150)
  check(location.hash === '#explore' && window.scrollY > 0, 'Search closes and scrolls to the destination section')
  check(document.querySelector('.live2d-canvas-wrap canvas') === canvas && !companion.hasAttribute('hidden'), 'Search restoration reuses the visible companion')

  const link = document.createElement('a')
  link.href = `${getRouteHref('projects')}index.html?source=test#vae-gan-digits`
  document.querySelector('main')!.append(link)
  link.click()
  await until(() => document.body.dataset.page === 'projects')
  await delay(100)
  check(location.search === '?source=test' && location.hash === '#vae-gan-digits' && window.scrollY > 0, 'HTML aliases, queries and cross-page anchors use the same layout')

  const sectionLink = document.createElement('a')
  sectionLink.href = '#projects'
  document.querySelector('main')!.append(sectionLink)
  const section = document.querySelector<HTMLElement>('#projects')!
  const sectionTop = Math.max(0, section.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(section).scrollMarginTop) || 0))
  sectionLink.click()
  await until(() => Math.abs(window.scrollY - sectionTop) < 2, 3000)
  check(location.hash === '#projects' && document.querySelector('.live2d-canvas-wrap canvas') === canvas, 'Same-page anchors retain smooth scrolling without replacing the canvas')
  sectionLink.remove()

  // Inspect cancellation before suppressing native defaults, avoiding test tabs or downloads.
  const probe = (href: string, options: { target?: string; download?: boolean; modified?: boolean; cancelled?: boolean } = {}) => {
    const anchor = document.createElement('a')
    anchor.href = href
    if (options.target) anchor.target = options.target
    if (options.download) anchor.download = ''
    if (options.cancelled) anchor.onclick = (event) => event.preventDefault()
    document.body.append(anchor)
    let intercepted = false
    const observe = (event: MouseEvent) => { intercepted = event.defaultPrevented; event.preventDefault() }
    window.addEventListener('click', observe, { once: true })
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: options.modified }))
    anchor.remove()
    return intercepted
  }
  check(!probe('/about/', { modified: true }) && !probe('/about/', { target: '_blank' })
    && !probe('/about/', { download: true }) && !probe('https://example.com/')
    && !probe('/unknown/') && !probe('mailto:hello@example.com'), 'Modified clicks, new tabs, downloads, external links and unknown routes keep native behavior')
  const currentUrl = location.href
  probe('/about/', { cancelled: true })
  await delay(80)
  check(location.href === currentUrl, 'Navigation respects an already cancelled click')

  document.querySelector<HTMLButtonElement>('[aria-label="关闭人物点击对话"]')!.click()
  await navigate('learning')
  check(dialogue() === '', 'Disabled dialogue discards a page introduction')
  document.querySelector<HTMLButtonElement>('[aria-label="开启人物点击对话"]')!.click()
  await delay(100)
  check(dialogue() === '', 'Enabling dialogue does not replay a skipped introduction')
  await navigate('about')
  check(dialogue() === companionIntroductions.about, 'A later page visit can introduce itself again')
  document.querySelector<HTMLButtonElement>('.nav-search-button')!.click()
  await until(() => document.querySelector('.site-search-backdrop'))
  await navigate('projects')
  check(dialogue() === '', 'Navigation while search is open discards the introduction')
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await until(() => !document.querySelector('.site-search-backdrop'))
  check(dialogue() === '', 'Closing search does not replay the discarded introduction')

  document.querySelector<HTMLButtonElement>('[aria-label="收起看板娘"]')!.click()
  await until(() => document.querySelector('.live2d-launcher'))
  const launcher = document.querySelector('.live2d-launcher')!
  await navigate('learning')
  check(document.querySelector('.live2d-launcher') === launcher && !document.querySelector('.live2d-companion canvas'), 'A collapsed companion also persists across pages')
  launcher.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await until(() => document.querySelector('canvas.is-ready'))
  await until(() => phase() === 'idle')
  check(dialogue() === '', 'Expanding does not replay a page introduction skipped while collapsed')
  document.querySelector('#result')!.textContent = `${passed} checks passed`
} catch (error) {
  document.querySelector('#result')!.textContent = `Failed: ${error instanceof Error ? error.message : 'Unknown test failure'}`
} finally {
  root.unmount()
  history.replaceState(originalState, '', originalUrl)
  sessionKeys.forEach((key, index) => {
    if (sessionPreferences[index] === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, sessionPreferences[index]!)
  })
  preferenceKeys.forEach((key, index) => {
    if (preferences[index] === null) localStorage.removeItem(key)
    else localStorage.setItem(key, preferences[index]!)
  })
}
