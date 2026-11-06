import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { preview } from 'vite'
import { launch, recorder } from './search-support.mjs'
import { connectionState } from './page-resources.browser.mjs'
import { projectIntroductions } from '../src/data/project-introductions.ts'

const output = 'node_modules/.cache/project-media'
const runs = Number(process.argv.find(arg => arg.startsWith('--runs='))?.split('=')[1] || 3)
const label = process.argv.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'final'
const manifest = JSON.parse(await readFile('src/generated/responsive-images.json', 'utf8'))
const servers = []
const samples = []
const browser = await launch()
const versions = [['baseline', `${output}/baseline`, 4197], ['candidate', 'dist', 4196]]
const profiles = [
  { name: 'desktop-weak', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1 },
  { name: 'mobile-weak', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4 },
]
const figureSection = projectIntroductions['few-shot-learning'].sections.find(section => section.figures?.length)
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
try {
  await mkdir(output, { recursive: true })
  for (const [, outDir, port] of versions) servers.push(await preview({ configFile: false, build: { outDir }, preview: { host: '127.0.0.1', port, strictPort: true } }))
  for (const profile of profiles) for (const scenario of ['cover', 'figure', ...(profile.cpu === 1 ? ['preview'] : [])]) {
    for (let run = 1; run <= runs; run++) for (const [version, , port] of (run % 2 ? versions : [...versions].reverse())) {
      const { cpu, name, ...settings } = profile
      const context = await browser.newContext({ ...settings, serviceWorkers: 'block', reducedMotion: 'no-preference' })
      await context.addInitScript(connectionState, { effectiveType: '4g', downlink: 1.6, rtt: 150, saveData: false })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: .75e6 / 8 })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
      const network = recorder(cdp)
      const route = scenario === 'preview' ? 'projects/' : `projects/few-shot-learning/${scenario === 'figure' ? `#project-${figureSection.id}` : ''}`
      await page.goto(`http://127.0.0.1:${port}/${route}`, { waitUntil: 'domcontentloaded' })
      const selector = scenario === 'preview' ? '.archive-preview-image[data-active="true"]' : scenario === 'cover' ? '.project-reader-cover img' : '.project-introduction-figure img'
      let started = 0
      if (scenario === 'preview') {
        await page.locator('.page-load-feedback').waitFor({ state: 'detached' })
        await page.locator('#few-shot-learning .archive-project-link').scrollIntoViewIfNeeded()
        network.phase('interaction')
        started = await page.evaluate(() => performance.now())
        await page.locator('#few-shot-learning .archive-project-link').hover()
      } else if (scenario === 'figure') {
        await page.locator(selector).first().scrollIntoViewIfNeeded()
      }
      await page.waitForFunction(selector => {
        const img = document.querySelector(selector)
        return img?.complete && img.naturalWidth > 0 && img.getBoundingClientRect().bottom > 0 && img.getBoundingClientRect().top < innerHeight
      }, selector)
      const image = await page.locator(selector).first().evaluate(async img => {
        await img.decode()
        await new Promise(requestAnimationFrame)
        const rect = img.getBoundingClientRect()
        return { ready: performance.now(), src: new URL(img.src).pathname.slice(1), selected: new URL(img.currentSrc).pathname.slice(1), width: rect.width, height: rect.height, naturalWidth: img.naturalWidth }
      })
      await page.waitForTimeout(300)
      const requests = network.read().filter(r => /\/images\/(projects|responsive)\//.test(r.path))
      assert.deepEqual(errors, [])
      assert.ok(!requests.some(r => r.failed || r.status >= 400))
      const imageRequests = requests.filter(r => r.path === `/${image.selected}`)
      assert.equal(imageRequests.length, 1, 'The display candidate is requested only once')
      assert.ok(imageRequests[0].done)
      if (version === 'candidate') {
        const entry = manifest[image.src]
        const chosen = entry.variants.find(v => v.file === image.selected)?.width ?? entry.width
        assert.ok(chosen >= Math.min(entry.width, image.width * profile.deviceScaleFactor) * .97, 'Display pixels cover the rendered density')
        if (image.selected !== image.src) assert.ok(!requests.some(r => r.path === `/${image.src}`), 'Preload and intent must not also download the original')
      }
      samples.push({ version, profile: name, scenario, run, ready: image.ready - started, image, bytes: imageRequests[0].bytes, requests })
      console.log(`${version} ${name} ${scenario} #${run}: ${Math.round(image.ready - started)} ms, ${imageRequests[0].bytes} bytes`)
      if (run === 1) await page.locator(scenario === 'preview' ? '.archive-preview' : scenario === 'cover' ? '.project-reader-cover' : '.project-introduction-figure').first()
        .screenshot({ path: `${output}/${version}-${name}-${scenario}.png`, animations: 'disabled' })
      await context.close()
      await writeFile(`${output}/${label}.json`, JSON.stringify({ browser: browser.version(), samples }, null, 2))
    }
  }
  const summary = []
  for (const profile of profiles) for (const scenario of ['cover', 'figure', 'preview']) {
    const rows = versions.map(([version]) => samples.filter(s => s.version === version && s.profile === profile.name && s.scenario === scenario))
    if (!rows[0].length) continue
    summary.push({ profile: profile.name, scenario, ready: rows.map(row => Math.round(median(row.map(s => s.ready)))), bytes: rows.map(row => Math.round(median(row.map(s => s.bytes)))) })
  }
  console.log(JSON.stringify(summary, null, 2))
} finally {
  await browser.close()
  for (const server of servers) await new Promise(resolve => server.httpServer.close(resolve))
}
