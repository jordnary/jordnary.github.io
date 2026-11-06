import { useEffect, useRef, useState, type ReactNode } from 'react'
import { githubProfileUrl, githubSnapshotStore, type GitHubSnapshot } from '../lib/github'
import { rssSnapshotStore, type RssFeed } from '../lib/rss'
import type { SnapshotStore } from '../lib/snapshot-store'
import { useSnapshot } from '../lib/useSnapshot'
import { nowOrnamentImage } from '../lib/inpage-images'

export function LiveUpdates({ kind }: { kind: 'code' | 'reading' }) {
  return kind === 'code'
    ? <LiveSnapshot key={kind} kind={kind} store={githubSnapshotStore}>{data => <GitHubContent snapshot={data} />}</LiveSnapshot>
    : <LiveSnapshot key={kind} kind={kind} store={rssSnapshotStore}>{data => <RssContent feed={data} />}</LiveSnapshot>
}

function LiveSnapshot<T>({ kind, store, children }: { kind: 'code' | 'reading'; store: SnapshotStore<T>; children: (data: T) => ReactNode }) {
  const state = useSnapshot(store)
  const [feedback, setFeedback] = useState<'error' | 'idle' | 'success'>('idle')
  const feedbackTimer = useRef<number | undefined>(undefined)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; window.clearTimeout(feedbackTimer.current) }
  }, [])
  const refreshing = state.status === 'loading' || state.status === 'idle'
  const refresh = async () => {
    window.clearTimeout(feedbackTimer.current)
    setFeedback('idle')
    const success = await store.refresh(true)
    if (!mounted.current) return
    setFeedback(success ? 'success' : 'error')
    feedbackTimer.current = window.setTimeout(() => setFeedback('idle'), 3600)
  }

  return <div className="home-now-live">
    <div className="live-updates-toolbar">
      <p className="home-live-caption" lang="en">{kind === 'code' ? 'CODE ACTIVITY' : 'READING NOTES'}</p>
      <button className="live-refresh-button" type="button" disabled={refreshing} onClick={refresh}>
        <RefreshIcon /><span>{refreshing ? '更新中…' : '刷新动态'} <span lang="en">/ {refreshing ? 'Loading' : 'Refresh'}</span></span>
      </button>
      {!refreshing && ((feedback === 'success' && state.status === 'ready') || (feedback === 'error' && state.status === 'error')) && <p className={`live-refresh-feedback is-${feedback}`} role="status">
        {feedback === 'success' ? <><CheckIcon />已更新 / Updated</> : <><AlertIcon />更新失败，请重试 / Please try again</>}
      </p>}
    </div>
    <div className="home-now-live-content" aria-busy={refreshing}>
      {state.data ? children(state.data) : <LiveState kind={state.status === 'error' ? 'error' : 'loading'} source={kind === 'code' ? 'GitHub' : 'RSS 阅读流'} />}
      {state.data && state.stale && refreshing && <p className="live-inline-note" role="status">显示上次成功的数据，正在检查更新。<span lang="en"> Checking for updates.</span></p>}
      {state.data && state.status === 'error' && <p className="live-inline-note" role="status">暂时无法更新，显示上次成功的数据。<span lang="en"> Showing the last available update.</span></p>}
    </div>
    {kind === 'code' && <a className="home-now-source" href={githubProfileUrl} target="_blank" rel="noreferrer">前往 GitHub <span lang="en">/ View on GitHub ↗</span></a>}
  </div>
}

