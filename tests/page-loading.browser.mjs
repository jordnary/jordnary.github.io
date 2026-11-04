import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const feedback = '.page-load-feedback'
const modulePattern = name => new RegExp(`/assets/${name}-[^/]+\\.js(?:\\?.*)?$`)
const cssPattern = name => new RegExp(`/assets/${name}-[^/]+\\.css(?:\\?.*)?$`)
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const clickLink = (page, href) => page.evaluate(href => {
  const link = document.createElement('a')
  link.href = href
  document.body.append(link)
  link.click()
  link.remove()
}, href)
const scrollTop = page => page.evaluate(() => matchMedia('(pointer: coarse)').matches
  ? document.querySelector('#site-scroll').scrollTop : scrollY)
const scrollTo = (page, top) => page.evaluate(top => {
  const target = matchMedia('(pointer: coarse)').matches ? document.querySelector('#site-scroll') : window
  target.scrollTo({ top, behavior: 'instant' })
}, top)

async function hold(page, pattern) {
  const held = []
  let released = false
  let signal
  const requested = new Promise(resolve => { signal = resolve })
  const handler = route => {
    signal()
    if (released) return route.continue()
    held.push(route)
  }
  await page.route(pattern, handler)
  return {
    requested,
    release: async () => {
      released = true
      await Promise.allSettled(held.splice(0).map(route => route.continue()))
    },
  }
}

export async function runStartupLayoutChecks(browser, baseURL) {
  for (const [path, name] of [['/home/', 'HomePage'], ['/learning/', 'LearningPage'], ['/contact/', 'ContactPage']]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
    try {
      await context.addInitScript(() => {
        window.__startupLayoutShift = 0
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__startupLayoutShift += entry.value
        }).observe({ type: 'layout-shift', buffered: true })
      })
      const page = await context.newPage()
      const gate = await hold(page, cssPattern(name))
      await page.goto(new URL(path, baseURL).href, { waitUntil: 'domcontentloaded' })
      await gate.requested
      await page.locator(`${feedback}[data-state="loading"]`).waitFor()
      await page.waitForTimeout(700)
      await gate.release()
      await page.locator(feedback).waitFor({ state: 'detached' })
      await page.waitForTimeout(250)
      assert.ok(await page.evaluate(() => window.__startupLayoutShift < 0.05), `${path} must not move visible footer content out of the startup viewport`)
    } finally { await context.close() }
  }
}

