import { mkdir, writeFile } from 'node:fs/promises'
import { launch, home, connectionState, profiles, output, versions } from './search-support.mjs'

// Diagnostic ablations only; altered/disabled behavior is never an acceptance candidate.
const cases = {
  unchanged: '',
  'without-blur': '.app-shell.is-search-open .app-shell-content { filter:none !important }',
  'without-scroll-lock': 'body:has(.is-search-open) #site-scroll { overflow-y:auto !important }',
  'without-shortcuts': '.site-search-shortcuts { display:none !important }',
  'without-results': '.site-search-results { display:none !important }',
}
const browser = await launch()
const { cpu, mbps, latency, name: _, ...device } = profiles.find(p => p.name === 'mobile-weak')
const samples = []
try {
  await mkdir(output, { recursive: true })
  for (let run = 1; run <= 3; run++) for (const [variant, css] of Object.entries(cases).filter(([name]) => !process.argv[2] || process.argv[2].split(',').includes(name))) {
    const context = await browser.newContext(device)
    await context.addInitScript(connectionState, { effectiveType: '4g', downlink: mbps, rtt: latency, saveData: false })
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable'); await cdp.send('Performance.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    await cdp.send('Network.emulateNetworkConditionsByRule', { offline: false, matchedNetworkConditions: [{ urlPattern: '', latency,
      downloadThroughput: mbps * 1e6 / 8, uploadThroughput: 750000 / 8 }] })
    try {
      await home(page, versions[0][1])
      if (css) await page.addStyleTag({ content: css })
      await page.waitForTimeout(500)
      const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]))
      const result = await page.evaluate(() => new Promise(resolve => {
        const focus = HTMLElement.prototype.focus
        const start = performance.now()
        let focusMs = 0
        HTMLElement.prototype.focus = function (...args) {
          const at = performance.now(); focus.apply(this, args); focusMs += performance.now() - at
        }
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }))
        const tick = () => {
          if (!document.querySelector('.site-search-input')) return requestAnimationFrame(tick)
          resolve({ focusMs, frame: performance.now() - start })
        }
        requestAnimationFrame(tick)
      }))
      const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]))
      const sample = { variant, run, ...result, ...Object.fromEntries(['LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'LayoutCount']
        .map(key => [key, (after[key] - before[key]) * (key.endsWith('Duration') ? 1000 : 1)])) }
      samples.push(sample); console.log(JSON.stringify(sample))
    } finally { await context.close() }
  }
  await writeFile(`${output}/layout-ablation.json`, JSON.stringify(samples, null, 2))
} finally { await browser.close() }
