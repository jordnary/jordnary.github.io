import { getPageFromUrl, getRouteHref, isHomepagePortalUrl, siteRoutes } from '../lib/routes'
import './PageLoadFeedback.css'

export type PageLoadState = { href: string; status: 'loading' | 'error'; reason?: 'timeout' | 'load' | 'render' }

type Props = {
  state: PageLoadState
  floating?: boolean
  onRetry?: () => void
  onCancel?: () => void
}

export function PageLoadFeedback({ state, floating = false, onRetry, onCancel }: Props) {
  const url = new URL(state.href)
  const page = getPageFromUrl(url)
  const kind = isHomepagePortalUrl(url) ? 'portal' : page === 'projects' ? 'projects' : 'page'
  const target = page ? siteRoutes[page].label : '目标'
  const loading = state.status === 'loading'
  const message = loading ? `正在打开${target}页面…`
    : state.reason === 'timeout' ? '加载时间较长，请检查网络后重试。'
      : state.reason === 'render' ? '页面暂时无法显示，请重试。' : '页面加载失败，请检查网络后重新打开。'
  return (
    <section className={`page-load-feedback${floating ? ' page-load-feedback--floating' : ''}`}
      data-state={state.status} data-kind={kind} lang="zh-CN" aria-label="页面加载">
      <p role={loading ? 'status' : 'alert'} aria-live={loading ? 'polite' : 'assertive'}>{message}</p>
      {floating && <p className="page-load-feedback-note">当前内容仍可浏览。</p>}
      <div className="page-load-feedback-actions">
        {!loading && onRetry && <button type="button" onClick={onRetry}>重试</button>}
        {!loading && <a href={state.href} data-site-reload>重新打开页面</a>}
        {onCancel ? <button type="button" onClick={onCancel}>{loading ? '取消加载' : '留在当前页面'}</button>
          : !loading && <a href={getRouteHref('home')}>返回首页</a>}
      </div>
    </section>
  )
}
