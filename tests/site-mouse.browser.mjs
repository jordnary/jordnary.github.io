import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

export async function runSiteMouseChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const checkDefaults = () => page.evaluate(() => {
    const container = document.createElement('div')
    const input = document.createElement('textarea')
    container.append(input)
    document.body.append(container)
    // A widget that stops bubbling must still receive the global scroll policy.
    container.addEventListener('mousedown', event => event.stopPropagation())
    const prevented = (type, button) => {
      const event = new MouseEvent(type, { button, bubbles: true, cancelable: true })
      input.dispatchEvent(event)
      return event.defaultPrevented
    }
    const state = {
      down: [0, 1, 2, 3, 4].map(button => prevented('mousedown', button)),
      auxclick: prevented('auxclick', 1),
      contextmenu: prevented('contextmenu', 2),
    }
    container.remove()
    return state
  })
  const expectedDefaults = { down: [false, true, false, false, false], auxclick: false, contextmenu: false }
  try {
    const routes = ['', 'home/', 'about/', 'learning/', 'projects/', 'contact/']
    for (const route of routes) {
      await page.goto(new URL(route, baseURL).href)
      await page.locator('.app-shell').waitFor()
      assert.deepEqual(await checkDefaults(), expectedDefaults, `Mouse defaults on ${route || '/'}`)
      if (route === 'projects/') {
        const detail = await page.locator('a[href*="/projects/"]').evaluateAll(links => links.map(link => new URL(link.href).pathname).find(path => /\/projects\/[^/]+\/$/.test(path)))
        assert.ok(detail, 'A project detail route is available')
        routes.push(detail)
      }
      pass(`Middle mousedown is cancelled on ${route || '/'} including nested controls; other mouse defaults remain available`)
    }

    await page.goto(new URL('learning/', baseURL).href)
    await page.locator('#skills .learning-panel-diagram').first().hover()
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      window.__middleDown = null
      document.addEventListener('mousedown', event => {
        if (event.button === 1) window.__middleDown = { trusted: event.isTrusted, prevented: event.defaultPrevented }
      }, { once: true })
    })
    const before = await page.evaluate(() => scrollY)
    await page.mouse.down({ button: 'middle' })
    assert.deepEqual(await page.evaluate(() => window.__middleDown), { trusted: true, prevented: true }, 'Native middle input is cancelled')
    await page.mouse.move(700, 740, { steps: 12 })
    await page.waitForTimeout(350)
    assert.equal(await page.evaluate(() => scrollY), before, 'Moving the held middle button does not scroll the document')
    await page.mouse.up({ button: 'middle' })
    await page.mouse.wheel(0, 240)
    await page.waitForFunction(top => scrollY > top, before)
    pass('Native middle input cannot start autoscroll while normal wheel scrolling still works')

    const link = page.locator('.nav-link').filter({ hasText: '关于' })
    const opened = context.waitForEvent('page')
    await link.click({ button: 'middle' })
    const newPage = await opened
    await newPage.waitForURL(new URL('about/', baseURL).href)
    await newPage.close()
    pass('Middle-clicking a navigation link still opens the destination in a new tab')

    await link.click()
    await page.waitForFunction(() => document.body.dataset.page === 'about')
    assert.deepEqual(await checkDefaults(), expectedDefaults, 'Client navigation preserves middle-button suppression')
    assert.deepEqual(errors, [])
    pass('Client navigation preserves the global mouse policy without browser errors')
  } finally {
    await context.close()
  }
  return checks
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.LEARNING_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runSiteMouseChecks(browser, process.env.LEARNING_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} site mouse checks passed`)
  } catch (error) {
    console.error('Site mouse browser checks failed:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
