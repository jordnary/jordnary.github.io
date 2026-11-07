import { mkdir, writeFile } from 'node:fs/promises'
import { connectionState } from './page-resources.browser.mjs'

const { chromium } = await import('playwright')
const forcedType = process.argv.find(arg => arg.startsWith('--ect='))?.split('=')[1]
const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL, headless: true,
  args: forcedType ? [`--force-effective-connection-type=${forcedType}`] : [] })
const output = 'node_modules/.cache/inpage-images'
await mkdir(output, { recursive: true })
const reports = []
try {
  for (const weak of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
    await context.addInitScript(() => { window.__nativeConnection = { type: navigator.connection?.effectiveType, rtt: navigator.connection?.rtt, downlink: navigator.connection?.downlink } })
    await context.addInitScript(connectionState, { effectiveType: '4g', downlink: weak ? 1.6 : 10, rtt: weak ? 150 : 20 })
    await context.addInitScript(() => {
      window.__imagePositions = []
      let previous = ''
      const sample = () => {
        const images = [...document.querySelectorAll('.home-gallery img')].map(image => {
          const rect = image.getBoundingClientRect()
          return { path: new URL(image.currentSrc || image.src || location.href).pathname,
            top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width),
            complete: image.complete && image.naturalWidth > 0 }
        })
        const key = JSON.stringify(images)
        if (key !== previous) { window.__imagePositions.push({ ms: performance.now(), images }); previous = key }
        if (performance.now() < 5000) requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    if (weak) await cdp.send('Network.emulateNetworkConditionsByRule', { offline: false, matchedNetworkConditions: [{ urlPattern: '', latency: 150,
      downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 }] })
    const requests = []
    cdp.on('Network.requestWillBeSent', event => {
      if (event.type === 'Image') requests.push({ path: new URL(event.request.url).pathname, time: event.timestamp,
        priority: event.request.initialPriority, initiator: event.initiator.type })
    })
    await page.goto(new URL('home/', process.env.RESOURCE_BASELINE_URL || 'http://127.0.0.1:4175/').href, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(5200)
    const report = await page.evaluate(() => ({ nativeConnection: window.__nativeConnection, positions: window.__imagePositions,
      resources: performance.getEntriesByType('resource').filter(item => item.name.includes('/images/')).map(item => ({
        path: new URL(item.name).pathname, start: item.startTime, end: item.responseEnd, bytes: item.encodedBodySize })) }))
    reports.push({ weak, requests, ...report })
    console.log(JSON.stringify({ weak, nativeConnection: report.nativeConnection, resources: report.resources }))
    await context.close()
  }
  await writeFile(`${output}/trace-${forcedType || 'default'}.json`, JSON.stringify({ browser: browser.version(), forcedType, reports }, null, 2))
} finally { await browser.close() }
