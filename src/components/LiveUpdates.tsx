import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let isCurrent = true

    void getGitHubSnapshot({ force: refreshIndex > 0 })
      .then((data) => {
        if (isCurrent) {
          setGitHubState({ data, status: 'ready' })
        }
      })
      .catch(() => {
        if (isCurrent) {
          setGitHubState({ data: null, status: 'error' })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [refreshIndex])

  useEffect(() => {
    let isCurrent = true

    void loadRssFeed()
      .then((data) => {
        if (isCurrent) {
          setFeedState({ data, status: 'ready' })
        }
      })
      .catch(() => {
        if (isCurrent) {
          setFeedState({ data: null, status: 'error' })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [refreshIndex])

  const refresh = () => {
    setGitHubState({ data: null, status: 'loading' })
    setFeedState({ data: null, status: 'loading' })
    setRefreshIndex((index) => index + 1)
  }

  const isRefreshing =
    githubState.status === 'loading' || feedState.status === 'loading'

  return (
    <PageSection
      description="GitHub 区块直接读取公开数据；阅读流在每次构建时聚合 RSS，所以它既有外部内容，也保持 GitHub Pages 的稳定与快速。"
      eyebrow="Live Signals"
      id="live"
      title="正在发生的更新"
    >
      <div className="live-updates-toolbar">
        <p>公开数据源 · 无需登录</p>
        <button
          className="live-refresh-button"
          disabled={isRefreshing}
          onClick={refresh}
          type="button"
        >
          <RefreshIcon />
          <span>{isRefreshing ? '同步中…' : '刷新 GitHub 数据'}</span>
        </button>
      </div>

      <div className="live-updates-grid">
        <Reveal as="article" className="live-panel glass-card" whileHover={{ y: -5 }}>
          <PanelHeader
            actionHref={githubProfileUrl}
            actionLabel="查看主页"
            eyebrow="GitHub Pulse"
            title="最近维护的仓库"
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
          <PanelHeader
            actionHref="#rss-sources"
            actionLabel="查看来源"
            eyebrow="Reading Stream"
            title="RSS 阅读流"
          />
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
          <dt>更新状态</dt>
          <dd className="github-live-status"><span />Live</dd>
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
                  <span>{repository.description || '暂无仓库描述。'}</span>
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
        <p className="live-inline-note">暂时没有可展示的公开仓库。</p>
      )}
      <p className="live-sync-note">上次读取：{formatTime(snapshot.fetchedAt)}</p>
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
      <p className="live-sync-note">构建同步：{formatTime(feed.generatedAt)}</p>
    </>
  )
}

function LiveState({ kind, source }: { kind: 'error' | 'loading'; source: string }) {
  if (kind === 'loading') {
    return (
      <div className="live-state" role="status">
        <span className="live-state-orbit" />
        <p>正在同步 {source}…</p>
      </div>
    )
  }

  return (
    <div className="live-state live-state-error">
      <p>{source} 暂时不可用。</p>
      <span>这不会影响其他页面内容；稍后可再次刷新。</span>
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
