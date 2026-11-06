import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { launch, home, profiles, connectionState, recorder, output, featurePattern, baseURL } from './search-support.mjs'

const browser = await launch()
const samples = []
try {
  await mkdir(output, { recursive: true })
  for (const [version, base] of [['baseline', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4185/'], ['candidate', baseURL]]) {
    for (const profile of profiles) for (let run = 1; run <= 3; run++) {
      const { name, cpu, mbps, latency, ...device } = profile
      const context = await browser.newContext(device)
      await context.addInitScript(connectionState, { effectiveType: '4g', downlink: mbps, rtt: latency, saveData: false })
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
      await cdp.send('Network.emulateNetworkConditionsByRule', { offline: false, matchedNetworkConditions: [{ urlPattern: '', latency,
        downloadThroughput: mbps * 1e6 / 8, uploadThroughput: 750000 / 8 }] })
      const network = recorder(cdp)
      try {
        await home(page, base); await page.waitForTimeout(500)
        network.reset(); network.phase('unconsumed-intent')
        await page.locator('.nav-search-button').focus()
        await page.waitForTimeout(300)
        await page.locator('.nav-search-button').evaluate(el => el.blur())
        await page.waitForTimeout(2000)
        const requests = network.read()
        assert.equal(await page.locator('.site-search-backdrop').count(), 0)
        assert.equal(requests.some(r => r.failed), false)
        const feature = requests.filter(r => featurePattern.test(r.path))
        if (version === 'candidate' && name === 'desktop-network') assert.equal(feature.length, 2)
        else assert.equal(feature.length, 0)
        samples.push({ version, profile: name, run, requests })
      } finally { await context.close() }
    }
  }
  await writeFile(`${output}/prefetch.json`, JSON.stringify({ browser: browser.version(), samples }, null, 2))
  console.log(`${samples.length} unconsumed intent samples completed`)
} finally { await browser.close() }
