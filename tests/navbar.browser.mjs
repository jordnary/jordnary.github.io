import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { runNavbarScrollChecks } from './navbar-scroll.browser.mjs'
import { runNavbarMotionChecks } from './navbar-motion.browser.mjs'
import { runNavbarPanelChecks } from './navbar-panels.browser.mjs'
import { runNavbarMobileChecks } from './navbar-mobile.browser.mjs'

export async function runNavbarChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const pass = name => { checks.push(name); report(name) }
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  await context.addInitScript(() => {
    sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
    sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    sessionStorage.setItem('jordnary-theme', 'light')
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const shot = async name => {
    if (!process.env.NAV_SCREENSHOT_DIR) return
    await mkdir(process.env.NAV_SCREENSHOT_DIR, { recursive: true })
    await page.screenshot({ path: `${process.env.NAV_SCREENSHOT_DIR}/${name}.png`, animations: 'disabled' })
  }
  const closed = () => page.waitForFunction(() => !document.querySelector('.nav-mega-panel:not([hidden])'))
  const menuOpen = () => page.waitForFunction(() => {
    const dialog = document.querySelector('#mobile-navigation')
    return dialog.open && getComputedStyle(dialog, '::before').opacity === '1' && dialog.getBoundingClientRect().top === 0
  })
  const menuClosed = () => page.waitForFunction(() => !document.querySelector('#mobile-navigation').open && document.body.style.overflow !== 'hidden')
  try {
    await page.goto(new URL('about/', baseURL).href)
    await page.locator('.nav-link').first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.evaluate(() => [...document.fonts].find(font => font.family === 'Navigation Soft Round')?.status), 'loaded', 'Rounded navigation font loads successfully')
    assert.equal(await page.locator('.nav-link-label').first().evaluate(el => getComputedStyle(el).fontWeight), '600', 'Navigation labels use the intended semibold weight')
    assert.deepEqual(await page.locator('.nav-link').allTextContents(), ['首页', '关于', '学习', '项目', '联系'])
    assert.equal(await page.locator('.nav-actions a').count(), 0)
    assert.equal(await page.locator('.nav-search-button').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(255, 255, 255, 0.64)', 'Search retains the original light-theme fill')
    await shot('desktop-closed')
    pass('Five primary text links remain, without a separate contact button')

    await page.locator('#nav-toggle-learning').click()
    await page.locator('#nav-panel-learning').waitFor({ state: 'visible' })
    await page.keyboard.press('Escape')
    await closed()
    assert.equal(await page.locator('#nav-toggle-learning').evaluate(el => el === document.activeElement), true)
    pass('Click opens a disclosure; Escape closes it and restores trigger focus')

    const headerPaint = await page.locator('.nav-shell').evaluate(el => ({ image: getComputedStyle(el).backgroundImage, color: getComputedStyle(el).backgroundColor }))
    await page.locator('#nav-toggle-learning').focus()
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.nav-shell'), '::after').opacity === '1')
    for (const section of ['about', 'projects', 'learning']) {
      await page.locator(`#nav-toggle-${section}`).focus()
      await page.keyboard.press('ArrowDown')
      await page.locator(`#nav-panel-${section}`).waitFor({ state: 'visible' })
      const frames = await page.locator('.nav-shell').evaluate(async el => {
        const samples = []
        for (let index = 0; index < 8; index++) {
          await new Promise(resolve => requestAnimationFrame(resolve))
          const panel = el.querySelector('.nav-mega-panel:not([hidden])')
          const content = panel.querySelector('.nav-mega-content')
          samples.push({
            opacity: getComputedStyle(el, '::after').opacity,
            image: getComputedStyle(el).backgroundImage,
            color: getComputedStyle(el).backgroundColor,
            gap: panel.getBoundingClientRect().top - el.getBoundingClientRect().bottom,
            contentInset: parseFloat(getComputedStyle(content).paddingTop),
            surfaceTop: parseFloat(getComputedStyle(el, '::after').top),
            surfaceHeight: parseFloat(getComputedStyle(el, '::after').height),
            visibleHeight: panel.getBoundingClientRect().top - el.getBoundingClientRect().top + Math.min(panel.getBoundingClientRect().height, parseFloat(getComputedStyle(el).getPropertyValue('--nav-panel-height'))),
          })
        }
        return samples
      })
      assert.ok(frames.every(frame => frame.opacity === '1'), 'Switching panels never fades their shared background out')
      assert.ok(frames.every(frame => frame.image === headerPaint.image && frame.color === headerPaint.color), 'Opening and switching panels preserve the header background')
      assert.ok(frames.every(frame => frame.gap <= 0 && frame.gap >= -2 && frame.contentInset <= 16), 'Dropdowns meet the header with compact top spacing')
      assert.ok(frames.every(frame => frame.surfaceTop === 0 && frame.surfaceHeight >= frame.visibleHeight - 0.1), 'One continuous surface covers the visible dropdown throughout its height transition')
    }
    await page.keyboard.press('Escape')
    await closed()
    pass('Dropdowns join the header without a gap and retain a stable background across menu switches')

    await page.locator('.nav-link[href="/about/"]').hover()
    await page.locator('#nav-panel-about').waitFor({ state: 'visible' })
    await page.locator('#nav-panel-about .nav-feature-link').first().hover()
    await page.waitForTimeout(220)
    assert.equal(await page.locator('#nav-panel-about').isVisible(), true)
    await page.mouse.move(20, 700)
    await closed()
    pass('Hover panels stay open across the pointer path and dismiss on exit')

    await page.locator('#nav-toggle-learning').focus()
    await page.keyboard.press('ArrowDown')
    await page.locator('#nav-panel-learning').waitFor({ state: 'visible' })
    assert.equal(await page.locator('#nav-panel-learning').evaluate(el => el.contains(document.activeElement)), true)
    await shot('desktop-learning')
    await page.locator('#nav-panel-learning a[href="/learning/#notes"]').click()
    await page.waitForFunction(() => location.hash === '#notes' && document.body.dataset.page === 'learning')
    await closed()
    assert.equal(await page.locator('main').evaluate(el => el === document.activeElement), true)
    assert.equal(await page.locator('#notes').evaluate(el => Math.abs(el.getBoundingClientRect().top - 80) < 5), true)
    pass('Keyboard opens the panel; a cross-page section link closes it and focuses the destination')

    for (const route of ['home', 'about', 'learning', 'projects', 'contact']) {
      await page.locator(`.nav-link[href="/${route}/"]`).click()
      await page.waitForFunction(value => document.body.dataset.page === value, route)
      assert.equal(await page.locator(`.nav-link[href="/${route}/"]`).getAttribute('aria-current'), 'page')
      await closed()
    }
    pass('All primary labels navigate directly and track the active page')

    await page.locator('#nav-toggle-projects').focus()
    await page.keyboard.press('Enter')
    await page.locator('#nav-panel-projects').waitFor({ state: 'visible' })
    await page.locator('#nav-panel-projects .nav-feature-link').first().click()
    await page.waitForURL('**/projects/briefing-atlas/')
    await page.locator('.project-reader').waitFor({ state: 'attached' })
    await closed()
    pass('Featured projects open their real detail routes')

    await page.goto(new URL('about/', baseURL).href)
    await page.locator('.theme-toggle-button').click()
    await page.locator('.nav-link[href="/learning/"]').hover()
    await page.locator('#nav-panel-learning').waitFor({ state: 'visible' })
    await shot('desktop-dark')
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
    await page.mouse.click(20, 700)
    await closed()
    pass('Dark theme carries into panels; clicking outside dismisses them')

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.waitForFunction(() => !document.querySelector('.nav-shell').classList.contains('is-hidden'))
      await page.mouse.move(20, 500)
      await page.mouse.wheel(0, 500)
      await page.waitForFunction(() => document.querySelector('.nav-shell').getBoundingClientRect().bottom <= 0)
      const revealDelay = await page.evaluate(async () => {
        const started = performance.now()
        window.scrollBy({ top: -10, behavior: 'instant' })
        while (document.querySelector('.nav-shell').classList.contains('is-hidden') && performance.now() - started < 250) {
          await new Promise(resolve => requestAnimationFrame(resolve))
        }
        return performance.now() - started
      })
      assert.ok(revealDelay < 200, 'A small upward gesture starts revealing promptly, without waiting for a debounce')
      await page.evaluate(() => window.scrollBy({ top: 40, behavior: 'instant' }))
      await page.waitForTimeout(80)
      assert.equal(await page.locator('.nav-shell').evaluate(el => el.classList.contains('is-hidden')), false, 'A short reading correction keeps the revealed header visible')
      await page.waitForFunction(() => document.querySelector('.nav-shell').getBoundingClientRect().top >= 0)
      const readingFrames = await page.evaluate(async () => {
        const header = document.querySelector('.nav-shell')
        const hiddenFrames = []
        let sampling = true
        const sample = () => {
          hiddenFrames.push(header.classList.contains('is-hidden'))
          if (sampling) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
        for (let cycle = 0; cycle < 5; cycle++) {
          for (const top of [35, -25, 28, -38]) {
            window.scrollBy({ top, behavior: 'instant' })
            await new Promise(resolve => setTimeout(resolve, 80))
          }
        }
        sampling = false
        return hiddenFrames
      })
      assert.ok(readingFrames.length > 0 && readingFrames.every(hidden => !hidden), 'Repeated short reading corrections never hide the header')
      await page.mouse.wheel(0, 240)
      await page.waitForFunction(() => document.querySelector('.nav-shell').getBoundingClientRect().bottom <= 0)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.waitForFunction(() => document.querySelector('.nav-shell').getBoundingClientRect().top >= 0)
      pass(`${width}px header resists repeated reading corrections, reveals promptly on a small upward gesture, and hides on sustained downward browsing`)
    }

    await page.setViewportSize({ width: 1440, height: 844 })
    await page.locator('#nav-toggle-learning').focus()
    await page.keyboard.press('ArrowDown')
    await page.locator('#nav-panel-learning').waitFor({ state: 'visible' })
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }))
    await page.waitForTimeout(300)
    assert.equal(await page.locator('.nav-shell').evaluate(el => el.getBoundingClientRect().top), 0)
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
    await page.waitForTimeout(300)
    assert.equal(await page.locator('.nav-shell').evaluate(el => el.getBoundingClientRect().top), 0, 'Keyboard focus keeps navigation visible')
    await page.mouse.click(20, 700)
    await page.evaluate(() => window.scrollBy({ top: 20, behavior: 'instant' }))
    await page.waitForTimeout(100)
    assert.equal(await page.locator('.nav-shell').evaluate(el => el.classList.contains('is-hidden')), false, 'Closing a menu and releasing focus discard scroll intent accumulated during interaction')
    await page.mouse.wheel(0, 180)
    await page.waitForFunction(() => document.querySelector('.nav-shell').getBoundingClientRect().bottom <= 0)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForFunction(() => !document.querySelector('.nav-shell').classList.contains('is-hidden'))
    pass('Open dropdowns and keyboard focus keep the header available during scroll')

    for (const [width, height] of [[390, 844], [320, 568], [768, 1024], [844, 390]]) {
      await page.setViewportSize({ width, height })
      await page.waitForFunction(() => document.querySelector('.nav-shell').getBoundingClientRect().top === 0)
      const beforeOpen = await page.evaluate(() => {
        const icon = document.querySelector('.nav-menu-button .menu-icon').getBoundingClientRect()
        return { x: icon.x, y: icon.y, width: document.querySelector('.nav-shell').getBoundingClientRect().width }
      })
      await page.locator('.nav-menu-button').click()
      await menuOpen()
      const geometry = await page.locator('#mobile-navigation').evaluate(el => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el, '::before')
        const icon = el.querySelector('.menu-icon').getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, iconX: icon.x, iconY: icon.y, overflow: el.scrollWidth > el.clientWidth, fontSize: parseFloat(getComputedStyle(el.querySelector('.mobile-nav-link')).fontSize), background: style.backgroundColor, modal: el.matches(':modal') }
      })
      assert.equal(geometry.x, 0)
      assert.equal(geometry.y, 0)
      assert.equal(geometry.width, beforeOpen.width, 'The modal preserves the original page width and scrollbar space')
      assert.ok(Math.abs(geometry.iconX - beforeOpen.x) < 1 && Math.abs(geometry.iconY - beforeOpen.y) < 1, 'The cross occupies the original hamburger position')
      assert.equal(geometry.height, height)
      assert.equal(geometry.overflow, false)
      assert.equal(geometry.modal, true, 'Mobile navigation opens as a modal')
      assert.ok(geometry.fontSize >= 18 && geometry.fontSize <= 20, 'Mobile labels use a comfortable reading size')
      assert.ok(!geometry.background.includes(' / ') && geometry.background !== 'rgba(0, 0, 0, 0)')
      assert.equal(await page.locator('.mobile-nav-link').count(), 5)
      if (width === 390) {
        await shot('mobile-dark')
        await page.locator('.mobile-nav-theme').click()
        await shot('mobile-light')
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
      }
      await page.locator('.mobile-nav-theme').focus()
      for (let index = 0; index < 12; index++) {
        await page.keyboard.press('Tab')
        assert.equal(await page.locator('#mobile-navigation').evaluate(el => el.contains(document.activeElement)), true, `Tab ${index} stays inside mobile navigation`)
      }
      const top = await page.evaluate(() => scrollY)
      await page.mouse.wheel(0, 400)
      await page.waitForTimeout(100)
      assert.equal(await page.evaluate(() => scrollY), top)
      await page.keyboard.press('Escape')
      await menuClosed()
      const afterClose = await page.locator('.nav-menu-button .menu-icon').boundingBox()
      assert.ok(Math.abs(afterClose.x - beforeOpen.x) < 1 && Math.abs(afterClose.y - beforeOpen.y) < 1, 'Restoring page scrolling never shifts the hamburger')
      assert.equal(await page.locator('.nav-menu-button').evaluate(el => el === document.activeElement), true, 'Escape returns focus to the mobile toggle')
      pass(`Opaque fullscreen menu at ${width}x${height}: readable rows, contained focus, locked background, Escape restores focus`)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.nav-menu-button').click()
    await menuOpen()
    await page.locator('#mobile-nav-toggle-learning').click()
    await page.locator('.mobile-nav-overview[href="/learning/"]').click()
    await page.waitForFunction(() => document.body.dataset.page === 'learning')
    await menuClosed()
    assert.equal(await page.locator('main').evaluate(el => el === document.activeElement), true)
    pass('Mobile navigation closes the modal, releases scroll and focuses the new page')

    for (const shortcut of [false, true]) {
      await page.locator('.nav-menu-button').click()
      await menuOpen()
      if (shortcut) await page.keyboard.press('Control+k')
      else await page.locator('.mobile-nav-search').click()
      await page.locator('.site-search-backdrop').waitFor()
      assert.equal(await page.locator('#mobile-navigation').evaluate(el => el.open), false)
      await page.keyboard.press('Escape')
      await page.locator('.site-search-backdrop').waitFor({ state: 'hidden' })
    }
    pass('Mobile search button and keyboard shortcut both hand off from navigation to search')

    await page.locator('.nav-menu-button').click()
    await menuOpen()
    await page.setViewportSize({ width: 1200, height: 900 })
    await menuClosed()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.locator('.nav-link[href="/learning/"]').hover()
    await page.locator('#nav-panel-learning').waitFor({ state: 'visible' })
    assert.equal(await page.locator('#nav-panel-learning').evaluate(el => getComputedStyle(el).animationName), 'none')
    assert.deepEqual(errors, [])
    pass('Resizing releases the modal and scroll lock; reduced motion is respected; no browser errors')
    await runNavbarScrollChecks(browser, baseURL, pass)
    await runNavbarMotionChecks(browser, baseURL, pass)
    await runNavbarPanelChecks(browser, baseURL, pass)
    await runNavbarMobileChecks(browser, baseURL, pass)
  } finally {
    await context.close()
  }
  return checks
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch({ channel: process.env.LEARNING_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runNavbarChecks(browser, process.env.NAV_TEST_URL || 'http://127.0.0.1:5173/', name => console.log(`PASS: ${name}`))
    console.log(`${checks.length} navigation checks passed`)
  } catch (error) {
    console.error('Navigation checks failed:', error.message)
    console.error(error.stack?.match(/navbar(?:-scroll|-motion)?\.browser\.mjs:\d+:\d+/g)?.join('\n') || '')
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
