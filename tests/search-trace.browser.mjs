import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { launch, home, connectionState, profiles, output, versions } from './search-support.mjs'

// Attribution only: instrumentation/profiling is never included in acceptance timings.
const browser = await launch()
const profile = profiles.find(p => p.name === 'mobile-weak')
const { cpu, mbps, latency, name: _, ...device } = profile
const selected = process.argv[2]
try {
  await mkdir(output, { recursive: true })
  for (const [version, base] of versions.filter(([v]) => !selected || selected === v)) {
    const context = await browser.newContext(device)
    await context.addInitScript(connectionState, { effectiveType: '4g', downlink: mbps, rtt: latency, saveData: false })
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    await cdp.send('Network.emulateNetworkConditionsByRule', { offline: false, matchedNetworkConditions: [{ urlPattern: '', latency,
      downloadThroughput: mbps * 1e6 / 8, uploadThroughput: 750000 / 8 }] })
    try {
      await home(page, base); await page.waitForTimeout(500)
      await page.evaluate(() => {
        window.__focusCosts = []
        const focus = HTMLElement.prototype.focus
        HTMLElement.prototype.focus = function (...args) {
          const start = performance.now()
          performance.mark('search-focus-start')
          focus.apply(this, args)
          performance.mark('search-focus-end')
          window.__focusCosts.push({ target: this.className, start, ms: performance.now() - start })
        }
      })
      const events = []
      cdp.on('Tracing.dataCollected', e => events.push(...e.value))
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,v8.execute,toplevel,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' })
      await cdp.send('Profiler.enable'); await cdp.send('Profiler.start')
      await page.evaluate(() => {
        performance.mark('search-open')
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }))
      })
      await page.locator('.site-search-input').waitFor()
      await page.waitForTimeout(400)
      const cpuProfile = (await cdp.send('Profiler.stop')).profile
      const ended = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve))
      await cdp.send('Tracing.end'); await ended
      const mark = events.find(e => e.name === 'search-open')
      assert.ok(mark)
      const main = events.filter(e => e.pid === mark.pid && e.tid === mark.tid && e.ts + (e.dur || 0) >= mark.ts)
      const summary = ['RunTask', 'FunctionCall', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize'].map(name => {
        const entries = main.filter(e => e.name === name && e.dur)
        return { name, count: entries.length, ms: entries.reduce((s, e) => s + e.dur / 1000, 0), max: Math.max(0, ...entries.map(e => e.dur / 1000)) }
      })
      const layouts = main.filter(e => ['UpdateLayoutTree', 'Layout', 'Paint'].includes(e.name)).map(e => ({
        name: e.name, start: (e.ts - mark.ts) / 1000, ms: (e.dur || 0) / 1000,
        elements: e.args?.elementCount, dirty: e.args?.beginData?.dirtyObjects, total: e.args?.beginData?.totalObjects,
      }))
      const counts = new Map()
      cpuProfile.samples?.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + cpuProfile.timeDeltas[i] / 1000))
      for (const node of cpuProfile.nodes) node.callFrame.url = node.callFrame.url.startsWith('http') ? new URL(node.callFrame.url).pathname : ''
      const functions = cpuProfile.nodes.map(n => ({ id: n.id, ...n.callFrame, ms: counts.get(n.id) || 0 })).sort((a, b) => b.ms - a.ms).slice(0, 25)
      const focus = await page.evaluate(() => window.__focusCosts)
      const report = { version, browser: browser.version(), summary, layouts, focus, functions, cpuProfile }
      await writeFile(`${output}/trace-${version}.json`, JSON.stringify(report, null, 2))
      console.log(JSON.stringify({ version, summary, focus, functions: functions.slice(0, 10) }))
    } finally { await context.close() }
  }
} finally { await browser.close() }
