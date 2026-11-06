import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { launch, home, connectionState, profiles, sampler, output, versions } from './search-support.mjs'

// Separate visual acceptance: freezing is intentionally excluded from timing samples.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
let expected
try {
  const { createSearchEntries } = await server.ssrLoadModule('/src/data/searchIndex.ts')
  expected = createSearchEntries('/').slice(0, 6).map(({ title, href }) => ({ title, href }))
} finally { await server.close() }
const browser = await launch()
const report = []
try {
  await mkdir(output, { recursive: true })
  for (const profile of profiles.filter(p => ['desktop-weak', 'mobile-weak'].includes(p.name))) for (const motion of ['no-preference', 'reduce']) for (const [version, base] of versions) {
    const { name, cpu, mbps, latency, ...device } = profile
    const context = await browser.newContext({ ...device, reducedMotion: motion })
    await context.addInitScript(connectionState, { effectiveType: '3g', downlink: mbps, rtt: latency, saveData: false })
    await context.addInitScript(sampler)
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    await cdp.send('Network.emulateNetworkConditionsByRule', { offline: false, matchedNetworkConditions: [{ urlPattern: '', latency,
      downloadThroughput: mbps * 1e6 / 8, uploadThroughput: 750000 / 8 }] })
    try {
      await home(page, base); await page.waitForTimeout(500)
      await page.evaluate(expected => window.__measureSearch({ expected, freeze: true }), expected)
      await page.waitForFunction(() => window.__searchSample.frozen)
      const sample = await page.evaluate(() => window.__searchSample)
      assert.equal(sample.firstFrame.display, 'grid')
      assert.ok(sample.firstFrame.width > 250 && sample.firstFrame.height > 40)
      const animationDurations = await page.evaluate(() => ['.site-search-backdrop', '.site-search-dialog']
        .map(selector => getComputedStyle(document.querySelector(selector)).animationDuration))
      if (version === 'candidate') {
        assert.equal(await page.locator('link[data-search-style]').count(), 0)
        assert.equal(sample.results, sample.feedback, 'Real results accompany the first visible input frame')
        assert.deepEqual(animationDurations, report.find(row => row.version === 'baseline' && row.profile === name && row.motion === motion).animationDurations,
          'Preserve the baseline entrance durations for each motion preference')
      }
      await page.locator('.site-search-dialog').screenshot({ path: `${output}/first-frame-${version}-${name}-${motion}.png`, animations: 'allow' })
      report.push({ version, profile: name, motion, feedback: sample.feedback, results: sample.results, firstFrame: sample.firstFrame, animationDurations })
    } finally { await context.close() }
  }
  await writeFile(`${output}/first-frame.json`, JSON.stringify(report, null, 2))
  console.log(`${report.length} independent first-frame captures passed styling, query and motion checks`)
} finally { await browser.close() }