export async function runPageLoadingChecks(browser, baseURL, report = () => {}) {
  let passed = 0
  const pass = message => { passed++; report(message) }
  const url = path => new URL(path, baseURL).href
  const withPage = async (run, options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', ...options })
    const page = await context.newPage()
    await context.addInitScript(() => {
      window.__preloadFailures = 0
      window.addEventListener('vite:preloadError', () => window.__preloadFailures++)
    })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await run(page, context)
      assert.deepEqual(errors, [], 'Handled loading failures must not escape the application')
    } finally { await context.close() }
  }
  const openHome = async page => {
    await page.goto(url('/home/'), { waitUntil: 'domcontentloaded' })
    await page.locator('.home-editorial').waitFor()
  }
  const assertUnlocked = async page => {
    assert.equal(await page.locator('.project-page-transition').count(), 0)
    assert.equal(await page.locator('.app-shell').evaluate(node => node.inert), false)
    assert.equal(await page.locator('dialog:modal').count(), 0)
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden')
  }

  // Real production JS and CSS faults, including retry in a fresh document.
  for (const navigate of [false, true]) {
    for (const resource of ['js', 'css']) {
      for (const failure of ['delay', 'abort', '404']) {
        await withPage(async page => {
          if (navigate) await openHome(page)
          const pattern = resource === 'js' ? modulePattern('ContactPage') : cssPattern('ContactPage')
          let fail = true
          let gate
          if (failure === 'delay') gate = await hold(page, pattern)
          else await page.route(pattern, route => !fail ? route.continue()
            : failure === 'abort' ? route.abort() : route.fulfill({ status: 404, body: 'Asset no longer available' }))
          if (navigate) {
            await page.evaluate(() => {
              window.__feedbackStarted = performance.now()
              const observer = new MutationObserver(() => {
                if (document.querySelector('.page-load-feedback')) {
                  window.__feedbackMs = performance.now() - window.__feedbackStarted
                  observer.disconnect()
                }
              })
              observer.observe(document, { subtree: true, childList: true })
            })
            await clickLink(page, url('/contact/?source=recovery#contact'))
          } else await page.goto(url('/contact/?source=recovery#contact'), { waitUntil: 'domcontentloaded' })
          if (gate) await gate.requested
          await page.locator(`${feedback}[data-state="${gate ? 'loading' : 'error'}"]`).waitFor()
          assert.equal(await page.locator('#contact').count(), 0, 'Never expose a route before its stylesheet succeeds')
          if (!navigate) assert.equal(await page.locator('footer').count(), 0, 'Startup must not reveal a footer that shifts away when route content arrives')
          if (navigate) {
            assert.equal(await page.locator('.home-editorial').count(), 1)
            assert.equal(new URL(page.url()).pathname, '/home/', 'Failed/pending clicks do not commit history')
            assert.ok(await page.evaluate(() => window.__feedbackMs <= 100), 'Navigation feedback appears within 100 ms')
            await scrollTo(page, 400)
            await frame(page)
            assert.ok(await scrollTop(page) > 100, 'The retained page remains scrollable')
          }
          if (gate) await gate.release()
          else {
            assert.ok(await page.evaluate(() => window.__preloadFailures > 0), 'Vite preload errors follow the same recovery path')
            fail = false
            await page.getByRole('button', { name: '重试', exact: true }).click()
          }
          await page.locator('#contact').waitFor()
          assert.equal(await page.locator('footer').count(), 1)
          assert.equal(new URL(page.url()).search, '?source=recovery')
          assert.equal(new URL(page.url()).hash, '#contact')
          assert.equal(await page.locator(feedback).count(), 0)
        })
        pass(`${navigate ? 'Navigation' : 'Cold start'} ${resource} ${failure}: feedback, CSS readiness, retained content and recovery`)
      }
    }
  }

  for (const path of ['/', '/projects/', '/projects/studio/', '/projects/vae-gan-digits/']) {
    await withPage(async page => {
      const name = path === '/' ? 'HomepagePortal' : path.includes('studio') ? 'ProjectStudioPage'
        : path === '/projects/' ? 'ProjectsPage' : 'ProjectDetailPage'
      const gate = await hold(page, modulePattern(name))
      await page.goto(url(path), { waitUntil: 'domcontentloaded' })
      await gate.requested
      await page.locator(`${feedback}[data-state="loading"]`).waitFor()
      assert.equal(await page.locator('.nav-link').count(), 0, 'Portal and Projects never flash ordinary page navigation')
      await gate.release()
      await page.locator(feedback).waitFor({ state: 'detached' })
    })
  }
  pass('Portal, archive, Studio and detail startup retain their own page shell')

  // This fallback works before React and before any downloaded stylesheet.
  for (const resource of ['js', 'css']) {
    await withPage(async page => {
      const html = await (await page.request.get(url('/projects/'))).text()
      assert.ok(html.indexOf('<meta charset') < 1024, 'The startup guard must preserve early encoding detection')
      assert.ok(html.indexOf('<script data-site-startup') < html.indexOf('type="module"'), 'Recovery must install before entry assets can fail')
      let fail = true
      await page.route(resource === 'js' ? modulePattern('main') : cssPattern('main'), route => fail ? route.abort() : route.continue())
      await page.goto(url('/projects/'), { waitUntil: 'domcontentloaded' })
      await page.locator('.site-startup[data-state="error"]').waitFor()
      assert.equal(await page.locator('.site-startup').getAttribute('data-kind'), 'projects')
      assert.equal(await page.locator('.nav-link').count(), 0)
      fail = false
      await page.locator('.site-startup').getByRole('link', { name: '重试', exact: true }).click()
      await page.locator('.projects-archive').waitFor()
      assert.equal(await page.locator('.site-startup').count(), 0)
    })
    pass(`Entry ${resource} failure has independent HTML feedback and document retry`)
  }

  await withPage(async page => {
    const gate = await hold(page, modulePattern('main'))
    const loaded = page.goto(url('/'), { waitUntil: 'domcontentloaded' })
    await gate.requested
    await page.locator('.site-startup [role="status"]').waitFor()
    await page.locator('.site-startup[data-state="error"]').waitFor({ timeout: 11000 })
    await gate.release()
    await loaded
    await frame(page)
    assert.equal(await page.locator('.launch-intro-enter').count(), 0, 'A timed-out entry waits for explicit recovery')
    await page.locator('.site-startup').getByRole('link', { name: '重试', exact: true }).click()
    await page.locator('.launch-intro-enter').waitFor()
  })
  pass('Entry timeout keeps recovery visible even when the old entry script arrives late')

  for (const navigate of [false, true]) {
    await withPage(async page => {
      if (navigate) await openHome(page)
      const gate = await hold(page, modulePattern('ContactPage'))
      let requests = 0
      page.on('request', request => { if (modulePattern('ContactPage').test(request.url())) requests++ })
      if (navigate) await clickLink(page, url('/contact/'))
      else await page.goto(url('/contact/'), { waitUntil: 'domcontentloaded' })
      await gate.requested
      await page.locator(`${feedback}[data-state="error"]`).waitFor({ timeout: 11000 })
      assert.match(await page.locator(feedback).innerText(), /加载时间较长/)
      await gate.release()
      await page.waitForTimeout(200)
      assert.equal(await page.locator('#contact').count(), 0, 'Late results cannot silently replace a timed-out view')
      await page.getByRole('button', { name: '重试', exact: true }).click()
      await page.locator('#contact').waitFor()
      assert.equal(requests, 1, 'Timeout retries reuse the same module task')
    })
    pass(`${navigate ? 'Navigation' : 'Cold start'} timeout and retry ignore late commits without duplicate imports`)
  }

  await withPage(async page => {
    await openHome(page)
    const first = await hold(page, modulePattern('ContactPage'))
    const second = await hold(page, modulePattern('AboutPage'))
    const historyLength = await page.evaluate(() => history.length)
    await clickLink(page, url('/contact/'))
    await first.requested
    await clickLink(page, url('/about/'))
    await second.requested
    await first.release()
    await page.waitForTimeout(150)
    assert.equal(await page.locator('.home-editorial').count(), 1)
    assert.equal(await page.locator('#contact').count(), 0)
    await second.release()
    await page.waitForFunction(() => document.body.dataset.page === 'about')
    assert.equal(await page.evaluate(() => history.length), historyLength + 1)
    await page.goBack()
    await page.locator('.home-editorial').waitFor()
    await clickLink(page, url('/contact/'))
    await page.locator('#contact').waitFor()
    assert.equal(await page.locator(feedback).count(), 0)
  })
  pass('Consecutive navigation commits only the latest destination and preserves module reuse')

  await withPage(async page => {
    await openHome(page)
    const gate = await hold(page, cssPattern('ContactPage'))
    let requests = 0
    page.on('request', request => { if (cssPattern('ContactPage').test(request.url())) requests++ })
    await clickLink(page, url('/contact/'))
    await gate.requested
    await page.locator(`${feedback}[data-state="error"]`).waitFor({ timeout: 11000 })
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await page.locator(`${feedback}[data-state="loading"]`).waitFor()
    assert.equal(await page.locator('.home-editorial').count(), 1)
    await gate.release()
    await page.locator('#contact').waitFor()
    assert.equal(requests, 1, 'Retry while CSS is still pending shares its request and readiness gate')
  })
  pass('Retry during an unfinished CSS request retains content and waits for the original stylesheet')

  await withPage(async page => {
    await openHome(page)
    let release
    const failed = new Promise(resolve => { release = resolve })
    await page.route(modulePattern('ContactPage'), async route => { await failed; await route.abort() })
    await clickLink(page, url('/contact/'))
    await page.locator(`${feedback}[data-state="loading"]`).waitFor()
    await clickLink(page, url('/about/'))
    await page.waitForFunction(() => document.body.dataset.page === 'about')
    release()
    await page.waitForTimeout(150)
    assert.equal(await page.locator(feedback).count(), 0, 'A superseded Vite error cannot attach itself to the latest destination')
    assert.equal(new URL(page.url()).pathname, '/about/')
  })
  pass('Late failure from a superseded navigation cannot replace the current page or show stale errors')

  await withPage(async page => {
    await openHome(page)
    let staleAsset
    let recoveredRequests = 0
    await page.route(modulePattern('ContactPage'), async route => {
      if (route.request().url().endsWith('/ContactPage-recovered.js')) {
        recoveredRequests++
        await route.fulfill({ response: await route.fetch({ url: staleAsset }) })
      } else {
        staleAsset = route.request().url()
        await route.fulfill({ status: 404, body: 'Removed by deployment' })
      }
    })
    // A deployment publishes an entry referring to a new chunk; the old chunk
    // stays unavailable. Only a new document can discover that updated entry.
    await page.route(modulePattern('main'), async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: (await response.text()).replace(/ContactPage-[\w-]+\.js/g, 'ContactPage-recovered.js') })
    })
    await clickLink(page, url('/contact/?source=deployment#contact'))
    await page.locator(`${feedback}[data-state="error"]`).waitFor()
    assert.equal(await page.locator('.home-editorial').count(), 1)
    await page.getByRole('link', { name: '重新打开页面', exact: true }).click()
    await page.locator('#contact').waitFor()
    assert.equal(recoveredRequests, 1)
    assert.equal(new URL(page.url()).search, '?source=deployment')
    assert.equal(new URL(page.url()).hash, '#contact')
  })
  pass('An obsolete chunk stays failed until explicit document recovery discovers the new deployment entry')

  for (const options of [{}, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }]) {
    await withPage(async page => {
      await openHome(page)
      await scrollTo(page, 700)
      await frame(page)
      const homeTop = await scrollTop(page)
      const gate = await hold(page, modulePattern('ContactPage'))
      await clickLink(page, url('/contact/'))
      await gate.requested
      await page.getByRole('button', { name: '取消加载' }).click()
      await gate.release()
      await page.waitForTimeout(150)
      assert.equal(await page.locator('.home-editorial').count(), 1)
      assert.ok(Math.abs(await scrollTop(page) - homeTop) < 8)
      await clickLink(page, url('/contact/'))
      await page.locator('#contact').waitFor()
      await page.goBack()
      await page.locator('.home-editorial').waitFor()
      await frame(page)
      assert.ok(Math.abs(await scrollTop(page) - homeTop) < 8, 'Back restores the retained reading position')
      await page.goForward()
      await page.locator('#contact').waitFor()
      assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('main')), true)
      await clickLink(page, url('/home/#explore'))
      await page.locator('.home-editorial').waitFor()
      await frame(page)
      assert.ok(await scrollTop(page) > 100, 'Cross-page hashes still align the destination')
      await page.reload()
      await page.locator('.home-editorial').waitFor()
      assert.equal(new URL(page.url()).hash, '#explore')
    }, options)
  }
  pass('Desktop and mobile cancellation, Back/Forward, hash navigation, focus and scroll restoration')

  // A cold Back can fail after a document reload, while the address has already moved.
  await withPage(async page => {
    await openHome(page)
    await scrollTo(page, 650)
    await frame(page)
    const homeTop = await scrollTop(page)
    await clickLink(page, url('/contact/'))
    await page.locator('#contact').waitFor()
    await page.reload()
    await page.locator('#contact').waitFor()
    let fail = true
    await page.route(modulePattern('HomePage'), route => fail ? route.abort() : route.continue())
    await page.goBack()
    await page.locator(`${feedback}[data-state="error"]`).waitFor()
    assert.equal(await page.locator('#contact').count(), 1)
    await page.getByRole('button', { name: '留在当前页面' }).click()
    await page.waitForURL(url('/contact/'))
    assert.equal(await page.locator('#contact').count(), 1)
    fail = false
    await page.goBack()
    await page.locator(`${feedback}[data-state="error"]`).waitFor()
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await page.locator('.home-editorial').waitFor()
    await frame(page)
    assert.ok(Math.abs(await scrollTop(page) - homeTop) < 8)
    await page.goForward()
    await page.locator('#contact').waitFor()
  })
  pass('Failed Back retains content; cancel and document retry preserve history entries and saved scroll')

  for (const fail of [false, true]) {
    await withPage(async page => {
      await page.goto(url('/projects/'))
      await page.getByRole('button', { name: 'Open menu', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.archive-menu')?.dataset.state === 'open')
      let gate
      if (fail) await page.route(modulePattern('ContactPage'), route => route.abort())
      else gate = await hold(page, modulePattern('ContactPage'))
      await page.locator('.archive-menu').getByRole('link', { name: 'Contact', exact: true }).click()
      await page.locator(`${feedback}[data-state="${fail ? 'error' : 'loading'}"]`).waitFor()
      await page.locator('.project-page-transition').waitFor({ state: 'detached', timeout: 4500 })
      await frame(page)
      await assertUnlocked(page)
      assert.equal(await page.locator('.projects-archive').count(), 1)
      const action = page.getByRole('button', { name: fail ? '留在当前页面' : '取消加载', exact: true })
      await action.click()
      if (gate) await gate.release()
      await page.waitForTimeout(120)
      assert.equal(await page.locator('.projects-archive').count(), 1)
      await page.getByRole('button', { name: 'Open menu', exact: true }).click()
      await page.getByRole('button', { name: 'Close menu', exact: true }).click()
    }, { reducedMotion: 'no-preference' })
    pass(`Project menu ${fail ? 'failure' : 'cover budget'} releases all modals and exposes working recovery controls`)
  }

  await withPage(async page => {
    await page.goto(url('/projects/vae-digits/#project-implementation'))
    await page.locator('.project-reader-layout').waitFor()
    const gate = await hold(page, modulePattern('ProjectDetailPage'))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await gate.requested
    await page.locator('.project-page-transition').waitFor({ state: 'detached', timeout: 4500 })
    await page.locator(`${feedback}[data-state="error"]`).waitFor({ timeout: 11000 })
    await assertUnlocked(page)
    await gate.release()
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await page.locator('.project-reader-layout[data-chapter="implementation"]').waitFor()
    assert.equal(new URL(page.url()).hash, '#project-implementation')
  }, { reducedMotion: 'no-preference' })
  pass('Cold Projects reload hands off boot paper, releases it on timeout and retries the same chapter')

  await withPage(async page => {
    await page.route(modulePattern('ContactPage'), async route => {
      const response = await route.fetch()
      const source = await response.text()
      const exported = /export\{(\w+) as ContactPage\}/.exec(source)
      assert.ok(exported, 'The fault injector must wrap the real production component')
      const body = source.replace(exported[0], `function InjectedPage(props){if(!window.__renderRecovery)throw new Error('Injected route render failure');return ${exported[1]}(props)}export{InjectedPage as ContactPage}`)
      await route.fulfill({ response, body })
    })
    await page.goto(url('/contact/'))
    await page.locator(`${feedback}[data-state="error"]`).waitFor()
    assert.ok(await page.locator('.nav-link').count() > 0, 'The shared shell survives a render failure')
    await page.evaluate(() => { window.__renderRecovery = true })
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await page.locator('#contact').waitFor()
  })
  pass('React render boundary retains the shell and remounts successfully on retry')

  await withPage(async page => {
    await openHome(page)
    const probe = options => page.evaluate(options => {
      const link = document.createElement('a')
      link.href = options.href || '/contact/'
      if (options.target) link.target = options.target
      if (options.download) link.download = ''
      document.body.append(link)
      let intercepted = false
      window.addEventListener('click', event => { intercepted = event.defaultPrevented; event.preventDefault() }, { once: true })
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: options.modified }))
      link.remove()
      return intercepted
    }, options)
    for (const options of [{ target: '_blank' }, { download: true }, { modified: true }, { href: 'https://example.com/' }, { href: '/unknown/' }]) {
      assert.equal(await probe(options), false)
    }
  })
  pass('External links, new tabs, downloads, modifier keys and unknown routes retain native behavior')

  // Visual evidence is ignored by Git and uses only repository-relative names.
  await mkdir('node_modules/.cache/page-loading', { recursive: true })
  for (const [name, viewport, mobile] of [
    ['desktop', { width: 1440, height: 900 }, false],
    ['mobile', { width: 390, height: 844 }, true],
    ['landscape', { width: 844, height: 390 }, true],
  ]) {
    await withPage(async page => {
      await openHome(page)
      await page.route(modulePattern('ContactPage'), route => route.abort())
      await clickLink(page, url('/contact/'))
      await page.locator(`${feedback}[data-state="error"]`).waitFor()
      const box = await page.locator(feedback).boundingBox()
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1)
      await page.screenshot({ path: `node_modules/.cache/page-loading/${name}-failure.png` })
    }, { viewport, isMobile: mobile, hasTouch: mobile })
  }
  pass('Desktop, mobile portrait and landscape recovery controls fit within the viewport')
  await runStartupLayoutChecks(browser, baseURL)
  pass('Slow mobile startup stays within the layout-shift budget on Home, Learning and Contact')
  return passed
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.PERFORMANCE_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runPageLoadingChecks(browser, process.env.PERFORMANCE_TEST_URL || 'http://127.0.0.1:4173/', message => console.log(`PASS: ${message}`))
    console.log(`${checks} page loading checks passed`)
  } catch (error) {
    console.error('Page loading checks failed:', error.message)
    process.exitCode = 1
  } finally { await browser.close() }
}
