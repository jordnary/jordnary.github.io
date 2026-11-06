export type RssItem = { description: string; id: string; publishedAt: string | null; source: string; sourceUrl: string; title: string; url: string }
export type RssFeed = { generatedAt: string; items: RssItem[] }

const isDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const isUrl = (value: unknown) => {
  if (typeof value !== 'string') return false
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) }
  catch { return false }
}
export function isRssFeed(value: unknown): value is RssFeed {
  if (!value || typeof value !== 'object') return false
  const feed = value as RssFeed
  return isDate(feed.generatedAt) && Array.isArray(feed.items) && feed.items.length <= 12
    && feed.items.every(item => item && typeof item.id === 'string' && typeof item.title === 'string'
      && typeof item.description === 'string' && typeof item.source === 'string'
      && isUrl(item.url) && isUrl(item.sourceUrl) && (item.publishedAt === null || isDate(item.publishedAt)))
    && new Set(feed.items.map(item => item.id)).size === feed.items.length
}
