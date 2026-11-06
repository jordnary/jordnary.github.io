import assert from 'node:assert/strict'
import { build, createServer, preview } from 'vite'
import { launch, output } from './search-support.mjs'

// Both the build projection and Vite's development virtual module honor a non-root base.
const base = '/preview/'
const browser = await launch()
try {
  for (const kind of ['development', 'production']) {
    // Run development before build establishes production process defaults.
    if (kind === 'production') await build({ base, logLevel: 'silent', build: { outDir: `${output}/prefixed`, emptyOutDir: true } })
    const server = kind === 'development'
      ? await createServer({ base, logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } })
      : await preview({ base, logLevel: 'silent', build: { outDir: `${output}/prefixed` }, preview: { host: '127.0.0.1', port: 0 } })
    if (kind === 'development') await server.listen()
    const address = server.httpServer.address()
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = []
    const failures = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { if (response.status() >= 400) failures.push({ path: new URL(response.url()).pathname, status: response.status() }) })
    try {
      await page.goto(`http://127.0.0.1:${address.port}${base}home/`)
      await page.locator('.home-editorial').waitFor()
      await page.keyboard.press('Control+k')
      await page.locator('.site-search-result').first().waitFor()
      await page.locator('.site-search-input').fill('React')
      const links = await page.locator('.site-search-result').evaluateAll(items => items.map(a => ({
        href: new URL(a.href).pathname, display: getComputedStyle(a).display,
      })))
      assert.ok(links.length > 0 && links.every(link => link.href.startsWith(base) && link.display === 'grid'))
      assert.deepEqual(errors, [])
      console.log(`PASS: ${kind} search uses the prefixed index and loaded result styles`)
    } catch (error) {
      console.log(JSON.stringify({ kind, errors, failures, feedback: await page.locator('.site-startup,.page-load-feedback').allTextContents() }))
      throw error
    } finally {
      await context.close()
      if (kind === 'development') await server.close()
      else await new Promise(resolve => server.httpServer.close(resolve))
    }
  }
} finally { await browser.close() }
