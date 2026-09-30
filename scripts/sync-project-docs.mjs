import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { visit } from 'unist-util-visit'
import { imageSize } from 'image-size'
import { projects } from '../src/data/projects.ts'
import { documentHeadings, documentSchema, elementText, isProjectDocument, resolveDocumentImageUrl } from '../src/lib/project-document.ts'

const defaultOutput = new URL('../public/data/project-docs/', import.meta.url)
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw)
  .use(rehypeSanitize, documentSchema).use(documentHeadings)

export function redactLocalDetails(markdown) {
  return markdown
    .replace(/\b[A-Za-z]:[\\/](?:[^\s`"'<>|)\]]+)/g, '<project-path>')
    .replace(/\/(?:home|Users)\/[^\s`"'<>|)\]]+/g, '<project-path>')
    .replace(/\/(?:mnt\/[a-z]|workspace|workspaces|root)\/[^\s`"'<>|)\]]+/g, '<project-path>')
    .replace(/((?:conda|mamba)\s+(?:activate|create\s+(?:-n|--name))\s+)[\w.-]+/g, '$1<environment>')
    .replace(/\b[\w.-]+@[\w.-]+(?=:[~\/])/g, '<user>@<host>')
}

async function request(url, fetchImpl) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response
    } catch { if (attempt === 2) throw new Error('Document resource unavailable') }
  }
}

async function atomicWrite(target, value) {
  await mkdir(dirname(fileURLToPath(target)), { recursive: true })
  const temporary = new URL(`${target.href}.tmp`)
  await writeFile(temporary, value)
  await rename(temporary, target)
}

export async function syncProjectDocument(project, {
  output = defaultOutput,
  siteUrl = process.env.SITE_URL || 'https://jordnary.github.io/',
  fetchImpl = fetch,
} = {}) {
  const outputUrl = output instanceof URL ? output : pathToFileURL(`${resolve(output)}/`)
  const target = new URL(`${project.id}.json`, outputUrl)
  const published = new URL(`data/project-docs/`, `${siteUrl.replace(/\/$/, '')}/`)
  const path = project.source.href.split('/blob/HEAD/')[1] || 'README.md'
  const sourceUrl = `${project.repository}/blob/HEAD/${path}`
  const rawUrl = `https://raw.githubusercontent.com/${new URL(project.repository).pathname.slice(1)}/HEAD/${path}`
  let document
  let reused = false
  try {
    const markdown = redactLocalDetails(await (await request(rawUrl, fetchImpl)).text())
    if (!markdown.trim() || markdown.length > 2_000_000) throw new Error('Invalid document')
    const tree = await processor.run(processor.parse(markdown))
    const headings = []
    const urls = new Map()
    visit(tree, 'element', node => {
      if (/^h[23]$/.test(node.tagName)) headings.push({ id: node.properties.id, text: elementText(node), level: Number(node.tagName.slice(1)) })
      if (node.tagName === 'img' && typeof node.properties.src === 'string') {
        const url = new URL(resolveDocumentImageUrl(node.properties.src, rawUrl))
        if (url.protocol === 'https:') urls.set(url.href, String(node.properties.alt || ''))
      }
    })
    const images = {}
    // Sequential requests keep public hosts responsive and bound peak memory.
    for (const [url, alt] of urls) {
      const response = await request(url, fetchImpl)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length > 15_000_000) throw new Error('Image exceeds document limit')
      const size = imageSize(bytes)
      const extension = size.type === 'jpg' ? 'jpeg' : size.type
      if (!['png', 'jpeg', 'webp', 'gif', 'svg', 'avif'].includes(extension)) throw new Error('Unsupported document image')
      const file = `assets/${createHash('sha256').update(bytes).digest('hex').slice(0, 24)}.${extension}`
      await atomicWrite(new URL(file, outputUrl), bytes)
      images[url] = { file, width: size.width, height: size.height, alt }
    }
    document = { version: 1, id: project.id, markdown, sourceUrl, rawUrl, fetchedAt: new Date().toISOString(), headings, images }
  } catch {
    // Restore an entire published snapshot, including its same-origin images.
    const candidates = await Promise.allSettled([
      readFile(target, 'utf8').then(JSON.parse),
      request(new URL(`${project.id}.json`, published), fetchImpl).then(r => r.json()),
    ])
    const documents = candidates.filter(r => r.status === 'fulfilled' && isProjectDocument(r.value, project.id))
      .map(r => r.value).sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))
    for (const candidate of documents) {
      try {
        for (const image of Object.values(candidate.images)) {
          const destination = new URL(image.file, outputUrl)
          try { await readFile(destination) } catch {
            const response = await request(new URL(image.file, published), fetchImpl)
            await atomicWrite(destination, new Uint8Array(await response.arrayBuffer()))
          }
        }
        document = candidate
        break
      } catch { /* Try the next complete snapshot. */ }
    }
    if (!document) throw new Error(`${project.id}: no complete document snapshot; build stopped.`)
    reused = true
  }
  await atomicWrite(target, `${JSON.stringify(document)}\n`)
  return { document, reused }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let failures = 0
  for (const project of projects) {
    try {
      const { document, reused } = await syncProjectDocument(project)
      console.log(`${project.id}: ${reused ? 'retained snapshot' : 'synced'}, ${Object.keys(document.images).length} images.`)
    } catch {
      console.error(`${project.id}: no complete document snapshot; build stopped.`)
      failures++
    }
  }
  if (failures) process.exitCode = 1
}
