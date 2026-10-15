import assert from 'node:assert/strict'
import { projects } from '../src/data/projects.ts'

const previewSelector = '.archive-preview'
const imageSelector = '.archive-preview-image'

async function moveToProject(page, project) {
  const bounds = await page.locator(`#${project.id} .archive-project-link`).boundingBox()
  assert.ok(bounds, `${project.id}: the project link has a pointer target`)
  await page.mouse.move(bounds.x + Math.min(24, bounds.width / 2), bounds.y + Math.min(16, bounds.height / 2))
}

async function waitForPreview(page, project) {
  await page.waitForFunction(id => {
    const preview = document.querySelector('.archive-preview')
    const images = preview?.querySelectorAll('.archive-preview-image')
    return preview?.dataset.state === 'visible' && preview.classList.contains('is-visible')
      && images.length === 1 && images[0].dataset.active === 'true'
      && images[0].dataset.projectId === id && images[0].complete && images[0].naturalWidth > 0
  }, project.id)
}

async function waitForHidden(page) {
  await page.waitForFunction(() => {
    const preview = document.querySelector('.archive-preview')
    return preview?.dataset.state === 'hidden' && !preview.classList.contains('is-visible')
      && preview.querySelectorAll('.archive-preview-image').length === 0
  })
}

async function waitForSwitch(page, project) {
  await page.waitForFunction(id => {
    const preview = document.querySelector('.archive-preview')
    return preview?.dataset.state === 'switching'
      && preview.querySelector('.archive-preview-image[data-active="true"]')?.dataset.projectId === id
  }, project.id)
}

async function nextFrames(page, count = 2) {
  await page.evaluate(async count => {
    for (let index = 0; index < count; index++) await new Promise(requestAnimationFrame)
  }, count)
}

async function recordPreview(page) {
  const recorder = await page.evaluateHandle(() => {
    const samples = []
    let frame
    const sample = () => {
      const preview = document.querySelector('.archive-preview')
      samples.push({
        state: preview?.dataset.state,
        clip: preview && getComputedStyle(preview).clipPath,
        layers: [...(preview?.querySelectorAll('.archive-preview-image') ?? [])].map(image => ({
          id: image.dataset.projectId,
          active: image.dataset.active === 'true',
          clip: getComputedStyle(image.closest('.archive-preview-layer') ?? image).clipPath,
        })),
      })
      frame = requestAnimationFrame(sample)
    }
    sample()
    return { stop: () => { cancelAnimationFrame(frame); sample(); cancelAnimationFrame(frame); return samples } }
  })
  return async () => {
    try { return await recorder.evaluate(recorder => recorder.stop()) }
    finally { await recorder.dispose() }
  }
}

async function rememberAnimations(page) {
  return page.locator(previewSelector).evaluateHandle(element => ({
    finished: Promise.allSettled(element.getAnimations({ subtree: true }).map(animation => animation.finished)),
  }))
}

async function waitForRememberedAnimations(page, animations) {
  try { await animations.evaluate(async animations => { await animations.finished }) }
  finally { await animations.dispose() }
  await nextFrames(page)
}

function verticalEdges(clip) {
  if (!clip?.startsWith('polygon(')) return null
  const coordinates = [...clip.matchAll(/(-?\d+(?:\.\d+)?)(%|px)?/g)].map(match => Number(match[1]))
  const heights = coordinates.filter((_, index) => index % 2 === 1)
  return heights.length >= 4 ? { top: Math.min(...heights), bottom: Math.max(...heights), heights } : null
}

function assertUpwardWipe(samples, phase, edge) {
  const frames = samples.filter(sample => sample.state === phase)
  const edges = frames.map(sample => verticalEdges(sample.clip)).filter(Boolean)
  assert.ok(edges.length > 2, `${phase}: several polygon clipping frames are observable`)
  assert.ok(edges[0][edge] - edges.at(-1)[edge] > 25, `${phase}: the clipping edge travels upward`)
  assert.ok(edges.some(({ heights }) => Math.abs(heights[0] - heights[1]) > 0.1
    || Math.abs(heights[2] - heights[3]) > 0.1), `${phase}: the moving edge has a visible diagonal`)
}

