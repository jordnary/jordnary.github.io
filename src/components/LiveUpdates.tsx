import { useEffect, useRef, useState } from 'react'
import { githubProfileUrl, getGitHubSnapshot, type GitHubSnapshot } from '../lib/github'
import { PageSection } from './PageSection'
import { Reveal } from './Reveal'

type LoadState<T> = {
  data: T | null
  status: 'error' | 'loading' | 'ready'
}

type RssItem = {
  description: string
  id: string
  publishedAt: string | null
  source: string
  sourceUrl: string
  title: string
  url: string
}

type RssFeed = {
  generatedAt: string
  items: RssItem[]
}

const initialGitHubState: LoadState<GitHubSnapshot> = {
  data: null,
  status: 'loading',
}

const initialFeedState: LoadState<RssFeed> = {
  data: null,
  status: 'loading',
}

export function LiveUpdates() {
  const [githubState, setGitHubState] = useState(initialGitHubState)
  const [feedState, setFeedState] = useState(initialFeedState)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [refreshFeedback, setRefreshFeedback] = useState<'error' | 'idle' | 'loading' | 'success'>('idle')
  const feedbackTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let isCurrent = true
    const isManualRefresh = refreshIndex > 0

    void Promise.allSettled([
      getGitHubSnapshot(),
      loadRssFeed(),
    ]).then(([githubResult, feedResult]) => {
      if (!isCurrent) return

      if (githubResult.status === 'fulfilled') {
        setGitHubState({
          data: githubResult.value.snapshot,
          status: githubResult.value.fromCache ? 'error' : 'ready',
        })
      } else {
        setGitHubState((previous) => ({ ...previous, status: 'error' }))
      }

      if (feedResult.status === 'fulfilled') {
        setFeedState({ data: feedResult.value, status: 'ready' })
      } else {
        setFeedState({ data: null, status: 'error' })
      }

      if (isManualRefresh) {
        setRefreshFeedback(
          githubResult.status === 'fulfilled' && !githubResult.value.fromCache && feedResult.status === 'fulfilled'
            ? 'success'
            : 'error',
        )
        feedbackTimerRef.current = window.setTimeout(() => {
          setRefreshFeedback('idle')
        }, 3600)
      }
    })

    return () => {
      isCurrent = false
    }
  }, [refreshIndex])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current)
      }
    }
  }, [])

  const refresh = () => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current)
    }

    setRefreshFeedback('loading')
    setGitHubState((previous) => ({ ...previous, status: 'loading' }))
    setFeedState({ data: null, status: 'loading' })
    setRefreshIndex((index) => index + 1)
  }

  const isRefreshing =
    refreshFeedback === 'loading' ||
    githubState.status === 'loading' ||
    feedState.status === 'loading'

  return (
    <PageSection
      description="这里汇集我公开的代码动态与最近在读的内容，记录持续学习、动手实践和整理思考的日常足迹。"
      eyebrow="Now & Notes"
      id="live"
      title={<>最近在<span className="live-title-accent">做什么
        <svg viewBox="0 0 160 12" fill="none" aria-hidden="true">
          <path d="M3 8C41 2 105 2 157 6M88 10c23-3 43-3 62-2" />
        </svg>
      </span></>}
    >
      <div className="live-updates-toolbar">
        <p className="home-live-caption"><span aria-hidden="true" />学习与创作，持续发生中</p>
        <button
          className="live-refresh-button"
          disabled={isRefreshing}
          onClick={refresh}
          type="button"
        >
          <RefreshIcon />
          <span>{isRefreshing ? '更新中…' : '刷新动态'}</span>
        </button>
        {refreshFeedback === 'success' && (
          <p className="live-refresh-feedback is-success" role="status">
            <CheckIcon />
            已更新
          </p>
        )}
        {refreshFeedback === 'error' && (
          <p className="live-refresh-feedback is-error" role="status">
            <AlertIcon />
            更新失败，请稍后再试
          </p>
        )}
      </div>

      <div className="live-updates-grid">
        <Reveal as="article" className="live-panel live-panel--code glass-card">
          <PanelHeader
            actionHref={githubProfileUrl}
            actionLabel="前往 GitHub"
            eyebrow="Code Activity"
            kind="code"
            title="我最近在维护"
          />
          {githubState.data ? (
            <>
              <GitHubContent snapshot={githubState.data} />
              {githubState.status === 'error' && (
                <p className="live-inline-note" role="status">暂时无法更新，显示上次成功的数据。</p>
              )}
            </>
          ) : (
            <LiveState
              kind={githubState.status === 'error' ? 'error' : 'loading'}
              source="GitHub"
            />
          )}
        </Reveal>

        <Reveal
          as="article"
          baseDelay={0.08}
          className="live-panel live-panel--reading glass-card"
          index={1}
        >
          <PanelHeader eyebrow="Reading Notes" kind="reading" title="我最近在关注" />
          {feedState.status === 'ready' && feedState.data ? (
            <RssContent feed={feedState.data} />
          ) : (
            <LiveState
              kind={feedState.status === 'error' ? 'error' : 'loading'}
              source="RSS 阅读流"
            />
          )}
        </Reveal>
      </div>
    </PageSection>
  )
}

