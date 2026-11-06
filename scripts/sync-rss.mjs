import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isRssFeed } from '../src/lib/rss-snapshot.ts'

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultOutput = resolve(rootDirectory, 'public/data/rss.json')
const maxItems = 12
const maxItemsPerSource = maxItems

// Add or replace sources here. Only title, a short excerpt, date and link are published.
const feedSources = [
  {
    id: 'github-blog',
    name: 'GitHub Blog',
    feedUrl: 'https://github.blog/feed/',
    sourceUrl: 'https://github.blog/',
  },
  {
    id: 'hacker-news',
    name: 'Hacker News',
    feedUrl: 'https://hnrss.org/frontpage',
    sourceUrl: 'https://news.ycombinator.com/',
  },
]

export async function syncRssSnapshot({
  outputPath = defaultOutput,
  siteUrl = process.env.SITE_URL || 'https://jordnary.github.io/',
  fetchImpl = fetch,
} = {}) {
  const results = await Promise.allSettled(feedSources.map(async source => {
    const response = await fetchImpl(source.feedUrl, {
      headers: {
        Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml',
        'User-Agent': 'jordnary.github.io RSS reader',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) throw new Error('RSS source unavailable')
    return parseFeed(await response.text(), source)
  }))
  const queues = results.filter(result => result.status === 'fulfilled')
    .map(result => [...result.value].sort((a, b) => getTimestamp(b.publishedAt) - getTimestamp(a.publishedAt)).slice(0, maxItemsPerSource))
  const items = roundRobin(queues).slice(0, maxItems)
  let snapshot = { generatedAt: new Date().toISOString(), items }
  let reused = false
  if (!items.length || !isRssFeed(snapshot)) {
    const previous = await Promise.allSettled([
      readFile(outputPath, 'utf8').then(JSON.parse),
      (async () => {
        const response = await fetchImpl(new URL('data/rss.json', `${siteUrl.replace(/\/$/, '')}/`), {
          signal: AbortSignal.timeout(12000),
        })
        if (!response.ok) throw new Error('Published RSS snapshot unavailable')
        return response.json()
      })(),
    ])
    snapshot = previous.filter(result => result.status === 'fulfilled' && isRssFeed(result.value))
      .map(result => result.value).sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0]
    if (!snapshot) throw new Error('RSS sync failed and no valid previous snapshot is available; deployment stopped.')
    reused = true
  }
  const target = outputPath instanceof URL ? outputPath : pathToFileURL(resolve(outputPath))
  const temporary = new URL(`${target.href}.tmp`)
  await mkdir(dirname(fileURLToPath(target)), { recursive: true })
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  await rename(temporary, target)
  return { snapshot, reused }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { snapshot, reused } = await syncRssSnapshot()
    console.log(reused ? `RSS sync unavailable; retained snapshot from ${snapshot.generatedAt}.` : `RSS sync complete: ${snapshot.items.length} articles.`)
    if (reused && process.env.GITHUB_ACTIONS) console.log('::warning::RSS sync unavailable; retained the last successful snapshot.')
  } catch {
    console.error('RSS sync failed and no valid previous snapshot is available; deployment stopped.')
    process.exitCode = 1
  }
}

function parseFeed(xml, source) {
  const blocks = getBlocks(xml, 'item')
  const entries = blocks.length > 0 ? blocks : getBlocks(xml, 'entry')

  return entries
    .map((entry, index) => toFeedItem(entry, source, index))
    .filter((item) => item !== null)
}

function roundRobin(queues) {
  const items = []
  let hasItems = true

  while (hasItems) {
    hasItems = false

    for (const queue of queues) {
      const item = queue.shift()

      if (item) {
        items.push(item)
        hasItems = true
      }
    }
  }

  return items
}

function getBlocks(xml, tagName) {
  const escapedTag = escapeRegex(tagName)
  const expression = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${escapedTag}>`, 'gi')

  return xml.match(expression) ?? []
}

function toFeedItem(entry, source, index) {
  const title = cleanText(getTagValue(entry, 'title'))
  const url = getEntryUrl(entry)

  if (!title || !url) {
    return null
  }

  const description = cleanText(
    getFirstTagValue(entry, ['description', 'summary', 'content:encoded', 'content']),
  ).slice(0, 180)
  const publishedAt = normalizeDate(
    getFirstTagValue(entry, ['pubDate', 'published', 'updated', 'dc:date']),
  )

  return {
    description,
    id: `${source.id}-${slugify(url)}-${index}`,
    publishedAt,
    source: source.name,
    sourceUrl: source.sourceUrl,
    title,
    url,
  }
}

function getEntryUrl(entry) {
  const links = [...entry.matchAll(/<link\b([^>]*)>/gi)]

  for (const match of links) {
    const attributes = match[1]
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1]

    if (href) {
      return decodeXml(href).trim()
    }
  }

  return cleanText(getTagValue(entry, 'link'))
}

function getFirstTagValue(entry, tags) {
  for (const tag of tags) {
    const value = getTagValue(entry, tag)

    if (value) {
      return value
    }
  }

  return ''
}

function getTagValue(entry, tagName) {
  const escapedTag = escapeRegex(tagName)
  const expression = new RegExp(
    `<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`,
    'i',
  )

  return entry.match(expression)?.[1] ?? ''
}

function cleanText(value) {
  return decodeXml(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeXml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}

function normalizeDate(value) {
  const timestamp = Date.parse(value)

  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString()
}

function getTimestamp(value) {
  return value ? new Date(value).getTime() : 0
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function escapeRegex(value) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}
