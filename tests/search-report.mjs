import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { output } from './search-support.mjs'

const label = process.argv[2] || 'acceptance'
assert.match(label, /^[a-z0-9-]+$/i)
const data = JSON.parse(await readFile(`${output}/${label}.json`, 'utf8'))
assert.equal(data.methodVersion, 1)
assert.ok(Number.isInteger(data.runs) && data.runs >= 3, 'Budget acceptance needs at least three runs')
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const round = n => Math.round(n * 10) / 10
const rows = [], violations = []
for (const scenario of [...new Set(data.samples.map(s => s.scenario))]) {
  for (const profile of [...new Set(data.samples.map(s => s.profile))]) for (const cache of ['cold', 'warm']) {
    const row = { scenario, profile, cache }
    for (const version of ['baseline', 'candidate']) {
      const samples = data.samples.filter(s => s.version === version && s.scenario === scenario && s.profile === profile && s.cache === cache)
      assert.equal(samples.length, data.runs)
      const metric = (phase, key) => round(median(samples.map(s => s[phase][key])))
      const bytes = (phase, type) => round(median(samples.map(s => s.network
        .filter(r => (!phase || r.phase === phase) && r.type === type).reduce((sum, r) => sum + r.bytes, 0))) / 1024)
      row[version] = { firstFeedback: metric('first', 'feedback'), firstVisibleResults: metric('first', 'results'),
        firstSettled: metric('first', 'settled'), reopenFeedback: metric('reopened', 'feedback'), reopenVisibleResults: metric('reopened', 'results'),
        reopenSettled: metric('reopened', 'settled'), maxFeedback: round(Math.max(...samples.flatMap(s => [s.first.feedback, s.reopened.feedback]))),
        longTaskMs: metric('first', 'longTaskMs'), maxTaskMs: Math.max(...samples.map(s => s.first.maxTaskMs)),
        startupJS: bytes('startup', 'Script'), startupCSS: bytes('startup', 'Stylesheet'),
        intentJS: bytes('intent', 'Script'), intentCSS: bytes('intent', 'Stylesheet'),
        firstJS: bytes('first', 'Script'), firstCSS: bytes('first', 'Stylesheet'),
        reopenJS: bytes('reopen', 'Script'), reopenCSS: bytes('reopen', 'Stylesheet'), totalJS: bytes(null, 'Script'), totalCSS: bytes(null, 'Stylesheet'),
        pending: Math.max(...samples.map(s => s.network.filter(r => !r.done && !r.failed).length)),
        pendingCode: Math.max(...samples.map(s => s.network.filter(r => !r.done && !r.failed && ['Script', 'Stylesheet'].includes(r.type)).length)),
        pendingBytes: Math.max(...samples.map(s => s.network.filter(r => !r.done && !r.failed).reduce((sum, r) => sum + r.partial, 0))),
        failed: samples.reduce((sum, s) => sum + s.network.filter(r => r.failed).length, 0) }
    }
    if (row.candidate.maxFeedback > 100) violations.push({ scenario, profile, cache, metric: 'feedback', observed: row.candidate.maxFeedback, budget: 100 })
    for (const metric of ['firstSettled', 'reopenSettled']) {
      const budget = row.baseline[metric] + Math.max(row.baseline[metric] * .1, 100)
      if (row.candidate[metric] > budget) violations.push({ scenario, profile, cache, metric, observed: row.candidate[metric], budget })
    }
    assert.equal(row.candidate.pendingCode, 0)
    assert.equal(row.candidate.failed, 0)
    assert.equal(row.candidate.reopenJS + row.candidate.reopenCSS, 0)
    rows.push(row)
  }
}
await writeFile(`${output}/${label}-summary.json`, JSON.stringify({ rows, violations }, null, 2))
console.log(JSON.stringify({ rows, violations }, null, 2))
assert.deepEqual(violations, [], 'Feedback and animation-complete result readiness must satisfy the documented budgets; first visible results are reported separately')
