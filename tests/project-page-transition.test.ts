import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projects } from '../src/data/projects.ts'
import { shouldTransitionProjects } from '../src/lib/project-page-transition.ts'
import { sitePages } from '../src/lib/routes.ts'

const origin = 'https://example.com'
const url = (path: string) => new URL(path, origin)

test('transitions enter, leave and move between every distinct Projects page', () => {
  for (const base of ['/', '/portfolio/']) {
    const projectPaths = [`${base}projects/`, `${base}projects/studio/`,
      ...projects.map(project => `${base}projects/${project.id}/`)]
    const otherPaths = sitePages.filter(page => page !== 'projects').map(page => `${base}${page}/`)
    for (const from of projectPaths) {
      for (const to of [...projectPaths, ...otherPaths]) {
        assert.equal(shouldTransitionProjects(url(from), url(to), base), from !== to, `${from} -> ${to}`)
        assert.equal(shouldTransitionProjects(url(to), url(from), base), from !== to, `${to} -> ${from}`)
      }
      assert.equal(shouldTransitionProjects(url(base), url(from), base), true)
      assert.equal(shouldTransitionProjects(url(from), url(`${base}index.html`), base), true)
    }
  }
})

test('same-page anchors, query parameters and static HTML aliases do not replay the transition', () => {
  for (const base of ['/', '/portfolio/']) {
    for (const path of [`${base}projects/`, `${base}projects/studio/`,
      ...projects.map(project => `${base}projects/${project.id}/`)]) {
      const aliases = [path, path.slice(0, -1), `${path}index.html`, `${path}?source=search`, `${path}#overview`,
        `${path}index.html?source=search#overview`]
      for (const from of aliases) {
        for (const to of aliases) assert.equal(shouldTransitionProjects(url(from), url(to), base), false)
      }
    }
  }
})

test('ordinary site navigation, external destinations and unknown routes remain outside the transition', () => {
  for (const base of ['/', '/portfolio/']) {
    const otherPaths = sitePages.filter(page => page !== 'projects').map(page => `${base}${page}/`)
    for (const from of otherPaths) {
      for (const to of otherPaths) assert.equal(shouldTransitionProjects(url(from), url(to), base), false)
    }
    const archive = url(`${base}projects/`)
    for (const destination of [url(`${base}missing/`), url(`${base}projects/missing/`),
      url(`${base}projects/studio/extra/`), url(`${base}public/file.pdf`),
      new URL(`${base}projects/`, 'https://other.example.com'),
      new URL(`${base}projects/`, 'http://example.com')]) {
      assert.equal(shouldTransitionProjects(archive, destination, base), false)
      assert.equal(shouldTransitionProjects(destination, archive, base), false)
    }
  }
  assert.equal(shouldTransitionProjects(url('/projects/'), url('/portfolio/projects/'), '/portfolio/'), false)
})
