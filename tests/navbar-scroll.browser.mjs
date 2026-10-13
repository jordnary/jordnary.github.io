import assert from 'node:assert/strict'

export async function runNavbarScrollChecks(browser, baseURL, pass, modes = [false, true]) {
  for (const mobile of modes) {
    const label = mobile ? 'Touch phone' : 'Desktop'
    const context = await browser.newContext({
      viewport: { width: mobile ? 390 : 1440, height: 844 }, isMobile: mobile, hasTouch: mobile,
    })
    await context.addInitScript(() => {
      sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
      sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
      window.navTouchMoves = 0
      window.addEventListener('touchmove', () => window.navTouchMoves++, { passive: true })
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const session = mobile ? await context.newCDPSession(page) : null
    const hidden = () => page.locator('.nav-shell').evaluate(el => el.classList.contains('is-hidden'))
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const move = async amount => {
      const before = await page.evaluate(() => scrollY)
      if (mobile) {
        const point = y => [{ x: 195, y, id: 1 }]
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(620) })
        const steps = Math.max(4, Math.ceil(Math.abs(amount) / 40))
        for (let step = 1; step <= steps; step++) {
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(620 - amount * step / steps) })
          await page.waitForTimeout(16)
        }
        // Lift a stationary finger so inertia cannot obscure the next reading gesture.
        await page.waitForTimeout(120)
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      } else {
        await page.mouse.move(20, 500)
        await page.mouse.wheel(0, amount)
      }
      await page.waitForFunction(previous => Math.abs(scrollY - previous) >= 1, before)
      await settle()
    }
    const watch = () => page.evaluate(() => {
      window.navWatch?.disconnect()
      window.navHiddenFrames = []
      const header = document.querySelector('.nav-shell')
      window.navWatch = new MutationObserver(() => window.navHiddenFrames.push(header.classList.contains('is-hidden')))
      window.navWatch.observe(header, { attributes: true, attributeFilter: ['class'] })
    })
    const staysVisible = async reason => {
      await settle()
      assert.equal(await hidden(), false, reason)
      assert.ok(await page.evaluate(() => window.navHiddenFrames.every(value => !value)), `${reason}: no hidden frame during movement`)
    }
    const waitAt = top => page.waitForFunction(value => Math.abs(scrollY - value) < 4, top)
    const clickRoute = href => page.locator(`.nav-link[href="${href}"]`).evaluate(el => el.click())
    try {
      await page.goto(new URL('about/', baseURL).href)
      await page.locator('.journey-scroll-link').waitFor()
      await move(420)
      assert.equal(await hidden(), true, `${label}: manual scrolling hides`)
      await page.evaluate(() => {
        window.navFirstUpAt = null
        window.navRevealedAt = null
        let previous = scrollY
        const onScroll = () => {
          if (scrollY < previous && window.navFirstUpAt === null) window.navFirstUpAt = performance.now()
          previous = scrollY
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        const header = document.querySelector('.nav-shell')
        const observer = new MutationObserver(() => {
          if (!header.classList.contains('is-hidden') && window.navFirstUpAt !== null) {
            window.navRevealedAt = performance.now()
            observer.disconnect()
            window.removeEventListener('scroll', onScroll)
          }
        })
        observer.observe(header, { attributes: true, attributeFilter: ['class'] })
      })
      await move(mobile ? -35 : -10)
      assert.equal(await hidden(), false)
      const revealDelay = await page.evaluate(() => window.navRevealedAt - window.navFirstUpAt)
      assert.ok(await page.evaluate(() => window.navRevealedAt !== null), 'Upward input was observed')
      assert.ok(revealDelay >= 0 && revealDelay < 200, `${label}: upward reveal starts promptly`)
      await watch()
      for (let cycle = 0; cycle < 6; cycle++) {
        await move(45)
        await move(-45)
      }
      await staysVisible(`${label}: repeated short manual reading corrections remain visible`)
      await move(280)
      assert.equal(await hidden(), true, `${label}: sustained downward intent overrides reading protection`)
      pass(`${label}: real input stabilizes short reading gestures, promptly hides on sustained browsing and reveals on upward movement`)

      // Prime manual input immediately before each automatic navigation.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await settle()
      await move(40)
      await watch()
      await page.locator('.journey-scroll-link').evaluate(el => el.click())
      await page.waitForURL('**/about/#journey-start')
      await page.waitForFunction(() => {
        const target = document.querySelector('#journey-start')
        return Math.abs(target.getBoundingClientRect().top - parseFloat(getComputedStyle(target).scrollMarginTop)) < 4
      })
      await staysVisible(`${label}: same-page smooth anchor jump does not hide`)
      await move(250)
      assert.equal(await hidden(), true, `${label}: manual input resumes immediately after the anchor jump`)
      const savedTop = await page.evaluate(() => scrollY)
      await clickRoute('/learning/')
      await page.waitForFunction(() => document.body.dataset.page === 'learning')
      await waitAt(0)
      await watch()
      await page.goBack()
      await page.waitForURL('**/about/#journey-start')
      await waitAt(savedTop)
      await staysVisible(`${label}: history restores a deep position without hiding`)
      await page.goForward()
      await page.waitForFunction(() => document.body.dataset.page === 'learning')
      await waitAt(0)
      await staysVisible(`${label}: forward navigation remains visible`)
      await page.goBack()
      await waitAt(savedTop)
      await staysVisible(`${label}: repeated back navigation remains visible`)
      await page.reload()
      await page.locator('.journey-scroll-link').waitFor()
      await waitAt(savedTop)
      assert.equal(await hidden(), false, `${label}: reload restores the saved position with visible navigation`)
      pass(`${label}: smooth anchors, Back, Forward and reload restoration preserve the header and scroll position`)

      await watch()
      await page.locator('.journey-next-link[href="/learning/#notes"]').evaluate(el => el.click())
      await page.waitForURL('**/learning/#notes')
      await page.waitForFunction(() => Math.abs(document.querySelector('#notes').getBoundingClientRect().top - 80) < 5)
      await page.waitForTimeout(150)
      await staysVisible(`${label}: cross-page anchor and its delayed layout retry do not hide`)
      await move(250)
      assert.equal(await hidden(), true, `${label}: manual scrolling after a cross-page jump works immediately`)
      pass(`${label}: cross-page anchor restoration stays visible, then manual scrolling takes over`)

      // Interrupt a smooth anchor before it arrives; its old destination must not win.
      await page.goto(new URL('about/', baseURL).href)
      await page.locator('.journey-scroll-link').waitFor()
      await page.locator('.journey-scroll-link').evaluate(el => el.click())
      await page.waitForFunction(() => scrollY > 30)
      await move(mobile ? -70 : -40)
      const interruptedTop = await page.evaluate(() => scrollY)
      await page.waitForTimeout(350)
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - interruptedTop) < 4, `${label}: a manual gesture cancels the old smooth destination`)
      assert.equal(await hidden(), false)
      pass(`${label}: manual upward input interrupts an automatic jump without waiting`)

      if (mobile) {
        assert.ok(await page.evaluate(() => window.navTouchMoves > 0), 'Mobile checks exercised actual touch events')
      } else {
        await page.reload()
        await page.locator('main').focus()
        await page.keyboard.press('PageDown')
        await page.waitForFunction(() => document.querySelector('.nav-shell').classList.contains('is-hidden'))
        await page.evaluate(async () => {
          let previous = scrollY
          let stable = 0
          while (stable < 4) {
            await new Promise(resolve => requestAnimationFrame(resolve))
            stable = scrollY === previous ? stable + 1 : 0
            previous = scrollY
          }
        })
        await page.keyboard.press('ArrowUp')
        await page.waitForFunction(() => !document.querySelector('.nav-shell').classList.contains('is-hidden'))
        pass('Desktop: keyboard scrolling takes over after restoration and upward input reveals')
        const scrollbar = await page.evaluate(() => innerWidth - document.documentElement.clientWidth)
        if (scrollbar > 0) {
          await clickRoute('/about/')
          await waitAt(0)
          await page.mouse.click(1440 - scrollbar / 2, 500)
          await page.waitForFunction(() => scrollY > 120 && document.querySelector('.nav-shell').classList.contains('is-hidden'))
          pass('Desktop: native scrollbar input is recognized after automatic navigation')
        }
      }
      assert.deepEqual(errors, [])
    } finally {
      await context.close()
    }
  }
}
