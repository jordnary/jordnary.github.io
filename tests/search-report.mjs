import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { output, versions } from './search-support.mjs'

const label = process.argv[2] || 'acceptance'
assert.match(label, /^[a-z0-9-]+$/i)
const data = JSON.parse(await readFile(`${output}/${label}.json`, 'utf8'))
assert.equal(data.methodVersion, 2)
assert.ok(Number.isInteger(data.runs) && data.runs >= 3, 'Acceptance needs at least three runs')
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const round = n => Math.round(n * 10) / 10
const rows = [], violations = []
for (const scenario of [...new Set(data.samples.map(s => s.scenario))]) {
  for (const profile of [...new Set(data.samples.map(s => s.profile))]) for (const cache of ['cold', 'warm']) {
    const row = { scenario, profile, cache }
    for (const [version] of versions) {
      const samples = data.samples.filter(s => s.version === version && s.scenario === scenario && s.profile === profile && s.cache === cache)
      assert.equal(samples.length, data.runs)
      if (version === 'candidate') for (const sample of samples) for (const phase of ['first', 'reopened']) {
        assert.equal(sample[phase].results, scenario === 'input' ? sample[phase].inputEcho : sample[phase].feedback,
          'Matching results must appear with feedback/query echo, without a separate construction or download wait')
      }
      const metric = (phase, key) => round(median(samples.map(s => s[phase][key])))
      const bytes = (phase, type) => round(median(samples.map(s => s.network
        .filter(r => (!phase || r.phase === phase) && (!type || r.type === type)).reduce((sum, r) => sum + r.bytes, 0))) / 1024)
      row[version] = { startupReady: round(median(samples.map(s => s.startupReady))),
        navigationActionable: round(median(samples.map(s => s.first.start + s.first.actionable))) }
      for (const phase of ['first', 'reopened']) row[version][phase] = Object.fromEntries(
        ['feedback', 'inputEcho', 'results', 'actionable', 'entranceEnded', 'settled', 'longTaskMs', 'blockingMs'].map(key => [key, metric(phase, key)]))
      Object.assign(row[version], {
        maxFeedback: round(Math.max(...samples.flatMap(s => [s.first.feedback, s.reopened.feedback]))),
        maxTaskMs: Math.max(...samples.map(s => s.first.maxTaskMs)),
        startupJS: bytes('startup', 'Script'), startupCSS: bytes('startup', 'Stylesheet'),
        intentJS: bytes('intent', 'Script'), intentCSS: bytes('intent', 'Stylesheet'),
        firstJS: bytes('first', 'Script'), firstCSS: bytes('first', 'Stylesheet'),
        reopenJS: bytes('reopen', 'Script'), reopenCSS: bytes('reopen', 'Stylesheet'), totalJS: bytes(null, 'Script'), totalCSS: bytes(null, 'Stylesheet'),
        pending: Math.max(...samples.map(s => s.network.filter(r => !r.done && !r.failed).length)),
        pendingCode: Math.max(...samples.map(s => s.network.filter(r => !r.done && !r.failed && ['Script', 'Stylesheet'].includes(r.type)).length)),
        pendingBytes: Math.max(...samples.map(s => s.network.filter(r => !r.done && !r.failed).reduce((sum, r) => sum + r.partial, 0))),
        failed: samples.reduce((sum, s) => sum + s.network.filter(r => r.failed).length, 0),
      })
      assert.equal(row[version].pendingCode, 0)
      assert.equal(row[version].failed, 0)
      assert.equal(row[version].reopenJS + row[version].reopenCSS, 0)
    }
    // Result visibility and proven activation are independent gates, never hidden by entrance duration.
    for (const phase of ['first', 'reopened']) for (const metric of ['feedback', 'inputEcho', 'results', 'actionable', 'settled']) {
      const baseline = row.baseline[phase][metric]
      const budget = baseline + Math.max(baseline * .1, metric === 'settled' ? 100 : 50)
      if (row.candidate[phase][metric] > budget) violations.push({ scenario, profile, cache, phase, metric, observed: row.candidate[phase][metric], budget })
    }
    assert.equal(row.candidate.firstJS + row.candidate.firstCSS, 0)
    rows.push(row)
  }
}
// Keep the previous absolute feedback goal visible, including every exceeded sample.
// Boundary selection prioritizes real result usability; do not label this goal as passed when it is not.
const feedbackGoalExceeded = data.samples.flatMap(s => ['first', 'reopened'].filter(phase => s[phase].feedback > 100)
  .map(phase => ({ version: s.version, profile: s.profile, scenario: s.scenario, cache: s.cache, run: s.run, phase, feedback: round(s[phase].feedback) })))
await writeFile(`${output}/${label}-summary.json`, JSON.stringify({ rows, violations, feedbackGoalExceeded }, null, 2))
console.log(JSON.stringify({ rows, violations, feedbackGoalExceeded }, null, 2))
assert.deepEqual(violations, [], 'Feedback, result first frame, activation and entrance must each meet their own budget')
