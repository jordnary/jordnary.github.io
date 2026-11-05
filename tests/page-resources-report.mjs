import { readFile, stat, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const directory = 'node_modules/.cache/page-resources'
const report = JSON.parse(await readFile(`${directory}/measure.json`, 'utf8'))
const samples = report.samples.filter(sample => sample.phase !== 'unused-intent')
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const paths = [...new Set(samples.map(sample => sample.path))]
const profiles = [...new Set(samples.map(sample => sample.profile))]
const comparisons = []
const lines = []
for (const profile of profiles) {
  lines.push(`\n${profile}\n`, '| Route | Cold ready ms | First ready ms | Repeat ready ms |', '| --- | ---: | ---: | ---: |')
  for (const path of paths) {
    const row = []
    for (const phase of ['cold', 'first', 'repeat']) {
      const versions = ['baseline', 'candidate'].map(version => {
        const group = samples.filter(sample => sample.version === version && sample.profile === profile && sample.path === path && sample.phase === phase)
        if (group.length !== 3) throw new Error(`Expected three samples: ${version} ${profile} ${path} ${phase}`)
        const metrics = ['readyMs', 'mountedMs', 'fcpMs', 'lcpMs', 'feedbackMs', 'longTaskMs', 'blockingMs', 'domNodes']
        return { version, ...Object.fromEntries(metrics.map(key => [key, median(group.map(sample => sample[key]))])),
          readyRange: [Math.min(...group.map(sample => sample.readyMs)), Math.max(...group.map(sample => sample.readyMs))],
          wireKiB: median(group.map(sample => sample.network.wireBytes)) / 1024,
          requests: median(group.map(sample => sample.network.requests)),
          maxPending: Math.max(...group.map(sample => sample.network.pending)),
          maxCls: Math.max(...group.map(sample => sample.cls)),
          maxFeedbackMs: Math.max(...group.map(sample => sample.feedbackMs)) }
      })
      const [baseline, candidate] = versions
      const budget = Math.max(baseline.readyMs * 0.1, 100)
      comparisons.push({ profile, path, phase, baseline, candidate,
        readyBudgetPassed: candidate.readyMs - baseline.readyMs <= budget,
        mountReview: candidate.mountedMs - baseline.mountedMs > Math.max(baseline.mountedMs * 0.1, 100) })
      row.push(versions.map(value => Math.round(value.readyMs)).join(' → '))
    }
    lines.push(`| ${path} | ${row.join(' | ')} |`)
  }
}

// naturalWidth is density-corrected for srcset. Also retain the actual input-file
// pixel dimensions and encoded file size; neither field estimates GPU allocation.
const imagePaths = [...new Set(report.samples.flatMap(sample => sample.network.list)
  .map(request => request.path).filter(path => /^\/images\/[a-z0-9/_-]+\.(?:webp|png|jpg|jpeg)$/i.test(path)))]
const imageSources = await Promise.all(imagePaths.map(async path => {
  const source = `public${path}`
  const [metadata, file] = await Promise.all([sharp(source).metadata(), stat(source)])
  return { path, pixelWidth: metadata.width, pixelHeight: metadata.height, encodedFileBytes: file.size }
}))
const unused = report.samples.filter(sample => sample.phase === 'unused-intent').map(sample => ({
  version: sample.version, path: sample.path, requests: sample.network.requests,
  wireKiB: sample.network.wireBytes / 1024, pending: sample.network.pending,
}))
const failures = comparisons.filter(item => !item.readyBudgetPassed)
const reviews = comparisons.filter(item => item.mountReview)
const summary = { samples: report.samples.length, comparisons, unused, imageSources,
  readyBudgetFailures: failures.map(({ profile, path, phase }) => ({ profile, path, phase })),
  mountReviews: reviews.map(({ profile, path, phase }) => ({ profile, path, phase })) }
await writeFile(`${directory}/summary.json`, JSON.stringify(summary, null, 2))
await writeFile(`${directory}/summary.md`, lines.join('\n'))
console.log(lines.join('\n'))
console.log(JSON.stringify({ samples: report.samples.length, readyBudgetFailures: summary.readyBudgetFailures, mountReviews: summary.mountReviews }))
if (failures.length) process.exitCode = 1
