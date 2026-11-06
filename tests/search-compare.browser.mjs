import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import sharp from 'sharp'
import { launch, home, output, versions } from './search-support.mjs'

// The build projection and the baseline UI are independent parity oracles.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
let entries
try {
  const { createSearchEntries } = await server.ssrLoadModule('/src/data/searchIndex.ts')
  entries = createSearchEntries('/')
  const prefixed = createSearchEntries('/preview/')
  assert.deepEqual(prefixed.map(e => ({ ...e, href: e.href.replace('/preview/', '/') })), entries)
} finally { await server.close() }
const queries = [...new Set(['', 'AI', 'React', ' REACT  ai ', '数据库', 'GitHub', '???', ...entries.flatMap(e => [e.title, ...e.keywords])])]
const browser = await launch()
const report = {}
try {
  await mkdir(output, { recursive: true })
  for (const [version, base] of versions) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await home(page, base)
    await page.keyboard.press('Control+k')
    await page.locator('.site-search-result').first().waitFor()
    report[version] = { queries: {}, geometry: {} }
    for (const query of queries) {
      await page.locator('.site-search-input').fill(query)
      report[version].queries[query] = await page.locator('.site-search-result').evaluateAll(items => items.map(a => ({
        title: a.querySelector('strong').textContent, description: a.querySelector('.site-search-result-copy > span').textContent,
        kind: a.querySelector('.site-search-result-type').textContent, href: new URL(a.href).pathname + new URL(a.href).hash,
      })))
    }
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport)
      await page.locator('.site-search-input').fill('React')
      await page.waitForTimeout(250)
      report[version].geometry[viewport.width] = await page.locator('.site-search-dialog,.site-search-input-row,.site-search-results,.site-search-result,.site-search-footer').evaluateAll(items => items.map(el => {
        const r = el.getBoundingClientRect(); return { className: el.className, x: r.x, y: r.y, width: r.width, height: r.height }
      }))
      await page.locator('.site-search-dialog').screenshot({ path: `${output}/${version}-${viewport.width}.png`, animations: 'disabled' })
    }
    await context.close()
  }
  for (const version of ['split', 'candidate']) {
    assert.deepEqual(report[version].queries, report.baseline.queries)
    assert.deepEqual(report[version].geometry, report.baseline.geometry)
  }
  report.visual = []
  for (const width of [1440, 390, 844]) {
    const [a, b] = await Promise.all(['baseline', 'candidate'].map(async version => sharp(`${output}/${version}-${width}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })))
    assert.deepEqual(a.info, b.info)
    let changed = 0, maxDifference = 0
    for (let i = 0; i < a.data.length; i += 4) {
      let delta = 0
      for (let j = 0; j < 3; j++) delta = Math.max(delta, Math.abs(a.data[i + j] - b.data[i + j]))
      if (delta) changed++
      maxDifference = Math.max(maxDifference, delta)
    }
    report.visual.push({ width, changedPixels: changed, maxDifference, totalPixels: a.info.width * a.info.height })
  }
  await writeFile(`${output}/comparison.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ entries: entries.length, queries: queries.length, visual: report.visual }))
} finally { await browser.close() }
