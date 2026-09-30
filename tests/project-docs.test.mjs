import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syncProjectDocument, redactLocalDetails } from '../scripts/sync-project-docs.mjs'
import { isProjectDocument, resolveDocumentImageUrl, resolveDocumentLink } from '../src/lib/project-document.ts'

const project = { id: 'sample', repository: 'https://github.com/example/sample', source: { href: 'https://github.com/example/sample/blob/HEAD/reports/report.md' } }
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100"/></svg>'

test('sync resolves relative, reference and HTML images with stable heading IDs and an offline fallback', async () => {
  const output = await mkdtemp(join(tmpdir(), 'project-doc-test-'))
  try {
    const requested = []
    const fetchImpl = async url => {
      requested.push(String(url))
      return new Response(String(url).endsWith('.md') ? '# Report\n## Results\n## Results\n![Figure](../figures/a.svg)\n![Ref][figure]\n\n[figure]: ../figures/a.svg\n\n<img src="../figures/b.svg" alt="HTML figure">\n\n<script>alert(1)</script>\n\n$$x^2$$' : svg)
    }
    const { document, reused } = await syncProjectDocument(project, { output, fetchImpl })
    assert.equal(reused, false)
    assert.deepEqual(document.headings.map(h => h.id), ['doc-report', 'doc-results', 'doc-results-1'])
    assert.equal(Object.keys(document.images).length, 2)
    assert.ok(requested.includes('https://raw.githubusercontent.com/example/sample/HEAD/figures/a.svg'))
    for (const image of Object.values(document.images)) {
      assert.equal(image.width, 200)
      assert.equal(await readFile(join(output, image.file), 'utf8'), svg)
    }
    assert.equal(resolveDocumentLink('../code.py', document), 'https://github.com/example/sample/blob/HEAD/code.py')
    assert.equal(resolveDocumentLink('#results', document), '#doc-results')
    assert.equal(resolveDocumentLink('javascript:alert(1)', document), '')
    assert.equal(resolveDocumentLink('/figures/a.svg', document), 'https://github.com/example/sample/blob/HEAD/figures/a.svg')
    assert.equal(resolveDocumentImageUrl('/figures/a.svg', document.rawUrl), 'https://raw.githubusercontent.com/example/sample/HEAD/figures/a.svg')
    assert.equal(resolveDocumentImageUrl('https://github.com/example/sample/blob/main/a.png', document.rawUrl), 'https://raw.githubusercontent.com/example/sample/main/a.png')
    assert.equal(isProjectDocument({ ...document, headings: [{ id: null }] }, 'sample'), false)
    assert.equal(isProjectDocument({ ...document, images: { a: { file: '../outside.svg' } } }, 'sample'), false)
    const fallback = await syncProjectDocument(project, { output, fetchImpl: async () => { throw new Error('Offline') } })
    assert.equal(fallback.reused, true)
    assert.equal(fallback.document.fetchedAt, document.fetchedAt)
  } finally { await rm(output, { recursive: true, force: true }) }
})

test('a clean build restores published images and stops without a valid fallback', async () => {
  const output = await mkdtemp(join(tmpdir(), 'project-doc-test-'))
  try {
    const snapshot = { version: 1, id: 'sample', markdown: '# Cached', sourceUrl: project.source.href, rawUrl: 'https://raw.githubusercontent.com/example/sample/HEAD/reports/report.md', fetchedAt: '2026-01-01T00:00:00Z', headings: [], images: { figure: { file: 'assets/abcdef.svg', width: 200, height: 100 } } }
    const { reused } = await syncProjectDocument(project, { output, siteUrl: 'https://example.com/portfolio/', fetchImpl: async url => {
      if (String(url) === 'https://example.com/portfolio/data/project-docs/sample.json') return Response.json(snapshot)
      if (String(url) === 'https://example.com/portfolio/data/project-docs/assets/abcdef.svg') return new Response(svg)
      return new Response('', { status: 503 })
    } })
    assert.equal(reused, true)
    assert.equal(await readFile(join(output, 'assets/abcdef.svg'), 'utf8'), svg)
    await assert.rejects(syncProjectDocument({ ...project, id: 'missing' }, { output, fetchImpl: async () => new Response('', { status: 503 }) }), /build stopped/)
  } finally { await rm(output, { recursive: true, force: true }) }
})

test('local paths, environment names and shell identities are redacted', () => {
  const clean = redactLocalDetails('`C:\\Users\\example\\project` `/home/example/project` `conda activate sample-env` example@workstation:~/project')
  assert.ok(!clean.includes('example') && !clean.includes('sample-env') && !clean.includes('workstation'))
  assert.ok(clean.includes('<project-path>') && clean.includes('<environment>'))
})
