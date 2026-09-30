import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPageFromUrl, getProjectFromUrl, getProjectHref, sitePages } from '../src/lib/routes.ts'
import { projects } from '../src/data/projects.ts'

test('client navigation recognizes every static page and its HTML alias at root and under a deployment base', () => {
  for (const base of ['/', '/portfolio/']) {
    for (const page of sitePages) {
      const path = page === 'home' ? base : `${base}${page}/`
      for (const suffix of ['', 'index.html', '?source=search#details']) {
        assert.equal(getPageFromUrl(new URL(`${path}${suffix}`, 'https://example.com'), base), page)
      }
      assert.equal(getPageFromUrl(new URL(path.replace(/\/$/, '') || '/', 'https://example.com'), base), page)
    }
    for (const path of ['/unknown/', '/about/extra/', '/public/file.pdf', '/live2d/vampire/model.model3.json']) {
      assert.equal(getPageFromUrl(new URL(path, 'https://example.com'), base), null)
    }
  }
  assert.equal(getPageFromUrl(new URL('https://example.com/about/'), '/portfolio/'), null)
})

test('project detail URLs recognize only known projects at root and under a deployment base', () => {
  for (const base of ['/', '/portfolio/']) {
    for (const project of projects) {
      const path = getProjectHref(project.id, base)
      for (const alias of [path, path.slice(0, -1), `${path}index.html?ref=share#doc-results`]) {
        const url = new URL(alias, 'https://example.com')
        assert.equal(getProjectFromUrl(url, base)?.id, project.id)
        assert.equal(getPageFromUrl(url, base), 'projects')
      }
    }
    assert.equal(getProjectFromUrl(new URL(`${base}projects/missing/`, 'https://example.com'), base), undefined)
    assert.equal(getPageFromUrl(new URL(`${base}projects/missing/`, 'https://example.com'), base), null)
  }
})