function PanelHeader({
  actionHref,
  actionLabel,
  eyebrow,
  kind,
  title,
}: {
  actionHref?: string
  actionLabel?: string
  eyebrow: string
  kind: 'code' | 'reading'
  title: string
}) {
  const isExternal = actionHref?.startsWith('http')

  return (
    <header className="live-panel-header">
      <div className="live-panel-heading">
        <span className="live-panel-symbol"><JournalIcon kind={kind} /></span>
        <div>
          <p className="meta-label">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>
      {actionHref && (
        <a
          className="live-panel-link"
          href={actionHref}
          rel={isExternal ? 'noreferrer' : undefined}
          target={isExternal ? '_blank' : undefined}
        >
          {actionLabel}
          <span aria-hidden="true">↗</span>
        </a>
      )}
    </header>
  )
}

function GitHubContent({ snapshot }: { snapshot: GitHubSnapshot }) {
  return (
    <>
      <dl className="github-metrics">
        <div>
          <dt>公开仓库</dt>
          <dd>{formatNumber(snapshot.profile.publicRepos)}</dd>
        </div>
        <div>
          <dt>关注者</dt>
          <dd>{formatNumber(snapshot.profile.followers)}</dd>
        </div>
        <div>
          <dt>最近状态</dt>
          <dd className="github-live-status"><span />定期同步</dd>
        </div>
      </dl>

      {snapshot.repos.length > 0 ? (
        <ul className="live-list github-repository-list">
          {snapshot.repos.map((repository) => (
            <li key={repository.url}>
              <a
                className="github-repository"
                data-language={repository.language ?? undefined}
                href={repository.url}
                rel="noreferrer"
                target="_blank"
              >
                <span className="github-repository-icon"><JournalIcon kind="repository" /></span>
                <span className="github-repository-body">
                  <span className="github-repository-main">
                    <strong>{repository.name}</strong>
                    <span>{repository.description || '这个项目暂时还没有简介。'}</span>
                  </span>
                  <span className="github-repository-meta">
                    <span className="github-language">{repository.language || 'Code'}</span>
                    <span>★ {formatNumber(repository.stars)}</span>
                    <span>{formatDate(repository.updatedAt)} 更新</span>
                  </span>
                </span>
                <span className="github-repository-arrow" aria-hidden="true">↗</span>
              </a>
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

function RssContent({ feed }: { feed: RssFeed }) {
  const items = feed.items.slice(0, 4)

  if (items.length === 0) {
    return <LiveState kind="error" source="RSS 阅读流" />
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

function JournalIcon({ kind }: { kind: 'code' | 'reading' | 'repository' }) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      {kind === 'code' ? (
        <>
          <circle cx="6" cy="5" r="2.5" />
          <circle cx="6" cy="19" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <path d="M6 7.5v9M18 8.5v1A6.5 6.5 0 0 1 11.5 16H6" />
        </>
      ) : kind === 'reading' ? (
        <>
          <path d="M12 6C9.5 4.4 6.5 4 3 4.5v14c3.5-.5 6.5 0 9 1.5 2.5-1.5 5.5-2 9-1.5v-14c-3.5-.5-6.5 0-9 1.5ZM12 6v14" />
          <path d="m6 9 3 1m6 0 3-1M6 13l3 1m6 0 3-1" />
        </>
      ) : (
        <>
          <path d="M5 3.5h13v17H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Zm0 0v13m-2 2a2 2 0 0 1 2-2h13" />
          <path d="m9 7-2 2 2 2m4-4 2 2-2 2" />
        </>
      )}
    </svg>
  )
}

function LiveState({ kind, source }: { kind: 'error' | 'loading'; source: string }) {
  if (kind === 'loading') {
    return (
      <div className="live-state" role="status">
        <span className="live-state-orbit" />
        <p>正在获取我的 {source}…</p>
      </div>
    )
  }

  return (
    <div className="live-state live-state-error">
      <p>暂时无法获取{source}。</p>
      <span>其他页面内容不受影响，可以稍后再试。</span>
    </div>
  )
}

async function loadRssFeed(): Promise<RssFeed> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/rss.json`, {
    cache: 'no-cache',
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`RSS feed request failed with ${response.status}`)
  }

  return response.json() as Promise<RssFeed>
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