function assertSettledSelection(samples, project) {
  assert.ok(samples.every(sample => sample.layers.filter(layer => layer.active).length <= 1), 'Only one image owns the active state')
  const final = samples.at(-1)
  assert.equal(final.state, 'visible')
  assert.deepEqual(final.layers.map(layer => [layer.id, layer.active]), [[project.id, true]], 'Completed transitions retain only the latest image')
}

async function withTimeout(promise, message) {
  let timer
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), 10000)
    })])
  } finally { clearTimeout(timer) }
}

export async function runProjectPreviewChecks(page, { url, waitForProjects, report }) {
  const [first, second, third] = projects
  await page.mouse.move(1, 1)
  await page.evaluate(() => document.activeElement?.blur())
  await waitForHidden(page)
  await page.evaluate(async sources => {
    await Promise.all(sources.map(async src => {
      const image = new Image()
      image.src = src
      await image.decode()
    }))
  }, [first, second, third].map(project => url(`images/projects/${(project.image.cover ?? project.image).file}`)))

  let stopRecording = await recordPreview(page)
  await moveToProject(page, first)
  await waitForPreview(page, first)
  let samples = await stopRecording()
  assertUpwardWipe(samples, 'entering', 'top')
  stopRecording = await recordPreview(page)
  await page.mouse.move(1, 1)
  await waitForHidden(page)
  samples = await stopRecording()
  assertUpwardWipe(samples, 'leaving', 'bottom')
  report('A real pointer reveals and dismisses the poster with an upward diagonal wipe, leaving no hidden images')

  await moveToProject(page, first)
  await waitForPreview(page, first)
  stopRecording = await recordPreview(page)
  await moveToProject(page, second)
  await waitForPreview(page, second)
  samples = await stopRecording()
  const switching = samples.filter(sample => sample.state === 'switching')
  assert.ok(switching.length > 2, 'A project change has intermediate switching frames')
  assert.ok(switching.every(sample => sample.layers.some(layer => layer.id === first.id)
    && sample.layers.some(layer => layer.id === second.id && layer.active)), 'The previous poster stays beneath the incoming poster')
  assert.ok(switching.every(sample => {
    const clip = sample.layers.find(layer => layer.id === first.id)?.clip
    const edges = verticalEdges(clip)
    return clip === 'none' || edges && edges.top <= 0.1 && edges.bottom >= 99.9
  }), 'The retained poster remains fully revealed during the incoming wipe')
  assertUpwardWipe(switching.map(sample => ({
    ...sample, clip: sample.layers.find(layer => layer.id === second.id)?.clip,
  })), 'switching', 'top')
  assertSettledSelection(samples, second)
  report('Project switching keeps the previous poster mounted while the new layer wipes over it, then removes the previous layer')

  await moveToProject(page, first)
  await waitForPreview(page, first)
  stopRecording = await recordPreview(page)
  for (const project of [second, third, first]) {
    await moveToProject(page, project)
    await waitForSwitch(page, project)
    await nextFrames(page)
  }
  await waitForPreview(page, first)
  samples = await stopRecording()
  assert.ok(samples.every(sample => sample.layers.length > 0), 'Rapid project changes never expose an empty preview')
  assertSettledSelection(samples, first)
  stopRecording = await recordPreview(page)
  await page.mouse.move(1, 1)
  await page.waitForFunction(() => document.querySelector('.archive-preview')?.dataset.state === 'leaving')
  await page.waitForFunction(() => document.querySelector('.archive-preview').getAnimations().some(animation => {
    const progress = animation.effect.getComputedTiming().progress
    return progress > 0.1 && progress < 0.9
  }))
  await moveToProject(page, first)
  await waitForPreview(page, first)
  samples = await stopRecording()
  assert.ok(samples.every(sample => sample.layers.length > 0), 'Re-entering during dismissal does not discard the current image')
  assertSettledSelection(samples, first)
  report('Rapid A to B to C to A movement and re-entry during dismissal settle on one current poster without blank frames')

  await moveToProject(page, second)
  await waitForSwitch(page, second)
  let interruptedAnimations = await rememberAnimations(page)
  await page.getByRole('group', { name: 'Filter projects' }).getByRole('button', { name: 'Web', exact: true }).click()
  await waitForProjects(page, projects.filter(project => project.category === 'Web 应用'))
  await waitForHidden(page)
  stopRecording = await recordPreview(page)
  await waitForRememberedAnimations(page, interruptedAnimations)
  samples = await stopRecording()
  assert.ok(samples.every(sample => sample.state === 'hidden' && sample.layers.length === 0), 'A category change cannot revive an interrupted preview')
  await page.getByRole('group', { name: 'Filter projects' }).getByRole('button', { name: 'All', exact: true }).click()
  await waitForProjects(page)
  await moveToProject(page, first)
  await waitForPreview(page, first)
  await moveToProject(page, second)
  await waitForSwitch(page, second)
  interruptedAnimations = await rememberAnimations(page)
  await page.getByRole('button', { name: 'Open menu', exact: true }).click()
  await page.getByRole('dialog', { name: 'Site navigation' }).waitFor({ state: 'visible' })
  await waitForHidden(page)
  stopRecording = await recordPreview(page)
  await waitForRememberedAnimations(page, interruptedAnimations)
  samples = await stopRecording()
  assert.ok(samples.every(sample => sample.state === 'hidden' && sample.layers.length === 0), 'Opening the menu cannot revive an interrupted preview')
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Site navigation' }).waitFor({ state: 'hidden' })
  report('Filtering and opening the menu clear interrupted preview transitions without stale images returning')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  try {
    for (const project of [first, second]) {
      stopRecording = await recordPreview(page)
      await moveToProject(page, project)
      await waitForPreview(page, project)
      samples = await stopRecording()
      assert.ok(samples.every(sample => ['hidden', 'visible'].includes(sample.state)), 'Reduced motion skips transitional preview states')
      assert.equal(await page.locator(previewSelector).evaluate(element =>
        element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0)
    }
    await page.mouse.move(1, 1)
    await waitForHidden(page)
  } finally { await page.emulateMedia({ reducedMotion: 'no-preference' }) }
  report('Reduced motion shows the current poster immediately and removes it without running preview animations')

  const delayedFile = (second.image.cover ?? second.image).file
  const delayedPattern = `**/images/projects/${delayedFile}`
  let release
  let requested
  const held = new Promise(resolve => { release = resolve })
  const requestStarted = new Promise(resolve => { requested = resolve })
  const delayImage = async route => {
    requested()
    await held
    await route.continue()
  }
  await page.route(delayedPattern, delayImage)
  try {
    await page.goto(url('projects/'), { waitUntil: 'domcontentloaded' })
    await waitForProjects(page)
    await moveToProject(page, second)
    await withTimeout(requestStarted, 'The cold poster request was not intercepted')
    await page.mouse.move(1, 1)
    await waitForHidden(page)
    await moveToProject(page, third)
    await waitForPreview(page, third)
    stopRecording = await recordPreview(page)
    const response = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/images/projects/${delayedFile}`))
    release()
    await (await response).finished()
    await page.evaluate(async src => {
      const image = new Image()
      image.src = src
      await image.decode()
    }, url(`images/projects/${delayedFile}`))
    await nextFrames(page)
    samples = await stopRecording()
    assert.ok(samples.every(sample => sample.layers.every(layer => layer.id === third.id)), 'A late image response never replaces the latest hovered project')
    assertSettledSelection(samples, third)
    await page.mouse.move(1, 1)
    await waitForHidden(page)
    assert.equal(await page.locator(`${previewSelector} ${imageSelector}`).count(), 0)
    report('Leaving a cold-loading poster cancels its reveal; a late response cannot replace a newer project')
  } finally {
    release()
    await page.unroute(delayedPattern, delayImage)
  }
}
