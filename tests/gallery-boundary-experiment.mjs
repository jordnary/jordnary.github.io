import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { preview } from 'vite'
import { launch, recorder } from './search-support.mjs'
import { connectionState, contentReady } from './page-resources.browser.mjs'

// An isolated, disposable download boundary. Never shipped to production.
// Compare real controls/image availability, not the Suspense loading surface.
const output = 'node_modules/.cache/gallery-boundary'
const root = process.cwd()
const clean = text => text.replaceAll(root, '<workspace>').replaceAll(root.replaceAll('\\', '/'), '<workspace>')
  .replaceAll(os.homedir(), '<user>').replaceAll(os.homedir().replaceAll('\\', '/'), '<user>')
await mkdir(output, { recursive: true })
if (!process.argv.includes('--skip-build')) {
  const source = path.resolve(output, 'source-split')
  await mkdir(source, { recursive: true })
  for (const item of ['src', 'public', 'scripts', 'home', 'about', 'learning', 'projects', 'contact', 'index.html', 'vite.config.ts', 'package.json']) {
    await cp(item, path.join(source, item), { recursive: true })
  }
  const entry = path.join(source, 'src/components/image-gallery/index.ts')
  await writeFile(entry, (await readFile(entry, 'utf8')).replace("from './ImageGallery'", "from './DownloadExperiment'"))
  await writeFile(path.join(source, 'src/components/image-gallery/DownloadExperiment.tsx'), `
import { lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import type { ImageGalleryProps } from './types'
const Gallery = lazy(() => import('./ImageGallery').then(module => ({ default: module.ImageGallery })))
export function ImageGallery(props: ImageGalleryProps) {
  if (props.activeIndex === null) return null
  return <Suspense fallback={createPortal(<div role="dialog" aria-label="图片浏览器" style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#171717', color: 'white' }}>
    <button onClick={props.onClose}>关闭图片预览</button><p role="status">正在加载图集…</p>
  </div>, document.body)}><Gallery {...props} /></Suspense>
}
`)
  const result = spawnSync(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', path.resolve(output, 'split'), '--manifest'], { cwd: source, encoding: 'utf8', windowsHide: true })
  await writeFile(`${output}/build.log`, clean((result.stdout || '') + (result.stderr || '')))
  assert.equal(result.status, 0, 'Split experiment must build; inspect the sanitized log')
  await cp('dist', `${output}/direct`, { recursive: true })
}
const runs = Number(process.argv.find(arg => arg.startsWith('--runs='))?.split('=')[1] || 1)
const servers = []
const samples = []
const browser = await launch()
const versions = [['direct', 4198], ['split', 4199]]
try {
  for (const [name, port] of versions) servers.push(await preview({ configFile: false, build: { outDir: `${output}/${name}` }, preview: { host: '127.0.0.1', port, strictPort: true } }))
  for (const mobile of [false, true]) for (const method of ['keyboard', 'pointer']) for (let run = 1; run <= runs; run++) {
    for (const [version, port] of (run % 2 ? versions : [...versions].reverse())) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' })
      await context.addInitScript(connectionState, { effectiveType: '4g', downlink: 1.6, rtt: 150, saveData: false })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: .75e6 / 8 })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: mobile ? 4 : 1 })
      const network = recorder(cdp)
      await page.goto(`http://127.0.0.1:${port}/projects/vae-gan-digits/`, { waitUntil: 'domcontentloaded' })
      await contentReady(page, '.project-reader')
      const trigger = page.locator('.project-reader-cover button')
      await trigger.scrollIntoViewIfNeeded()
      if (method === 'keyboard') await trigger.focus()
      const startup = await page.evaluate(() => performance.now())
      network.phase('open')
      await page.evaluate(() => {
        window.__galleryProbe = { start: performance.now(), controls: null, original: null }
        const tick = () => {
          const probe = window.__galleryProbe
          const container = document.querySelector('.yarl__container')
          const original = document.querySelector('.yarl__slide_current .gallery-original')
          if (container && document.querySelector('.yarl__toolbar button[aria-label="放大图片"]') && getComputedStyle(container).opacity !== '0') probe.controls ??= performance.now() - probe.start
          if (original?.complete && original.naturalWidth > 0) probe.original ??= performance.now() - probe.start
          if (probe.controls === null || probe.original === null) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      if (method === 'keyboard') await page.keyboard.press('Enter')
      else await trigger.click()
      await page.waitForFunction(() => window.__galleryProbe.controls !== null && window.__galleryProbe.original !== null)
      const result = await page.evaluate(() => window.__galleryProbe)
      await page.waitForTimeout(300)
      const requests = network.read()
      assert.deepEqual(errors, [])
      assert.ok(!requests.some(r => r.failed || r.status >= 400))
      const bytes = phase => requests.filter(r => r.phase === phase && ['Script', 'Stylesheet'].includes(r.type)).reduce((sum, r) => sum + r.bytes, 0)
      const sample = { version, mobile, method, run, startup, controls: result.controls, original: result.original, startupCodeBytes: bytes('startup'), openCodeBytes: bytes('open'), requests }
      samples.push(sample)
      console.log(JSON.stringify({ ...sample, requests: undefined }))
      await page.keyboard.press('Escape')
      await page.locator('.yarl__root').waitFor({ state: 'detached' })
      await context.close()
      await writeFile(`${output}/results.json`, JSON.stringify({ browser: browser.version(), samples }, null, 2))
    }
  }
} finally {
  await browser.close()
  for (const server of servers) await new Promise(resolve => server.httpServer.close(resolve))
}
