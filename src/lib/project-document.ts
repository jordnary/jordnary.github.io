import GithubSlugger from 'github-slugger'
import { visit } from 'unist-util-visit'
import { defaultSchema } from 'rehype-sanitize'
import type { Root, Element } from 'hast'

export type DocumentHeading = { id: string; text: string; level: number }
export type DocumentImage = { file: string; width?: number; height?: number; alt?: string }
export type ProjectDocument = {
  version: 1
  id: string
  markdown: string
  sourceUrl: string
  rawUrl: string
  fetchedAt: string
  headings: DocumentHeading[]
  images: Record<string, DocumentImage>
}

export const documentSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className', 'math-inline', 'math-display', /^language-./]],
  },
}

export function elementText(node: Element): string {
  return node.children.map(child => child.type === 'text' ? child.value : child.type === 'element' ? elementText(child) : '').join('')
}

/** Run after sanitizing: heading IDs are deterministic and cannot clobber DOM globals. */
export function documentHeadings() {
  return (tree: Root) => {
    const slugger = new GithubSlugger()
    visit(tree, 'element', node => {
      if (!/^h[1-6]$/.test(node.tagName)) return
      node.properties.id = `doc-${slugger.slug(elementText(node))}`
      if (node.tagName === 'h1') node.tagName = 'h2'
    })
  }
}

export function isProjectDocument(value: unknown, id: string): value is ProjectDocument {
  if (!value || typeof value !== 'object') return false
  const doc = value as ProjectDocument
  return doc.version === 1 && doc.id === id && typeof doc.markdown === 'string'
    && doc.markdown.length > 0 && /^https:\/\/raw\.githubusercontent\.com\//.test(doc.rawUrl)
    && /^https:\/\/github\.com\//.test(doc.sourceUrl) && Number.isFinite(Date.parse(doc.fetchedAt))
    && Array.isArray(doc.headings) && doc.headings.every(h => h && typeof h.text === 'string' && typeof h.id === 'string' && h.id.startsWith('doc-') && Number.isInteger(h.level))
    && !!doc.images && typeof doc.images === 'object' && Object.values(doc.images).every(image => image && /^assets\/[a-f0-9]+\.[a-z0-9]+$/.test(image.file))
}

export function resolveDocumentImageUrl(value: string, rawUrl: string) {
  const root = new URL(rawUrl).pathname.split('/').slice(0, 4).join('/')
  const url = new URL(value.startsWith('/') && !value.startsWith('//') ? `${root}${value}` : value, rawUrl)
  if (url.hostname === 'github.com' && url.pathname.includes('/blob/')) {
    url.hostname = 'raw.githubusercontent.com'
    url.pathname = url.pathname.replace('/blob/', '/')
  }
  return url.href
}

export function resolveDocumentLink(value: string, doc: ProjectDocument) {
  if (value.startsWith('#')) return `#doc-${value.slice(1).replace(/^doc-/, '')}`
  try {
    const url = new URL(value, doc.sourceUrl)
    // Markdown repository-root paths refer to the repository, not github.com itself.
    if (value.startsWith('/') && !value.startsWith('//')) {
      const root = doc.sourceUrl.split('/blob/')[0]
      return `${root}/blob/HEAD${value}`
    }
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}
