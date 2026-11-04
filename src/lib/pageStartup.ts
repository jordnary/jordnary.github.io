import type {} from './projectTransitionBoot'

declare global {
  interface Window {
    __siteStartup?: { failed: boolean; dispose: () => void }
  }
}

/** Inlined ahead of entry assets by Vite; no imports or React required to recover. */
export function bootstrapPageStartup(base: string) {
  const panel = document.createElement('section')
  panel.className = 'site-startup'
  panel.lang = 'zh-CN'
  panel.setAttribute('aria-label', '页面加载')
  const path = location.pathname.slice(base.replace(/\/$/, '').length)
  panel.dataset.kind = /^\/projects(?:\/|$)/.test(path) ? 'projects' : /^\/(?:index.html)?$/.test(path) ? 'portal' : 'page'
  const message = document.createElement('p')
  message.setAttribute('role', 'status')
  message.textContent = '正在打开页面…'
  const links = document.createElement('div')
  links.hidden = true
  const retry = document.createElement('a')
  retry.href = location.href
  retry.textContent = '重试'
  retry.addEventListener('click', event => {
    if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    event.preventDefault()
    location.reload()
  })
  const home = document.createElement('a')
  home.href = `${base.replace(/\/$/, '')}/home/`
  home.textContent = '返回首页'
  links.append(retry, home)
  panel.append(message, links)
  document.documentElement.append(panel)

  const fail = (timeout = false) => {
    if (startup.failed) return
    startup.failed = true
    window.clearTimeout(timer)
    panel.dataset.state = 'error'
    message.setAttribute('role', 'alert')
    message.textContent = timeout ? '加载时间较长，请检查网络后重试。' : '页面加载失败，请检查网络后重试。'
    links.hidden = false
    window.__projectTransitionBoot?.dispose('skipped')
  }
  const error = (event: Event) => {
    if ((event.target instanceof HTMLScriptElement && event.target.type === 'module')
      || (event.target instanceof HTMLLinkElement && event.target.rel === 'stylesheet')) fail()
  }
  const timer = window.setTimeout(() => fail(true), 8000)
  const startup: NonNullable<Window['__siteStartup']> = window.__siteStartup = {
    failed: false,
    dispose: () => {
      window.clearTimeout(timer)
      window.removeEventListener('error', error, true)
      panel.remove()
    },
  }
  window.addEventListener('error', error, true)
}