function GitHubContent({ snapshot }: { snapshot: GitHubSnapshot }) {
  return (
    <>
      {snapshot.repos.length > 0 ? (
        <ul className="live-list github-repository-list">
          {snapshot.repos.map((repository) => (
            <li key={repository.url}>
              <GitHubRepository repository={repository} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="live-inline-note">暂时还没有可展示的公开项目。</p>
      )}
      <p className="live-sync-note">同步于：{formatTime(snapshot.fetchedAt)}</p>
    </>
  )
}

function GitHubRepository({ repository }: { repository: GitHubSnapshot['repos'][number] }) {
  const ornamentRef = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const active = hovered || focused

  useEffect(() => {
    const ornament = ornamentRef.current
    if (!ornament) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const hidden = 'inset(0 100% 0 0)'
    const visible = 'inset(0)'
    let animation: Animation | undefined
    const stop = () => {
      if (!animation) return
      animation.onfinish = null
      animation.cancel()
      animation = undefined
    }
    const play = (from: string, to: string, duration: number, onFinish?: () => void) => {
      stop()
      ornament.style.clipPath = to
      const running = ornament.animate([{ clipPath: from }, { clipPath: to }], {
        duration,
        easing: 'cubic-bezier(.25, .65, .25, 1)',
      })
      animation = running
      running.onfinish = () => {
        if (animation !== running) return
        animation = undefined
        onFinish?.()
      }
    }
    const animate = () => {
      const current = getComputedStyle(ornament).clipPath
      stop()
      if (reducedMotion.matches) {
        ornament.style.clipPath = active ? visible : hidden
        return
      }
      // Our inset edges are percentages (zero may serialize as px or shorthand).
      const edges = current.match(/-?[\d.]+(?:e[+-]?\d+)?/gi)?.map(Number) ?? []
      const right = edges[1] ?? 0
      const left = edges[3] ?? right
      const remaining = Math.max(0, 100 - left - right)
      const cleared = `inset(0 ${right}% 0 ${100 - right}%)`
      if (!active) {
        // Freeze the reveal edge, erasing only the portion that is already visible.
        if (remaining <= .01) ornament.style.clipPath = hidden
        else play(current, cleared, 620 * remaining / 100)
      } else if (left > .01 && remaining > .01) {
        // Never pull an erased left edge backwards. Clear its remainder quickly,
        // then start a fresh left-to-right reveal if this visit is still active.
        play(current, cleared, Math.min(100, 620 * remaining / 100), () => play(hidden, visible, 820))
      } else if (remaining <= .01) {
        play(hidden, visible, 820)
      } else if (right > .01) {
        play(current, visible, 820 * right / 100)
      } else {
        ornament.style.clipPath = visible
      }
    }
    animate()
    reducedMotion.addEventListener('change', animate)
    return () => {
      ornament.style.clipPath = getComputedStyle(ornament).clipPath
      stop()
      reducedMotion.removeEventListener('change', animate)
    }
  }, [active])

  return <a
    className="github-repository"
    data-language={repository.language ?? undefined}
    href={repository.url}
    rel="noreferrer"
    target="_blank"
    onPointerEnter={event => {
      if (event.pointerType !== 'touch' && window.matchMedia('(hover: hover)').matches) setHovered(true)
    }}
    onPointerLeave={() => setHovered(false)}
    onFocus={event => setFocused(event.currentTarget.matches(':focus-visible'))}
    onBlur={() => setFocused(false)}
  >
    <strong className="github-repository-name" lang="en">{repository.name}</strong>
    <span className="github-repository-body">
      <span className="github-repository-main">
        <span>{repository.description || '这个项目暂时还没有简介。'}</span>
      </span>
      <span className="github-repository-meta">
        <span className="github-language">{repository.language || 'Code'}</span>
        <span>★ {formatNumber(repository.stars)}</span>
        <span>{formatDate(repository.updatedAt)} 更新</span>
      </span>
    </span>
    <span className="github-repository-ornament" ref={ornamentRef} aria-hidden="true">
      <img {...nowOrnamentImage()} fetchPriority="low" decoding="async" alt="" width="2172" height="724" />
    </span>
    <span className="github-repository-arrow" aria-hidden="true">↗</span>
  </a>
}

function RssContent({ feed }: { feed: RssFeed }) {
  const items = feed.items.slice(0, 4)

  if (items.length === 0) {
    return <><p className="live-inline-note" role="status">还没有收录的文章。<span lang="en"> No articles yet.</span></p>
      <p className="live-sync-note">整理于：{formatTime(feed.generatedAt)}</p></>
  }

  return (
    <>
      <ul className="live-list rss-list">
        {items.map((item, index) => (
          <li key={item.id}>
            <a
              className={`rss-item${index === 0 ? ' rss-item--featured' : ''}`}
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              <span className="rss-item-source">
                {index === 0 && <span className="rss-feature-label">最新收录</span>}
                {item.source}
              </span>
              <span className="rss-item-copy">
                <strong>{item.title}</strong>
                <span>{item.description || '打开原文查看完整内容。'}</span>
              </span>
              <span className="rss-item-date">{formatDate(item.publishedAt)}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="rss-sources" id="rss-sources">
        <span>来源</span>
        {[...new Map(items.map((item) => [item.source, item.sourceUrl])).entries()].map(
          ([source, sourceUrl]) => (
            <a href={sourceUrl} key={source} rel="noreferrer" target="_blank">
              {source}
            </a>
          ),
        )}
      </div>
      <p className="live-sync-note">整理于：{formatTime(feed.generatedAt)}</p>
    </>
  )
}

function LiveState({ kind, source }: { kind: 'error' | 'loading'; source: string }) {
  if (kind === 'loading') {
    return (
      <div className="live-state" role="status">
        <span className="live-state-orbit" />
        <p>正在获取 {source}…<span lang="en"> Loading…</span></p>
      </div>
    )
  }

  return (
    <div className="live-state live-state-error">
      <p>暂时无法获取{source}。</p>
      <span>请使用上方的刷新按钮重试。 / Please refresh to try again.</span>
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', { notation: 'compact' }).format(value)
}

function formatDate(value: string | null) {
  if (!value) {
    return '近期'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '近期'
  }

  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date)
}

function formatTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '刚刚'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M20 11a8.2 8.2 0 0 0-14.8-4.8L3.5 8" />
      <path d="M3.5 3.8V8h4.2" />
      <path d="M4 13a8.2 8.2 0 0 0 14.8 4.8l1.7-1.8" />
      <path d="M20.5 20.2V16h-4.2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m5 12.5 4.4 4.4L19 7.5" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M12 8v4.6M12 16.2h.01" />
      <path d="M10.1 4.8 3.7 16a2.2 2.2 0 0 0 1.9 3.2h12.8a2.2 2.2 0 0 0 1.9-3.2L13.9 4.8a2.2 2.2 0 0 0-3.8 0Z" />
    </svg>
  )
}
