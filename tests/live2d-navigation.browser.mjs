import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { preview } from 'vite'
import { chromium } from 'playwright'

const server = await preview({ logLevel: 'silent', build: { outDir: 'node_modules/.cache/production-preview' },
  preview: { host: '127.0.0.1', port: 0 } })
const origin = `http://127.0.0.1:${server.httpServer.address().port}`
const missing = '/missing/nested/document.html?from=companion'
const output = 'node_modules/.cache/live2d-navigation'
const clickLink = (page, href) => page.locator('main').evaluate((main, href) => {
  const link = document.createElement('a')
  link.href = href; link.textContent = 'Navigation check'
  main.append(link); link.click(); link.remove()
}, href)
async function ready(page, name) {
  await page.locator(`body[data-page="${name}"] main > *`).waitFor()
  if (name === '404') {
    await page.locator('.not-found-digits[viewBox]').waitFor()
    const bounds = await page.locator('.not-found').boundingBox()
    assert.equal(bounds.y, 0, 'The 404 stage stays aligned after shared navigation')
    assert.equal(await page.title(), '404 | Page not found')
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow')
    assert.equal(await page.locator('link[rel="canonical"], #site-footer, nav [aria-current="page"]').count(), 0)
  } else {
    assert.equal(await page.locator('meta[name="robots"]').count(), 0)
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `${origin}/${name}/`)
    assert.equal(await page.locator('.not-found-cursor, .not-found').count(), 0)
  }
  assert.equal(await page.locator('.app-shell').count(), 1)
  assert.equal(await page.locator('.live2d-companion').count(), 1)
}

let browser
try {
  await mkdir(output, { recursive: true })
  browser = await chromium.launch({ channel: process.env.COMPANION_BROWSER_CHANNEL || process.env.BROWSER_CHANNEL })
  for (const mobile of [false, true]) {
    const name = mobile ? 'mobile' : 'desktop'
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = [], documents = [], assets = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url())
      if (/\/live2d\/.*(?:model3\.json|\.moc3|texture_.*\.webp)$/.test(request.url())) assets.push(request.url())
    })
    try {
      assert.equal((await page.goto(origin + missing)).status(), 404)
      await ready(page, '404')
      const navBounds = await page.locator('.nav-content').boundingBox()
      const launcher = await page.locator('.live2d-launcher').elementHandle()
      // Collapsed visits stay lightweight and keep the same launcher in both directions.
      await clickLink(page, '/contact/')
      await ready(page, 'contact')
      assert.deepEqual(await page.locator('.nav-content').boundingBox(), navBounds,
        'The 404 and contact pages align their navigation')
      await page.goBack()
      await ready(page, '404')
      assert.equal(page.url(), origin + missing)
      assert.ok(await launcher.evaluate(node => node === document.querySelector('.live2d-launcher')))
      assert.equal(assets.length, 0)
      assert.equal(documents.length, 1)

      await page.getByRole('button', { name: '展开看板娘', exact: true }).click()
      await page.locator('.live2d-companion canvas.is-ready').waitFor({ timeout: 45000 })
      const canvas = await page.locator('.live2d-companion canvas').elementHandle()
      const assetCount = assets.length
      assert.ok(assetCount >= 3, 'The real model, geometry and texture were loaded')
      if (!mobile) {
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        const cursor = page.locator('.not-found-cursor[data-active="true"]')
        await page.mouse.move(320, 340)
        await cursor.waitFor()
        await page.locator('.nav-content .nav-brand').hover()
        await cursor.waitFor({ state: 'hidden' })
        await page.mouse.move(320, 340)
        await cursor.waitFor()
        const model = await page.locator('.live2d-canvas-wrap').boundingBox()
        await page.mouse.move(model.x + model.width / 2, model.y + model.height / 2)
        await cursor.waitFor({ state: 'hidden' })
        await page.mouse.move(model.x - 24, model.y + model.height / 2)
        await cursor.waitFor()
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await cursor.waitFor({ state: 'hidden' })
      }
      const shared = async () => {
        assert.ok(await canvas.evaluate(node => node.isConnected && node === document.querySelector('.live2d-companion canvas.is-ready')),
          'The original WebGL canvas survives page changes')
        assert.equal(assets.length, assetCount, 'Navigation does not fetch the model again')
        assert.equal(documents.length, 1, 'Navigation keeps the same document')
      }
      await page.screenshot({ path: `${output}/${name}-404.png`, animations: 'disabled' })
      await page.goForward()
      await ready(page, 'contact')
      await shared()
      await page.screenshot({ path: `${output}/${name}-contact.png`, animations: 'disabled' })
      await clickLink(page, '/about/')
      await ready(page, 'about')
      await clickLink(page, missing)
      await ready(page, '404')
      await shared()
      await page.goBack()
      await ready(page, 'about')
      await page.goForward()
      await ready(page, '404')
      await shared()

      // Search hides and pauses the same companion, then restores it after navigation.
      await page.locator('.nav-search-button').evaluate(button => button.click())
      await page.getByRole('dialog', { name: '站内搜索', exact: true }).waitFor()
      assert.ok(await page.locator('.live2d-companion').evaluate(node => node.hidden))
      await page.locator('.site-search-result[href^="/contact/"]').first().evaluate(link => link.click())
      await ready(page, 'contact')
      await page.locator('.site-search-backdrop').waitFor({ state: 'detached' })
      assert.ok(await page.locator('.live2d-companion').isVisible())
      await shared()

      await page.getByRole('button', { name: '关闭人物点击对话', exact: true, includeHidden: true }).evaluate(button => button.click())
      await clickLink(page, '/404.html')
      await ready(page, '404')
      assert.equal(await page.getByRole('button', { name: '开启人物点击对话', exact: true, includeHidden: true }).getAttribute('aria-pressed'), 'false')
      await shared()
      await page.getByRole('button', { name: '收起看板娘', exact: true, includeHidden: true }).evaluate(button => button.click())
      await clickLink(page, '/home/')
      await ready(page, 'home')
      await page.goBack()
      await ready(page, '404')
      assert.ok(await page.getByRole('button', { name: '展开看板娘', exact: true }).isVisible())
      assert.equal(await page.locator('.live2d-companion canvas').count(), 0)
      assert.equal(assets.length, assetCount)
      assert.equal(documents.length, 1)
      assert.deepEqual(errors, [])
      console.log(`PASS: ${name} shares the launcher, canvas, preferences, search lifecycle and history across 404 and regular pages`)
    } finally { await context.close() }
  }

  // A missing file can also be served with the 404 document on direct entry.
  const page = await browser.newPage()
  const file = origin + '/missing-file.pdf'
  assert.equal((await page.goto(file)).status(), 404)
  await ready(page, '404')
  await clickLink(page, '/contact/')
  await ready(page, 'contact')
  await page.goBack()
  await ready(page, '404')
  assert.equal(page.url(), file)
  assert.equal((await page.reload()).status(), 404)
  await ready(page, '404')
  console.log('PASS: direct missing-file entry and history preserve the 404 page and URL')
} finally {
  await browser?.close()
  await server.close()
}
