import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

// Exercise the ordinary /home/ page independently of the root entry portal.
export async function runHomeEditorialChecks(browser, baseURL, report = () => {}) {
  const checks = []
  const failures = []
  const url = path => new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href
  const check = async (name, run, options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', ...options })
    await context.addInitScript(() => {
      sessionStorage.setItem('site-live2d-collapsed-desktop', 'true')
      sessionStorage.setItem('site-live2d-collapsed-mobile', 'true')
    })
    const page = await context.newPage()
    page.setDefaultTimeout(7000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await run(page)
      assert.deepEqual(errors, [], 'The browser must not report uncaught errors')
      checks.push(name)
      report(`PASS: ${name}`)
    } catch (error) {
      failures.push(`${name}: ${error.message}`)
      report(`FAIL: ${name}: ${error.message}`)
    } finally {
      await context.close()
    }
  }
  const home = async page => {
    await page.goto(url('home/'))
    await page.locator('.home-editorial').waitFor()
  }
  const atAnchor = async (page, id) => {
    await page.waitForFunction(targetId => {
      const element = document.getElementById(targetId)
      if (!element) return false
      const box = element.getBoundingClientRect()
      return box.top >= -2 && box.top < innerHeight * .4 && box.bottom > 0
    }, id)
    // Navigation repeats anchor positioning on its next frame after layout settles.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }
  const bubbleGroups = ['.home-editorial-hero-bubble', '.home-editorial-hero-foam', '.home-editorial-intro-bubbles']
  const sectionBubbleGroups = ['.home-editorial-selected-bubbles', '.home-editorial-journal-bubbles']
  const motionSelectors = ['.home-editorial-headlines', '.home-editorial-line-enter', '.home-editorial-marquee', '.home-editorial-wave', '.home-editorial-wave path', '.home-editorial-hero-caption', '.home-editorial-scroll', '.home-editorial-scroll i', ...[...bubbleGroups, ...sectionBubbleGroups].flatMap(selector => [selector, `${selector} i`])].join(', ')
  const motionSnapshot = page => page.evaluate(selector => [...document.querySelectorAll(selector)].map(element => {
    const style = getComputedStyle(element)
    const strokeTransform = element.matches('.home-editorial-scroll i') ? getComputedStyle(element, '::before').transform : null
    return { transform: style.transform, translate: style.translate, rotate: style.rotate, scale: style.scale, transformOrigin: style.transformOrigin, borderRadius: style.borderRadius, path: style.d, opacity: style.opacity, strokeTransform }
  }), motionSelectors)
  const settleScroll = async (page, top) => {
    await page.evaluate(target => window.scrollTo({ top: target, behavior: 'instant' }), top)
    await page.waitForFunction(target => Math.abs(window.scrollY - target) < 1, top)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }
  const bubbleGeometry = page => page.evaluate(selectors => ({
    scrollY: window.scrollY,
    groups: selectors.map(selector => {
      const box = document.querySelector(selector).getBoundingClientRect()
      return { x: box.x, y: box.y, documentY: box.y + window.scrollY }
    }),
    exploreY: document.querySelector('.home-editorial-scroll').getBoundingClientRect().y,
    captionY: document.querySelector('.home-editorial-hero-caption').getBoundingClientRect().y,
  }), bubbleGroups)
  const readyBubbles = page => page.waitForFunction(selectors => selectors.every(selector => Number(getComputedStyle(document.querySelector(selector)).opacity) > .99), bubbleGroups)
  const assertSameGroupPositions = (actual, expected, message) => {
    actual.groups.forEach((group, index) => {
      assert.ok(Math.abs(group.x - expected.groups[index].x) < 1 && Math.abs(group.y - expected.groups[index].y) < 1, `${message}: ${bubbleGroups[index]}`)
    })
  }
  const assertOnlyDocumentScroll = (before, after) => {
    before.groups.forEach((group, index) => {
      assert.ok(Math.abs(group.documentY - after.groups[index].documentY) < 1, `${bubbleGroups[index]} follows document scrolling without added parallax`)
    })
  }

  await check('The home hero is present and every visible cover loads', async page => {
    await home(page)
    assert.match(await page.title(), /Personal Website/)
    assert.equal(await page.getByRole('heading', { level: 1, name: '用好奇心，创造自己的世界。' }).count(), 1)
    await page.waitForFunction(() => {
      const hero = document.querySelector('.home-editorial-headlines')
      const box = hero?.getBoundingClientRect()
      return box && box.width > innerWidth * .75 && box.height > innerHeight * .25
    })
    assert.equal(await page.locator('.home-editorial-headlines').innerText().then(text => text.includes('CURIOSITY BRINGS IDEAS TO LIFE.')), true)
    for (const image of await page.locator('.home-editorial-photo img').all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate(element => element.decode())
      assert.equal(await image.evaluate(element => element.naturalWidth > 0), true, 'A cover must render a real image')
      assert.ok(await image.getAttribute('alt'), 'A cover retains its text alternative')
    }
    assert.equal(await page.getByRole('navigation', { name: '主导航', exact: true }).count(), 1, 'The shared primary navigation appears once')
    assert.deepEqual(await page.locator('.nav-link').allTextContents(), ['首页', '关于', '学习', '项目', '联系'])
    assert.equal(await page.locator('.nav-link[aria-current="page"]').innerText(), '首页')
    assert.equal(await page.getByRole('contentinfo').count(), 1, 'The page has one shared footer')
    assert.equal(await page.getByRole('navigation', { name: 'Footer navigation', exact: true }).count(), 1)
    assert.deepEqual(await page.locator('.footer-nav-column').first().getByRole('link').allTextContents(), ['Home', 'About', 'Learning', 'Projects', 'Contact'])
    assert.equal(await page.locator('.home-editorial-header, .home-editorial-menu, .home-editorial-footer-bottom').count(), 0, 'The redesign adds no duplicate navigation')
  })

  await check('The root URL retains the introduction and interactive directory', async page => {
    await page.goto(url(''))
    assert.equal(await page.locator('.home-editorial').count(), 0)
    await page.locator('.launch-intro-enter').click()
    await page.locator('.homepage-portal[data-phase="hub"]').waitFor()
    assert.equal(await page.locator('.homepage-hub-nav a').count(), 5)
    assert.equal(await page.locator('.homepage-hub').isVisible(), true)
  })

  await check('The shared mobile menu traps keyboard focus and returns it after Escape or Close', async page => {
    await home(page)
    const trigger = page.getByRole('button', { name: '打开导航菜单', exact: true })
    const menu = page.getByRole('dialog', { name: '全站导航', exact: true })
    await trigger.click()
    assert.equal(await menu.evaluate(element => element.matches(':modal')), true)
    for (let index = 0; index < 9; index++) {
      await page.keyboard.press('Tab')
      // Chromium may send Tab to browser chrome after the last modal control.
      // When the document owns focus, no background page control may receive it.
      assert.equal(await menu.evaluate(element => !document.hasFocus() || element.contains(document.activeElement)), true, 'Page keyboard focus remains inside the open menu')
    }
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'Escape restores focus to the menu trigger')
    await trigger.click()
    await menu.getByRole('button', { name: '关闭导航菜单', exact: true }).click()
    await menu.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true, 'Close restores focus to the menu trigger')
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  await check('Ctrl+K searches, follows a result, and browser Back restores the homepage', async page => {
    await home(page)
    await page.keyboard.press('Control+k')
    const input = page.getByRole('combobox', { name: '搜索站内内容', exact: true })
    await input.waitFor()
    assert.equal(await page.locator('.site-search-dialog').count(), 1, 'The shared search opens exactly one dialog')
    await input.fill('关于我')
    await page.getByRole('option').filter({ hasText: '关于我' }).first().click()
    await page.waitForURL(url('about/'))
    await page.locator('.nav-desktop-list').waitFor()
    assert.equal(await page.locator('.site-search-dialog').count(), 0)
    await page.goBack()
    await page.locator('.home-editorial').waitFor()
    assert.equal(new URL(page.url()).pathname, new URL(url('home/')).pathname)
    await page.keyboard.press('Control+k')
    await input.waitFor()
    assert.equal(await page.locator('.site-search-dialog').count(), 1, 'Returning home does not register a duplicate search')
    await page.keyboard.press('Escape')
    await input.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '搜索站内内容', exact: true }).click()
    await input.waitFor()
    assert.equal(await page.locator('.site-search-dialog').count(), 1, 'Closing search releases the shared navigation controls')
  })

  await check('Ctrl+K from the shared mobile menu transfers interaction to one search dialog', async page => {
    await home(page)
    await page.getByRole('button', { name: '打开导航菜单', exact: true }).click()
    await page.keyboard.press('Control+k')
    const input = page.getByRole('combobox', { name: '搜索站内内容', exact: true })
    await input.waitFor()
    await page.waitForFunction(() => document.activeElement?.matches('.site-search-input'))
    assert.equal(await page.locator('#mobile-navigation').evaluate(element => element.open), false, 'The native menu closes before search opens')
    assert.equal(await page.locator('.site-search-dialog').count(), 1)
    await input.fill('学习')
    assert.ok(await page.getByRole('option').count() > 0)
    await page.keyboard.press('Escape')
    await input.waitFor({ state: 'hidden' })
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  await check('Explore, selected work, journal and live anchors reach readable sections', async page => {
    await home(page)
    await page.getByRole('link', { name: 'EXPLORE MORE', exact: true }).click()
    await atAnchor(page, 'explore')
    for (const id of ['explore', 'selected', 'journal', 'live']) {
      await page.goto(url(`home/#${id}`))
      await atAnchor(page, id)
      const heading = page.locator(`#${id} h2`).first()
      assert.equal(await heading.isVisible(), true, `The ${id} heading is present at its direct link`)
    }
  })

  for (const width of [1440, 320]) {
    await check(`The ${width}px introduction reveals characters only after its heading enters the viewport`, async page => {
      await home(page)
      await page.waitForFunction(() => document.querySelector('.home-editorial').dataset.revealReady === 'true')
      const copy = page.locator('.home-editorial-intro-copy')
      const heading = page.getByRole('heading', { name: '在代码与生活之间，寻找每一个有趣的想法 把好奇写成笔记，让小小的想法成形 让每一天，多一点新发现 Curiosity shapes my days.', exact: true })
      assert.equal(await heading.count(), 1, 'The split characters retain one complete accessible heading')
      assert.equal(await copy.locator('a').count(), 0, 'The introduction no longer has an About action')
      assert.equal(await page.getByText('CS / AI / WEB — AN ONGOING EXPLORATION', { exact: true }).count(), 0)
      const headingTop = await heading.evaluate(element => element.getBoundingClientRect().top + scrollY)
      await settleScroll(page, Math.round(headingTop - page.viewportSize().height * .9))
      await page.waitForTimeout(80)
      assert.equal(await copy.evaluate(element => element.classList.contains('is-revealed')), false, 'The body animation waits until the heading reaches its reveal threshold')
      await settleScroll(page, Math.round(headingTop - page.viewportSize().height * .65))
      await page.waitForFunction(() => document.querySelector('.home-editorial-intro-copy').classList.contains('is-revealed'))
      const samples = await copy.evaluate(element => {
        const animations = element.getAnimations({ subtree: true })
        animations.forEach(animation => animation.pause())
        const snapshot = time => {
          animations.forEach(animation => { animation.currentTime = time })
          return {
            firstLetters: [...element.querySelectorAll('.home-editorial-story-character:first-child')].map(character => Number(getComputedStyle(character).opacity)),
            characters: [...element.querySelectorAll('.home-editorial-story-line:last-child .home-editorial-story-character')].map(character => {
              const style = getComputedStyle(character)
              return { opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42 }
            }),
            englishOpacity: Number(getComputedStyle(element.querySelector('.home-editorial-intro-english')).opacity),
          }
        }
        return { early: snapshot(200), middle: snapshot(800), finished: snapshot(2000) }
      })
      assert.ok(samples.early.firstLetters.every(opacity => opacity > .1), 'All four lines begin together')
      assert.ok(Math.max(...samples.early.firstLetters) - Math.min(...samples.early.firstLetters) < .02)
      assert.ok(samples.early.characters[0].opacity > samples.early.characters.at(-1).opacity + .2, 'Characters fade in from left to right')
      assert.ok(samples.early.characters[0].y > 0, 'Characters rise gently into their final baseline')
      assert.equal(samples.early.englishOpacity, 0, 'The English text follows the first characters')
      assert.ok(samples.middle.englishOpacity > .2)
      assert.ok(samples.finished.characters.every(character => character.opacity === 1 && character.y === 0), 'Every character finishes visible and aligned')
      assert.equal(samples.finished.englishOpacity, 1)
      await settleScroll(page, 0)
      await settleScroll(page, Math.round(headingTop - page.viewportSize().height * .4))
      assert.equal(await copy.evaluate(element => [...element.querySelectorAll('.home-editorial-story-character')].every(character => Number(getComputedStyle(character).opacity) === 1)), true, 'Returning to the section must not hide its text again')
    }, { viewport: { width, height: 900 } })
  }

  for (const width of [320, 390, 768, 1440]) {
    await check(`The ${width}px layout fits the screen and its arrows reveal the third journal card`, async page => {
      await home(page)
      for (const id of ['home', 'explore', 'selected', 'journal', 'live']) {
        await page.locator(`#${id}`).scrollIntoViewIfNeeded()
        const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }))
        assert.ok(dimensions.content <= dimensions.viewport + 1, `${id} must not create document-wide horizontal scrolling: ${JSON.stringify(dimensions)}`)
      }
      const controls = page.getByRole('button', { name: '下一张日常卡片', exact: true })
      await controls.scrollIntoViewIfNeeded()
      const rail = page.getByRole('region', { name: '学习与日常，可横向滚动', exact: true })
      const initial = await rail.evaluate(element => element.scrollLeft)
      await controls.click()
      await page.waitForFunction(start => document.querySelector('.home-editorial-journal-rail').scrollLeft > start + 20, initial)
      await page.waitForTimeout(650)
      await controls.click()
      await page.waitForFunction(() => {
        const rail = document.querySelector('.home-editorial-journal-rail')
        const card = rail?.querySelector('article:last-child')
        if (!card) return false
        const bounds = card.getBoundingClientRect()
        return bounds.left >= -1 && bounds.right <= innerWidth + 1
      })
      const last = await rail.evaluate(element => element.scrollLeft)
      await page.getByRole('button', { name: '上一张日常卡片', exact: true }).click()
      await page.waitForFunction(start => document.querySelector('.home-editorial-journal-rail').scrollLeft < start - 20, last)
      const header = await page.locator('.nav-shell').boundingBox()
      assert.ok(header.x >= -1 && header.x + header.width <= width + 1, 'Fixed navigation remains inside the viewport')
      assert.equal(await page.locator('.nav-desktop-list').isVisible(), width >= 720, 'The original desktop/mobile navigation breakpoint is preserved')
      await page.locator('#site-footer').scrollIntoViewIfNeeded()
      assert.equal(await page.getByRole('navigation', { name: 'Footer navigation', exact: true }).isVisible(), true, 'The shared footer stays accessible at every supported width')
    }, { viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 })
  }

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await check(`The ${viewport.width}px headlines drift toward the document-anchored caption and retrace on reverse scroll`, async page => {
      await home(page)
      const geometry = () => page.evaluate(() => {
        const headlines = document.querySelector('.home-editorial-headlines').getBoundingClientRect()
        const caption = document.querySelector('.home-editorial-hero-caption').getBoundingClientRect()
        return { headlineY: headlines.y, documentY: headlines.y + scrollY, captionY: caption.y + scrollY, gap: caption.top - headlines.bottom }
      })
      const start = await geometry()
      await settleScroll(page, viewport.height * .1)
      assert.ok(Math.abs((await geometry()).documentY - start.documentY) < 1, 'A small initial scroll keeps the original composition')
      const distance = viewport.height * .35
      await settleScroll(page, distance)
      const down = await geometry()
      assert.ok(down.documentY - start.documentY > viewport.height * .04, 'The English moves down relative to the page by a visible amount')
      assert.ok(down.headlineY < start.headlineY && start.headlineY - down.headlineY < distance, 'The English still leaves the viewport, more slowly than ordinary content')
      assert.ok(Math.abs(down.captionY - start.captionY) < 1, 'The caption stays at its original document position')
      assert.ok(down.gap < start.gap - viewport.height * .04 && down.gap > 0, 'The English approaches the caption without overlapping it')
      await settleScroll(page, viewport.height * .6)
      const further = await geometry()
      assert.ok(further.documentY > down.documentY, 'The drift continues as scrolling advances')
      await settleScroll(page, viewport.height * .85)
      const late = await geometry()
      assert.ok(late.documentY - further.documentY < further.documentY - down.documentY, 'The drift eases out before the hero leaves')
      assert.ok(late.gap > 0, 'The maximum drift leaves room above the caption')
      await settleScroll(page, viewport.height * 1.2)
      assert.ok(Math.abs((await geometry()).documentY - late.documentY) < 1, 'The drift stops growing below the hero')
      await settleScroll(page, distance)
      const returned = await geometry()
      assert.ok(Math.abs(returned.documentY - down.documentY) < 1, 'Reversing scroll restores the same text position without accumulated drift')
      await settleScroll(page, 0)
      assert.ok(Math.abs((await geometry()).documentY - start.documentY) < 1, 'Returning to the top restores the original composition')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The moving text never widens the page')
    }, { viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 })
  }

  await check('The three English rows loop left, right, left at the reference pace', async page => {
    await home(page)
    const movements = await page.evaluate(() => [...document.querySelectorAll('.home-editorial-marquee')].map(element => {
      const animation = element.getAnimations()[0]
      const { delay, duration } = animation.effect.getTiming()
      animation.pause()
      const xAt = time => {
        animation.currentTime = time
        return new DOMMatrixReadOnly(getComputedStyle(element).transform).m41
      }
      const delta = xAt(delay + 7000) - xAt(delay + 5000)
      const lastCopyX = xAt(delay + Number(duration) - 1) + element.children[1].offsetLeft
      const firstCopyX = xAt(delay + Number(duration) + 1) + element.children[0].offsetLeft
      // Compare in the track's coordinates, independent of the entrance rotation.
      const phraseWidth = Number.parseFloat(getComputedStyle(element.children[0]).width)
      // Either adjacent copy can cross the edge when a reversed animation wraps.
      const seam = Math.abs(lastCopyX - firstCopyX) % phraseWidth
      return { delta, seam: Math.min(seam, phraseWidth - seam) }
    }))
    assert.ok(movements[0].delta < 0 && movements[1].delta > 0 && movements[2].delta < 0, 'Adjacent rows travel in opposite directions')
    const speeds = movements.map(({ delta }) => Math.abs(delta) / 2 / page.viewportSize().width)
    assert.ok(speeds[0] > speeds[1] && speeds[1] > speeds[2], 'The top row leads, the middle row is slightly slower, and the bottom row is slowest')
    assert.ok(speeds[0] > .035 && speeds[0] < .04, 'The top row travels roughly 3.75% of the viewport per second, as in the reference')
    movements.forEach(({ seam }) => assert.ok(seam < 1, 'Repeated phrases meet without a visible jump at the loop boundary'))
  })

  for (const width of [320, 1440]) {
    await check(`The ${width}px section bubble pairs float, follow scrolling, and leave actions usable`, async page => {
      await home(page)
      for (const selector of sectionBubbleGroups) {
        const group = page.locator(selector)
        assert.equal(await group.locator('i').count(), 2, 'Each section contains one large and one small bubble')
        assert.equal(await group.getAttribute('aria-hidden'), 'true', 'Decorative bubbles stay out of the accessibility tree')
        const target = await group.evaluate(element => {
          const anchor = element.closest('.home-editorial-section-bottom').getBoundingClientRect()
          return Math.round(scrollY + anchor.top + anchor.height / 2 - innerHeight / 2)
        })
        await settleScroll(page, target)
        const snapshot = () => group.evaluate(element => ({
          y: element.getBoundingClientRect().y,
          children: [...element.children].map(child => {
            const style = getComputedStyle(child)
            return { translate: style.translate, transform: style.transform, shape: style.borderRadius }
          }),
        }))
        const idle = await snapshot()
        await page.waitForTimeout(180)
        const floating = await snapshot()
        assert.equal(floating.y, idle.y, 'Idle motion does not move the scroll anchor')
        assert.notDeepEqual(floating.children, idle.children, 'The bubbles keep floating and deforming while the page is still')
        await settleScroll(page, target + 120)
        const scrolled = await snapshot()
        assert.ok(idle.y - scrolled.y > 150, 'The pair adds a clear vertical displacement beyond ordinary document scrolling')
        await settleScroll(page, target)
        assert.ok(Math.abs((await snapshot()).y - idle.y) < 1, 'Reversing scroll restores the original group position')
        const actionsClear = await group.evaluate(element => {
          const bubbles = [...element.children].map(child => child.getBoundingClientRect())
          return [...element.closest('.home-editorial-section-bottom').querySelectorAll('a')].every(link => {
            const box = link.getBoundingClientRect()
            return link.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
              && bubbles.every(bubble => bubble.right <= box.left || bubble.left >= box.right || bubble.bottom <= box.top || bubble.top >= box.bottom)
          })
        })
        assert.equal(actionsClear, true, 'White bubbles neither cover the section action nor intercept its pointer')
        for (const offset of [-300, 0, 300]) {
          await settleScroll(page, target + offset)
          const contentClear = await group.evaluate(element => {
            const paper = element.closest('.home-editorial-paper')
            const obstacles = [...paper.querySelectorAll('img')].map(image => image.getBoundingClientRect())
            const text = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT)
            while (text.nextNode()) {
              if (!text.currentNode.textContent.trim() || text.currentNode.parentElement.closest('[aria-hidden="true"], .home-editorial-sr, style, script')) continue
              const range = document.createRange()
              range.selectNodeContents(text.currentNode)
              obstacles.push(...range.getClientRects())
            }
            return [0, 2500, 5000, 7500].every(time => {
              element.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = time })
              return [...element.children].every(child => {
                const bubble = child.getBoundingClientRect()
                return obstacles.every(box => bubble.right <= box.left || bubble.left >= box.right || bubble.bottom <= box.top || bubble.top >= box.bottom)
              })
            })
          })
          assert.equal(contentClear, true, 'The complete floating and scrolling envelope stays clear of text and images')
        }
      }
      await settleScroll(page, 0)
      assert.equal(await page.locator('.home-editorial-journal-bubbles').evaluate(element => element.getBoundingClientRect().top > innerHeight), true, 'The lower pair starts below the viewport')
      await settleScroll(page, await page.evaluate(() => document.documentElement.scrollHeight - innerHeight))
      assert.equal(await page.locator('.home-editorial-journal-bubbles').evaluate(element => element.getBoundingClientRect().bottom < 0), true, 'The lower pair leaves the viewport with its section after scrolling past it')
    }, { viewport: { width, height: 900 } })
  }

  await check('Bubble pairs cross the hero edge, move with parallax, and return to the same scroll position', async page => {
    await home(page)
    await readyBubbles(page)
    for (const selector of bubbleGroups) {
      assert.equal(await page.locator(`${selector} > i`).count(), 2, `${selector} contains one large and one small bubble`)
    }
    const distance = page.viewportSize().height * .2
    const start = await bubbleGeometry(page)
    assert.ok(Math.abs(start.exploreY - page.viewportSize().height * .85) < page.viewportSize().height * .02, 'Explore begins near the lower 85% viewport line')
    await settleScroll(page, distance)
    const down = await bubbleGeometry(page)
    const documentTravel = down.scrollY - start.scrollY
    start.groups.forEach((group, index) => {
      assert.ok(group.y - down.groups[index].y > documentTravel + 2, `${bubbleGroups[index]} rises faster than ordinary document content`)
    })
    assert.ok(Math.abs(start.exploreY - down.exploreY - documentTravel) < 1, 'Explore stays attached to its original place while the bubbles drift past it')
    assert.ok(Math.abs((start.exploreY - down.exploreY) - (start.captionY - down.captionY)) < 1, 'Explore and the hero caption move together with the document')
    await settleScroll(page, distance * 2)
    await settleScroll(page, distance)
    const returned = await bubbleGeometry(page)
    assertSameGroupPositions(returned, down, 'Reversing scroll restores the group position')
    assert.ok(Math.abs(returned.exploreY - down.exploreY) < 1, 'Reversing scroll restores the Explore position')

    // Inspect painted pixels, because an unclipped DOM box can still sit behind the next section.
    const boundary = await page.evaluate(() => ({
      edge: document.querySelector('.home-editorial-hero').getBoundingClientRect().bottom,
      samples: [...document.querySelectorAll('.home-editorial-hero-foam > i')].map(element => {
        const box = element.getBoundingClientRect()
        return { x: box.x + box.width / 2, y: box.y + box.height / 2, color: getComputedStyle(element).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number) }
      }),
    }))
    assert.ok(boundary.samples[0].y < boundary.edge && boundary.samples[1].y > boundary.edge, 'The two white bubbles straddle the hero and intro boundary')
    boundary.samples.forEach(sample => assert.ok(sample.y > 0 && sample.y < page.viewportSize().height, 'Both white bubble centers are inside the viewport'))
    const pixels = await page.evaluate(async ({ png, samples }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      return samples.map(({ x, y }) => [...context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data].slice(0, 3))
    }, { png: (await page.screenshot()).toString('base64'), samples: boundary.samples })
    pixels.forEach((pixel, index) => {
      assert.ok(pixel.every((channel, channelIndex) => Math.abs(channel - boundary.samples[index].color[channelIndex]) < 5), 'Each white bubble remains painted across the hero edge and above the intro background')
    })
  })

  await check('Hero bubbles stay clear of both wave surfaces through entrance, idle loops and resizing', async page => {
    const clearance = () => page.evaluate(() => {
      const root = document.querySelector('.home-editorial')
      const group = root.querySelector('.home-editorial-hero-bubble')
      const bubbles = [...group.querySelectorAll('i')]
      const waves = [...root.querySelectorAll('.home-editorial-wave path')]
      const animations = root.getAnimations({ subtree: true })
      animations.forEach(animation => animation.pause())
      let minimumGap = Infinity
      let minimumTop = Infinity
      // Seek through the entrance and multiple idle cycles without waiting in real time.
      const times = animations.length ? Array.from({ length: 121 }, (_, index) => index * 200) : [0]
      for (const time of times) {
        animations.forEach(animation => { animation.currentTime = time })
        if (Number(getComputedStyle(group).opacity) < .01) continue
        for (const bubble of bubbles) {
          const box = bubble.getBoundingClientRect()
          minimumTop = Math.min(minimumTop, box.top)
          for (const wave of waves) {
            const matrix = wave.getScreenCTM()
            if (!matrix || matrix.d < .001) continue
            // Check the entire transformed bubble box against the rendered SVG fill.
            // This includes rear-wave motion, entrance scaling and mobile SVG stretching.
            for (const x of [box.left, (box.left + box.right) / 2, box.right]) {
              const local = new DOMPoint(x, box.bottom).matrixTransform(matrix.inverse())
              const viewBox = wave.ownerSVGElement.viewBox.baseVal
              let low = viewBox.y
              let high = viewBox.y + viewBox.height
              for (let step = 0; step < 16; step++) {
                const y = (low + high) / 2
                if (wave.isPointInFill(new DOMPoint(local.x, y))) high = y
                else low = y
              }
              minimumGap = Math.min(minimumGap, new DOMPoint(local.x, high).matrixTransform(matrix).y - box.bottom)
            }
          }
        }
      }
      return { minimumGap, minimumTop, navBottom: document.querySelector('.nav-shell').getBoundingClientRect().bottom, bubbles: bubbles.length, waves: waves.length }
    })
    const assertClearance = (result, profile) => {
      assert.equal(result.bubbles, 2)
      assert.equal(result.waves, 2)
      assert.ok(Number.isFinite(result.minimumGap) && result.minimumGap >= 12, `${profile}: bubbles need clear space above both waves, found ${result.minimumGap.toFixed(2)}px`)
      assert.ok(result.minimumTop >= result.navBottom, `${profile}: bubbles must also remain below the navigation`)
    }
    for (const [width, height] of [[1440, 900], [2558, 1346], [1920, 1080], [2560, 720], [2560, 573], [1366, 580], [768, 1024], [601, 580], [390, 844], [844, 390], [320, 568]]) {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.setViewportSize({ width, height })
      await home(page)
      assertClearance(await clearance(), `${width}x${height}`)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      assertClearance(await clearance(), `${width}x${height} reduced motion`)
    }
  })

  await check('Reduced motion keeps the hero and section text readable without continuous motion', async page => {
    await home(page)
    assert.equal(await page.locator('.home-editorial-intro-copy').evaluate(element => [...element.querySelectorAll('.home-editorial-story-character, .home-editorial-eyebrow, .home-editorial-intro-english')].every(child => {
      const style = getComputedStyle(child)
      return Number(style.opacity) === 1 && style.transform === 'none'
    })), true, 'Reduced motion exposes every intro character and subtitle immediately')
    const before = await motionSnapshot(page)
    await page.waitForTimeout(300)
    assert.deepEqual(await motionSnapshot(page), before)
    assert.equal(await page.getByRole('link', { name: 'EXPLORE MORE', exact: true }).isVisible(), true)
    const geometry = await bubbleGeometry(page)
    await settleScroll(page, page.viewportSize().height * .2)
    assertOnlyDocumentScroll(geometry, await bubbleGeometry(page))
    assert.deepEqual(await motionSnapshot(page), before, 'Reduced motion disables deformation and scroll-driven transforms')
    await page.getByRole('link', { name: 'EXPLORE MORE', exact: true }).click()
    await atAnchor(page, 'explore')
    for (const id of ['explore', 'selected', 'journal', 'live']) {
      await page.goto(url(`home/#${id}`))
      await atAnchor(page, id)
      assert.equal(await page.locator(`#${id} h2`).first().evaluate(element => {
        for (let current = element; current && current.matches('.home-editorial, .home-editorial *'); current = current.parentElement) {
          const style = getComputedStyle(current)
          if (Number(style.opacity) === 0 || style.visibility === 'hidden' || style.display === 'none') return false
        }
        return element.getBoundingClientRect().height > 0
      }), true, 'Text must remain readable without reveal animations')
    }
  }, { reducedMotion: 'reduce' })

  await check('Changing reduced motion at runtime stops bubble motion and preserves Explore navigation', async page => {
    await home(page)
    await readyBubbles(page)
    const distance = page.viewportSize().height * .2
    await settleScroll(page, distance)
    const running = await bubbleGeometry(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => document.querySelector('.home-editorial').dataset.motion === 'paused')
    const reduced = await motionSnapshot(page)
    const geometry = await bubbleGeometry(page)
    await settleScroll(page, distance * 2)
    assertOnlyDocumentScroll(geometry, await bubbleGeometry(page))
    await page.waitForTimeout(250)
    assert.deepEqual(await motionSnapshot(page), reduced, 'A live preference change stops both deformation and scroll-driven movement')
    await page.getByRole('link', { name: 'EXPLORE MORE', exact: true }).click()
    await atAnchor(page, 'explore')
    await settleScroll(page, distance)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.waitForFunction(() => document.querySelector('.home-editorial').dataset.motion === 'running')
    await settleScroll(page, distance)
    assertSameGroupPositions(await bubbleGeometry(page), running, 'Restoring motion restores the current scroll position without accumulating drift')
  })

  await check('The original desktop menu and footer navigate between Home and About', async page => {
    await home(page)
    await page.locator('#nav-toggle-about').focus()
    await page.keyboard.press('ArrowDown')
    await page.locator('#nav-panel-about').waitFor({ state: 'visible' })
    assert.equal(await page.locator('#nav-panel-about').evaluate(element => element.contains(document.activeElement)), true, 'The shared desktop submenu accepts keyboard focus')
    await page.keyboard.press('Escape')
    await page.locator('#nav-panel-about').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('#nav-toggle-about').evaluate(element => element === document.activeElement), true)
    await page.locator('.nav-link').filter({ hasText: '关于' }).click()
    await page.waitForURL(url('about/'))
    await page.locator('.nav-desktop-list').waitFor()
    assert.equal(await page.locator('.home-editorial').count(), 0)
    assert.equal(await page.locator('.nav-link').count(), 5)
    // Reveal the footer by scrolling its reserved space; its links sit in a fixed surface.
    await page.locator('#site-footer').scrollIntoViewIfNeeded()
    await page.getByRole('navigation', { name: 'Footer navigation', exact: true }).getByRole('link', { name: 'Home', exact: true }).click()
    await page.locator('.home-editorial').waitFor()
    assert.equal(await page.locator('.nav-desktop-list').count(), 1)
    assert.equal(await page.locator('.nav-link[aria-current="page"]').innerText(), '首页')
    assert.equal(await page.locator('#site-footer').count(), 1)
    assert.equal(await page.locator('dialog:modal').count(), 0, 'No stale native menu remains after navigation')
  })

  await check('Projects entry and browser Back both retain their visible page transition', async page => {
    await home(page)
    await page.getByRole('link', { name: '浏览全部项目', exact: true }).click()
    const transition = page.getByRole('dialog', { name: 'Page transition', exact: true })
    await transition.waitFor({ state: 'visible' })
    await page.waitForURL(url('projects/'))
    await transition.waitFor({ state: 'hidden' })
    await page.locator('.projects-archive').waitFor()
    await page.goBack()
    await transition.waitFor({ state: 'visible' })
    await page.locator('.home-editorial').waitFor()
    await transition.waitFor({ state: 'hidden' })
    assert.equal(new URL(page.url()).pathname, new URL(url('home/')).pathname)
    assert.equal(await page.locator('dialog:modal').count(), 0)
    assert.equal(await page.locator('.nav-shell').count(), 1)
    assert.equal(await page.locator('#site-footer').count(), 1)
    await page.getByRole('button', { name: '搜索站内内容', exact: true }).click()
    await page.getByRole('combobox', { name: '搜索站内内容', exact: true }).waitFor()
    assert.equal(await page.locator('.site-search-dialog').count(), 1, 'The returned homepage accepts input through the shared navigation')
  })

  assert.deepEqual(failures, [], 'Homepage browser checks failed')
  return checks
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright').catch(() => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'))
  const browser = await chromium.launch(process.env.HOME_EDITORIAL_BROWSER_EXECUTABLE
    ? { executablePath: process.env.HOME_EDITORIAL_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.HOME_EDITORIAL_BROWSER_CHANNEL || 'msedge', headless: true })
  try {
    const checks = await runHomeEditorialChecks(browser, process.env.HOME_EDITORIAL_TEST_URL || 'http://127.0.0.1:5173/', console.log)
    console.log(`${checks.length} home editorial checks passed`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
