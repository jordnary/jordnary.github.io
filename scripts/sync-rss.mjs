import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(rootDirectory, 'public/data/rss.json')
const maxItems = 12

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

const results = await Promise.allSettled(feedSources.map(syncSource))
const successfulFeeds = results
  .filter((result) => result.status === 'fulfilled')
  .flatMap((result) => result.value)

let items = successfulFeeds
  .sort((first, second) => getTimestamp(second.publishedAt) - getTimestamp(first.publishedAt))
  .slice(0, maxItems)

if (items.length === 0) {
  const previousFeed = await readPreviousFeed()
  items = previousFeed?.items ?? []
}

const payload = {
  generatedAt: new Date().toISOString(),
  items,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

const failedSources = results.filter((result) => result.status === 'rejected').length
console.log(`RSS sync complete: ${items.length} articles from ${feedSources.length - failedSources}/${feedSources.length} sources.`)

async function syncSource(source) {
  const response = await fetch(source.feedUrl, {
    headers: {
      Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml',
      'User-Agent': 'jordnary.github.io RSS reader',
    },
    signal: AbortSignal.timeout(12000),
  })

  if (!response.ok) {
    throw new Error(`${source.name} returned ${response.status}`)
  }

  return parseFeed(await response.text(), source)
}

function parseFeed(xml, source) {
  const blocks = getBlocks(xml, 'item')
  const entries = blocks.length > 0 ? blocks : getBlocks(xml, 'entry')

  return entries
    .map((entry, index) => toFeedItem(entry, source, index))
    .filter((item) => item !== null)
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

async function readPreviousFeed() {
  try {
    return JSON.parse(await readFile(outputPath, 'utf8'))
  } catch {
    return null
  }
}
