import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { launch, home, connectionState, profiles, recorder, sampler, output, versions, featurePattern } from './search-support.mjs'

const options = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')))
const selectedVersions = versions.filter(([v]) => !options.has('version') || options.get('version') === v)
if (options.has('reverse')) selectedVersions.reverse()
const selected = profiles.filter(p => !options.has('profile') || p.name === options.get('profile'))
assert.ok(selectedVersions.length && selected.length, 'Select a known version and profile')
const scenarios = (options.get('scenario') || 'direct,input').split(',')
const runs = Number(options.get('runs') || 3)
const label = options.get('output') || 'acceptance'
assert.match(label, /^[a-z0-9-]+$/i)
assert.ok(scenarios.every(s => ['direct', 'input', 'intent'].includes(s)))
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const expected = {}
try {
  const { createSearchEntries } = await server.ssrLoadModule('/src/data/searchIndex.ts')
  const { searchSite } = await server.ssrLoadModule('/src/lib/search.ts')
  for (const query of ['', 'React']) expected[query] = searchSite(createSearchEntries('/'), query).slice(0, 8).map(({ title, href }) => ({ title, href }))
} finally { await server.close() }
const browser = await launch()
const samples = []
try {
  await mkdir(output, { recursive: true })
  // Interleave versions within a condition; never run browsers/builds concurrently.
  for (const profile of selected) for (const scenario of scenarios) for (let run = 1; run <= runs; run++) for (const [version, base] of selectedVersions) {
    const { name, cpu, mbps, latency, ...device } = profile
    const context = await browser.newContext(device)
    await context.addInitScript(connectionState, { effectiveType: '4g', downlink: mbps, rtt: latency, saveData: false })
    await context.addInitScript(sampler)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Performance.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    await cdp.send('Network.emulateNetworkConditionsByRule', { offline: false, matchedNetworkConditions: [{ urlPattern: '', latency,
      downloadThroughput: mbps * 1e6 / 8, uploadThroughput: 750000 / 8 }] })
    const network = recorder(cdp)
    try {
      for (const cache of ['cold', 'warm']) {
        network.reset(); network.phase('startup')
        // Same readiness gate for cold and warm; warm is a normal HTTP-cache revisit.
        await home(page, base)
        await page.waitForTimeout(500)
        const startupReady = await page.evaluate(() => performance.now())
        const metricNames = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount']
        const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics
          .filter(m => metricNames.includes(m.name)).map(m => [m.name, m.value * (m.name.endsWith('Duration') ? 1000 : 1)]))
        const startup = { ...await page.evaluate(() => window.__searchStartup()), ...await metrics() }
        assert.equal(network.read().some(r => featurePattern.test(r.path)), false, 'No search intent before the measured action')
        if (scenario === 'intent') {
          network.phase('intent')
          await page.locator('.nav-search-button').focus()
          await page.waitForTimeout(300)
        }
        const open = async phase => {
          network.phase(phase)
          const before = await metrics()
          const query = scenario === 'input' ? 'React' : ''
          await page.evaluate(args => window.__measureSearch(args), { method: scenario === 'intent' ? 'click' : 'shortcut', query, expected: expected[query] })
          await page.waitForFunction(() => window.__searchSample.settled !== null && window.__searchSample.actionable !== null)
          await page.waitForTimeout(100)
          const result = await page.evaluate(() => window.__readSearch())
          result.mainThread = Object.fromEntries(Object.entries(await metrics()).map(([key, value]) => [key, value - before[key]]))
          assert.equal(result.sameInput, true)
          assert.equal(result.firstFrame.display, 'grid', 'The first result frame must already be styled')
          assert.equal(await page.locator('.site-search-input').inputValue(), query)
          if (version === 'candidate') assert.equal(result.results, query ? result.inputEcho : result.feedback,
            'The matching results share the first visible feedback or query echo frame')
          return result
        }
        const first = await open('first')
        await page.keyboard.press('Escape'); await page.locator('.site-search-backdrop').waitFor({ state: 'detached' })
        await page.waitForTimeout(300)
        const reopened = await open('reopen')
        const sample = { version, profile: name, scenario, run, cache, startupReady, startup, first, reopened, network: network.read() }
        samples.push(sample)
        assert.deepEqual(errors, [])
        console.log(JSON.stringify({ version, profile: name, scenario, run, cache,
          feedback: first.feedback, inputEcho: first.inputEcho, results: first.results, actionable: first.actionable, settled: first.settled }))
        await writeFile(`${output}/${label}.json`, JSON.stringify({ methodVersion: 3, browser: browser.version(), runs,
          order: selectedVersions.map(([name]) => name), samples }, null, 2))
      }
    } finally { await context.close() }
  }
} finally { await browser.close() }
