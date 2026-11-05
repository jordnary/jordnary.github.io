import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

async function main() {
  const label = process.argv[2] || 'acceptance-v3'
  assert.match(label, /^[a-z0-9-]+$/i)
  const report = JSON.parse(await readFile(`node_modules/.cache/first-open/${label}.json`, 'utf8'))
  assert.equal(report.methodVersion, 3)
  assert.ok(report.samples.every(sample => sample.first.every(step => typeof step.feedback === 'number' && typeof step.ready === 'number'
    && (step.kind === 'main-menu' || typeof step.images === 'number')
    && (step.kind !== 'reader' || typeof step.fonts === 'number'))), 'Every first-open observation must complete')
  assert.ok(report.samples.every(sample => sample.after.list.every(request => !request.failed)), 'Acceptance samples must not contain network failures')
  const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]
  const rows = []
  for (const version of ['baseline', 'candidate']) for (const profile of ['desktop-network', 'desktop-weak', 'mobile-weak']) for (const cache of ['cold', 'warm']) for (const scenario of ['menu', 'reader', 'gallery']) {
    const samples = report.samples.filter(s => s.version === version && s.profile === profile && s.cache === cache && s.scenario === scenario)
    assert.equal(samples.length, 3, 'Acceptance requires three samples per condition')
    for (const kind of samples[0].first.map(s => s.kind)) {
      const first = samples.map(s => s.first.find(step => step.kind === kind))
      const repeated = samples.map(s => s.repeated.find(step => step.kind === kind))
      const row = { version, profile, cache, kind,
        feedback: median(first.map(s => s.feedback)), maxFeedback: Math.max(...first.map(s => s.feedback)),
        ready: median(first.map(s => s.ready)), images: kind !== 'main-menu' ? median(first.map(s => s.images)) : null,
        fonts: kind === 'reader' ? median(first.map(s => s.fonts)) : null,
        longTask: median(first.map(s => s.longTaskMs)), blocking: median(first.map(s => s.blockingMs)), maxTask: Math.max(...first.map(s => s.maxTaskMs)),
        repeatFeedback: median(repeated.map(s => s.feedback)), repeatMax: Math.max(...repeated.map(s => s.feedback)),
        KiB: median(samples.map(s => s.after.bytes / 1024)), fontKiB: median(samples.map(s => s.after.fontBytes / 1024)),
        pending: Math.max(...samples.map(s => s.after.pending)),
        repeatKiB: median(samples.map(s => (s.reopened.bytes - s.after.bytes) / 1024)),
        repeatFonts: Math.max(...samples.map(s => s.reopened.list.filter(r => r.phase === 'reopen' && r.type === 'Font').length)),
        requests: median(samples.map(s => s.after.list.length)), fontRequests: median(samples.map(s => s.after.list.filter(r => r.type === 'Font').length)) }
      rows.push(row)
    }
  }
  const comparisons = rows.filter(row => row.version === 'candidate').map(after => {
    const before = rows.find(row => row.version === 'baseline' && row.profile === after.profile && row.cache === after.cache && row.kind === after.kind)
    const pair = key => `${Math.round(before[key])} → ${Math.round(after[key])}`
    return { profile: after.profile, cache: after.cache, kind: after.kind, feedback: pair('feedback'), maxFeedback: after.maxFeedback,
      ready: pair('ready'), readyWithinBudget: after.ready <= before.ready + Math.max(100, before.ready * .1),
      fonts: after.fonts === null ? null : pair('fonts'), fontsWithinBudget: after.fonts === null || after.fonts <= before.fonts + Math.max(100, before.fonts * .1),
      images: after.images === null ? null : pair('images'), imagesWithinBudget: after.images === null || after.images <= before.images + Math.max(100, before.images * .1),
      longTask: pair('longTask'), blocking: pair('blocking'), maxTask: pair('maxTask'),
      repeatFeedback: pair('repeatFeedback'), repeatMax: after.repeatMax,
      KiB: pair('KiB'), fontKiB: pair('fontKiB'), pending: after.pending, fontRequests: pair('fontRequests'), repeatKiB: pair('repeatKiB'), repeatFonts: after.repeatFonts }
  })
  for (const row of comparisons) console.log(JSON.stringify(row))
  await writeFile(`node_modules/.cache/first-open/${label}-summary.json`, JSON.stringify({ browser: report.browser, rows, comparisons }, null, 2))
  assert.ok(comparisons.every(row => row.readyWithinBudget && row.fontsWithinBudget && row.imagesWithinBudget), 'Content, image and font readiness must preserve the documented tolerance')
  assert.ok(comparisons.every(row => row.maxFeedback <= 100 && row.repeatMax <= 100), 'First and repeated visible feedback must meet the 100 ms budget')
  assert.ok(comparisons.every(row => row.pending === 0), 'Completed transfer comparisons require no pending requests')
}

await main().catch(error => { console.error(`First-open acceptance failed: ${error.message}`); process.exitCode = 1 })
