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
      getGitHubSnapshot({ force: isManualRefresh }),
      loadRssFeed(),
    ]).then(([githubResult, feedResult]) => {
      if (!isCurrent) return

      if (githubResult.status === 'fulfilled') {
        setGitHubState({ data: githubResult.value, status: 'ready' })
      } else {
        setGitHubState({ data: null, status: 'error' })
      }

      if (feedResult.status === 'fulfilled') {
        setFeedState({ data: feedResult.value, status: 'ready' })
      } else {
        setFeedState({ data: null, status: 'error' })
      }

      if (isManualRefresh) {
        setRefreshFeedback(
          githubResult.status === 'fulfilled' && feedResult.status === 'fulfilled'
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
    setGitHubState({ data: null, status: 'loading' })
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
      title="最近在做什么"
    >
      <div className="live-updates-toolbar">
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
        <Reveal as="article" className="live-panel glass-card" whileHover={{ y: -5 }}>
          <PanelHeader
            actionHref={githubProfileUrl}
            actionLabel="前往 GitHub"
            eyebrow="Code Activity"
            title="我最近在维护"
          />
          {githubState.status === 'ready' && githubState.data ? (
            <GitHubContent snapshot={githubState.data} />
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
          className="live-panel glass-card"
          index={1}
          whileHover={{ y: -5 }}
        >
          <header className="live-panel-header">
            <div>
              <p className="meta-label">Reading Notes</p>
              <h3>我最近在关注</h3>
            </div>
          </header>
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
  title,
}: {
  actionHref: string
  actionLabel: string
  eyebrow: string
  title: string
}) {
  const isExternal = actionHref.startsWith('http')

  return (
    <header className="live-panel-header">
      <div>
        <p className="meta-label">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
      <a
        className="live-panel-link"
        href={actionHref}
        rel={isExternal ? 'noreferrer' : undefined}
        target={isExternal ? '_blank' : undefined}
      >
        {actionLabel}
        <span aria-hidden="true">↗</span>
      </a>
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
          <dd className="github-live-status"><span />持续更新</dd>
        </div>
      </dl>

      {snapshot.repos.length > 0 ? (
        <ul className="live-list github-repository-list">
          {snapshot.repos.map((repository) => (
            <li key={repository.url}>
              <a
                className="github-repository"
                href={repository.url}
                rel="noreferrer"
                target="_blank"
              >
                <span className="github-repository-main">
                  <strong>{repository.name}</strong>
                  <span>{repository.description || '这个项目暂时还没有简介。'}</span>
                </span>
                <span className="github-repository-meta">
                  <span>{repository.language || 'Code'}</span>
                  <span>★ {formatNumber(repository.stars)}</span>
                  <span>{formatDate(repository.updatedAt)} 更新</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="live-inline-note">暂时还没有可展示的公开项目。</p>
      )}
      <p className="live-sync-note">更新于：{formatTime(snapshot.fetchedAt)}</p>
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
        {items.map((item) => (
          <li key={item.id}>
            <a
              className="rss-item"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              <span className="rss-item-source">{item.source}</span>
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
