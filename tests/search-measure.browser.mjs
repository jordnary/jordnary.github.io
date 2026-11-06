import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { launch, home, connectionState, profiles, recorder, sampler, output } from './search-support.mjs'

const options = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')))
const versions = [ ['baseline', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4185/'],
  ['candidate', process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4184/'] ].filter(([v]) => !options.has('version') || options.get('version') === v)
const selected = profiles.filter(p => !options.has('profile') || p.name === options.get('profile'))
const scenarios = (options.get('scenario') || 'direct,intent').split(',')
const runs = Number(options.get('runs') || 3)
const label = options.get('output') || 'acceptance'
assert.match(label, /^[a-z0-9-]+$/i)
const browser = await launch()
const samples = []
try {
  await mkdir(output, { recursive: true })
  for (const [version, base] of versions) for (const profile of selected) for (const scenario of scenarios) for (let run = 1; run <= runs; run++) {
    const { name, cpu, mbps, latency, ...device } = profile
    const context = await browser.newContext(device)
    await context.addInitScript(connectionState, { effectiveType: '4g', downlink: mbps, rtt: latency, saveData: false })
    await context.addInitScript(sampler)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    await cdp.send('Network.emulateNetworkConditionsByRule', { offline: false, matchedNetworkConditions: [{ urlPattern: '', latency,
      downloadThroughput: mbps * 1e6 / 8, uploadThroughput: 750000 / 8 }] })
    const network = recorder(cdp)
    try {
      for (const cache of ['cold', 'warm']) {
        network.reset(); network.phase('startup')
        if (cache === 'cold') await home(page, base)
        else { await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.home-editorial').waitFor(); await page.evaluate(() => document.fonts.ready) }
        await page.waitForTimeout(500)
        const mounted = await page.evaluate(() => performance.now())
        if (scenario === 'intent') {
          network.phase('intent')
          await page.locator('.nav-search-button').focus()
          await page.waitForTimeout(300)
        }
        const open = async phase => {
          network.phase(phase)
          await page.evaluate(scenario => window.__measureSearch(scenario === 'intent' ? 'click' : 'shortcut'), scenario)
          await page.waitForFunction(() => window.__searchSample.settled !== null)
          await page.waitForTimeout(300)
          return page.evaluate(() => window.__readSearch())
        }
        const first = await open('first')
        await page.keyboard.press('Escape'); await page.waitForTimeout(300)
        const reopened = await open('reopen')
        const sample = { version, profile: name, scenario, run, cache, mounted, first, reopened, network: network.read() }
        samples.push(sample)
        assert.deepEqual(errors, [])
        console.log(JSON.stringify({ version, profile: name, scenario, run, cache, first, reopened }))
        await writeFile(`${output}/${label}.json`, JSON.stringify({ methodVersion: 1, browser: browser.version(), runs, samples }, null, 2))
      }
    } finally { await context.close() }
  }
} finally { await browser.close() }
