import { readFile, writeFile } from 'node:fs/promises'

const output = 'node_modules/.cache/inpage-images'
const name = process.argv[2] || '3G'
if (!/^[a-z0-9-]+$/i.test(name)) throw new Error('Invalid report name')
const { samples, browser, runs, ect } = JSON.parse(await readFile(`${output}/measure-${name}.json`, 'utf8'))
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const profiles = [...new Set(samples.map(sample => sample.profile))]
const scenarios = [...new Set(samples.map(sample => sample.scenario))]
const rows = []
for (const profile of profiles) for (const scenario of scenarios) {
  const values = {}
  for (const version of ['baseline', 'candidate']) {
    const group = samples.filter(sample => sample.profile === profile && sample.scenario === scenario && sample.version === version)
    if (!group.length) continue
    values[version] = {
      waitMs: Math.round(median(group.map(sample => sample.maxWait))),
      imageKiB: Math.round(median(group.map(sample => sample.imageBytes)) / 102.4) / 10,
      unusedImageKiB: Math.round(median(group.map(sample => sample.unusedImageBytes)) / 102.4) / 10,
      totalKiB: Math.round(median(group.map(sample => sample.network.wireBytes)) / 102.4) / 10,
      partialKiB: Math.round(median(group.map(sample => sample.network.pendingBytes)) / 102.4) / 10,
      pending: median(group.map(sample => sample.network.pending)),
      feedbackMs: Math.round(median(group.map(sample => sample.feedback).filter(value => value !== null))) || null,
      count: group.length,
      longTaskMs: Math.round(median(group.map(sample => sample.longTaskMs))),
      blockingMs: Math.round(median(group.map(sample => sample.blockingMs))),
      elements: median(group.map(sample => sample.elements)),
    }
  }
  const regression = values.baseline && values.candidate
    ? values.candidate.waitMs - values.baseline.waitMs > Math.max(100, values.baseline.waitMs * .1) : false
  rows.push({ profile, scenario, ...values, regression })
}
await writeFile(`${output}/summary-${name}.json`, JSON.stringify({ browser, runs, ect, rows }, null, 2))
const table = ['| Profile | Scene | Visible wait ms | Image KiB | Unused image KiB | Total completed KiB | Pending |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
  ...rows.map(row => {
    const pair = key => [row.baseline, row.candidate].filter(Boolean).map(value => value[key]).join(' → ')
    return `| ${row.profile} | ${row.scenario} | ${pair('waitMs')}${row.regression ? ' REVIEW' : ''} | ${pair('imageKiB')} | ${pair('unusedImageKiB')} | ${pair('totalKiB')} | ${pair('pending')} |`
  })].join('\n')
await writeFile(`${output}/summary-${name}.md`, `${table}\n`)
console.log(table)
