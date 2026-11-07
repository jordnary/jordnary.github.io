import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

// Inputs are the unfiltered, serial ux-baseline batches; comparisons are made
// per route and profile, never by pooling unlike pages into a single score.
const dir = 'node_modules/.cache/p6'
const load = async file => JSON.parse(await readFile(file, 'utf8'))
const [before, after] = await Promise.all(['before', 'after'].map(s => load(dir + '/routes-' + s + '.json')))
assert.equal(before.revision, '456f623')
assert.equal(before.browser, after.browser)
assert.deepEqual(before.profiles, after.profiles)
for (const d of [before, after]) {
  assert.equal(d.settleMs, 2000); assert.equal(d.runs, 3); assert.equal(d.samples.length, 96)
}
const median = a => a.every(Number.isFinite) ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null
const fmt = (n, places = 0) => n === null ? '—' : n.toFixed(places)
const totals = s => Object.values(s.network).reduce((sum, t) => {
  for (const field in t) sum[field] = (sum[field] || 0) + t[field]
  return sum
}, {})
const lines = [], flagged = []
const routes = [...new Set(before.samples.map(s => s.route))]
assert.equal(routes.length, 8)
for (const { name } of before.profiles) for (const cache of ['cold', 'warm-reload']) {
  lines.push('**' + name + ' · ' + cache + '**', '',
    '| 路由 | 挂载 ms | FCP ms | LCP 候选 ms | blocking ms | 请求 / 待完成 | 完成 KiB | 304 | DOM |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const route of routes) {
    const pair = [before, after].map(d => d.samples.filter(s => s.route === route && s.cache === cache && s.profile === name))
    pair.forEach(g => assert.deepEqual(g.map(s => s.run), [1, 2, 3]))
    const values = fn => pair.map(g => median(g.map(fn)))
    const field = f => values(s => s[f])
    const net = f => values(s => totals(s)[f])
    const cell = (v, places) => v.map(n => fmt(n, places)).join(' → ')
    const req = net('requests'), pend = net('pending')
    lines.push('| `' + route + '` | ' + [
      ...['readyMs','fcpMs','lcpMs','blockingMs'].map(f => cell(field(f))),
      req.map((n,i) => n + '/' + pend[i]).join(' → '), cell(net('wireBytes').map(n => n/1024), 1),
      cell(net('notModified')), cell(field('domNodes')),
    ].join(' | ') + ' |')
    for (const f of ['readyMs','fcpMs','lcpMs']) {
      const [a,b] = field(f)
      if (a !== null && b !== null && b-a > Math.max(100, a*.1)) flagged.push({ name, cache, route, metric:f, before:a, after:b })
    }
  }
  lines.push('')
}
await writeFile(dir + '/route-tables.md', lines.join('\n') + '\n')
console.log(JSON.stringify({ flagged, versions: [before,after].map(d => ({
  revision: d.revision, browser: d.browser, errors: d.samples.reduce((n,s)=>n+s.pageErrors,0),
  failures: d.samples.reduce((n,s)=>n+totals(s).failed,0), maxCLS: Math.max(...d.samples.map(s=>s.cls)),
})) }, null, 2))

// Absolute goal (section 6.13): count each interaction, not the medians of
// grouped conditions, and don't substitute input echo or animation end.
if (process.argv.includes('--search')) {
  const search = await load('node_modules/.cache/search-main-thread/p6.json')
  assert.equal(search.methodVersion, 3); assert.equal(search.runs, 3)
  assert.equal(search.browser, after.browser); assert.equal(search.samples.length, 60)
  const profiles = [...new Set(search.samples.map(s => s.profile))]
  assert.equal(profiles.length, 5)
  for (const profile of profiles) for (const cache of ['cold', 'warm']) for (const scenario of ['input', 'direct']) {
    const group = search.samples.filter(s => s.profile === profile && s.cache === cache && s.scenario === scenario)
    assert.deepEqual(group.map(s => s.run), [1, 2, 3])
  }
  const report = []
  for (const profile of [...profiles, 'all']) {
    const group = search.samples.filter(s => profile === 'all' || s.profile === profile)
    const row = { profile, n: group.length }
    for (const phase of ['first', 'reopened']) {
      const feedback = group.map(s => {
        assert.equal(s.version, 'candidate')
        assert.ok(s[phase].feedback > 0 && s[phase].actionable > 0)
        assert.equal(s[phase].results, s.scenario === 'input' ? s[phase].inputEcho : s[phase].feedback)
        return s[phase].feedback
      })
      row[phase] = { over100: feedback.filter(t => t > 100).length, maxMs: Number(Math.max(...feedback).toFixed(1)) }
    }
    report.push(row)
  }
  console.log(JSON.stringify(report, null, 2))
}
