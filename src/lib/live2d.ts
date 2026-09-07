import type { Application } from 'pixi.js'
import type { Cubism4InternalModel, Live2DModel } from 'pixi-live2d-display/cubism4'
import { createCompanionBehavior, type CompanionReaction, type CompanionState } from './companion-behavior'
import { createCompanionHitTest, hitAlphaThreshold, type CompanionHit } from './live2d-hit'

const coreUrl = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
let corePromise: Promise<void> | undefined

function loadCore() {
  if ('Live2DCubismCore' in window) return Promise.resolve()
  if (corePromise) return corePromise

  corePromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => finish(false), 15000)
    const finish = (success: boolean) => {
      window.clearTimeout(timeout)
      script.onload = null
      script.onerror = null
      if (success) {
        resolve()
      } else {
        script.remove()
        corePromise = undefined
        reject(new Error('Live2D runtime unavailable'))
      }
    }
    script.src = coreUrl
    script.async = true
    script.onload = () => finish('Live2DCubismCore' in window)
    script.onerror = () => finish(false)
    document.head.append(script)
  })
  return corePromise
}

export type Live2DScene = {
  destroy: () => void
  focus: (x: number, y: number) => void
  pause: (paused: boolean) => void
  hitTest: (x: number, y: number) => CompanionHit
  react: (reaction: CompanionReaction) => boolean
  setChatEnabled: (enabled: boolean) => void
}

export async function createLive2DScene(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  signal: AbortSignal,
  onState: (state: CompanionState) => void = () => {},
  initiallyPaused: () => boolean = () => document.hidden,
  playHome = false,
): Promise<Live2DScene> {
  await loadCore()
  signal.throwIfAborted()
  const [{ Application }, { Live2DModel, MotionPreloadStrategy }] = await Promise.all([
    import('pixi.js'),
    import('pixi-live2d-display/cubism4'),
  ])
  signal.throwIfAborted()

  let app: Application | undefined
  let model: Live2DModel<Cubism4InternalModel> | undefined
  let observer: ResizeObserver | undefined
  let behavior: ReturnType<typeof createCompanionBehavior> | undefined
  let entranceTimeout = 0
  let destroyed = false
  const destroy = () => {
    if (destroyed) return
    destroyed = true
    window.clearTimeout(entranceTimeout)
    observer?.disconnect()
    behavior?.destroy()
    // Stop the ticker immediately, including when unmounted during a model fetch.
    app?.stop()
    model?.destroy({ children: true, texture: true, baseTexture: true })
    app?.destroy(false)
    signal.removeEventListener('abort', destroy)
  }

  try {
    app = new Application({
      view: canvas,
      // Search can hide the widget while its resources are still arriving.
      width: container.clientWidth || 320,
      height: container.clientHeight || 440,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoStart: false,
      sharedTicker: false,
    })
    signal.addEventListener('abort', destroy, { once: true })
    const loadedModel = await Live2DModel.from(
      `${import.meta.env.BASE_URL}live2d/vampire/model.model3.json`,
      { autoInteract: false, autoUpdate: false, motionPreload: MotionPreloadStrategy.IDLE, idleMotionGroup: 'idle' },
    ) as Live2DModel<Cubism4InternalModel>
    if (signal.aborted) {
      loadedModel.destroy({ children: true, texture: true, baseTexture: true })
      signal.throwIfAborted()
    }
    model = loadedModel
    const currentApp = app
    const currentModel = model
    const internal = model.internalModel
    const manager = internal.motionManager
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    app.stage.addChild(model)
    // Preload idle for recovery, but never start it ahead of the entrance.
    const idleMotion = await manager.loadMotion('idle', 0)
    idleMotion?.setFadeInTime(0.45)
    signal.throwIfAborted()
    const homeMotion = !playHome || reducedMotion.matches ? undefined : await Promise.race([
      manager.loadMotion('home', 0).catch(() => undefined),
      new Promise<undefined>((resolve) => { entranceTimeout = window.setTimeout(resolve, 8000) }),
    ])
    window.clearTimeout(entranceTimeout)
    signal.throwIfAborted()
    homeMotion?.setIsLoop(false)
    // The first visible pose belongs entirely to home, without blending from idle.
    homeMotion?.setFadeInTime(0)
    let entrancePending = !!homeMotion && !reducedMotion.matches && await model.motion('home', 0, 3)
    if (!entrancePending) await model.motion('idle', 0, 3)
    signal.throwIfAborted()
    model.update(1)
    app.render()

    // Fit the visible artwork, excluding the empty canvas around the exported model.
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    internal.getDrawableIDs().forEach((_, index) => {
      if (internal.coreModel.getDrawableOpacity(index) < 0.05) return
      const vertices = internal.getDrawableVertices(index)
      for (let i = 0; i < vertices.length; i += 2) {
        left = Math.min(left, vertices[i])
        right = Math.max(right, vertices[i])
        top = Math.min(top, vertices[i + 1])
        bottom = Math.max(bottom, vertices[i + 1])
      }
    })
    if (!Number.isFinite(left) || right <= left || bottom <= top) {
      left = top = 0
      right = internal.width
      bottom = internal.height
    }

    const resize = () => {
      if (destroyed) return
      const width = container.clientWidth || currentApp.screen.width
      const height = container.clientHeight || currentApp.screen.height
      currentApp.renderer.resize(width, height)
      const scale = Math.min((width - 16) / (right - left), (height - 16) / (bottom - top))
      currentModel.scale.set(scale)
      // Keep spare canvas space on the left when the window height limits the model.
      currentModel.position.set(
        width - 8 - right * scale,
        height - 8 - bottom * scale,
      )
      // Anchor the bubble to visible artwork, including the export's transparent padding.
      const stage = container.parentElement
      stage?.style.setProperty('--companion-artwork-top', `${currentModel.y + top * scale}px`)
      stage?.style.setProperty('--companion-artwork-center', `${currentModel.x + (left + right) * scale / 2}px`)
      stage?.style.setProperty('--companion-artwork-width', `${(right - left) * scale}px`)
      currentApp.render()
    }
    resize()

    // Some exported meshes include large transparent regions. Measure the rendered
    // alpha once so those regions do not shrink the character to a tiny thumbnail.
    if (!('gl' in app.renderer)) throw new Error('Live2D requires WebGL')
    const gl = app.renderer.gl
    const pixels = new Uint8Array(canvas.width * canvas.height * 4)
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let pixelLeft = canvas.width
    let pixelRight = -1
    let pixelTop = canvas.height
    let pixelBottom = -1
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < hitAlphaThreshold) continue
        pixelLeft = Math.min(pixelLeft, x)
        pixelRight = Math.max(pixelRight, x)
        pixelTop = Math.min(pixelTop, canvas.height - 1 - y)
        pixelBottom = Math.max(pixelBottom, canvas.height - 1 - y)
      }
    }
    if (pixelRight > pixelLeft && pixelBottom > pixelTop) {
      const resolution = app.renderer.resolution
      const scale = model.scale.x
      left = (pixelLeft / resolution - model.x) / scale
      right = ((pixelRight + 1) / resolution - model.x) / scale
      top = (pixelTop / resolution - model.y) / scale
      bottom = ((pixelBottom + 1) / resolution - model.y) / scale
      resize()
    }
    observer = new ResizeObserver(resize)
    observer.observe(container)
    app.ticker.maxFPS = 30
    app.ticker.add(() => currentModel.update(Math.min(currentApp.ticker.deltaMS, 100)))

    const hit = createCompanionHitTest(currentApp, currentModel, canvas)
    let paused = initiallyPaused()
    let chatEnabled = false
    let wasReduced = reducedMotion.matches
    behavior = createCompanionBehavior({
      async prepare(reaction) {
        const motion = await manager.loadMotion(reaction, 0)
        if (!motion || destroyed) return false
        motion.setIsLoop(false)
        return true
      },
      play: (reaction) => currentModel.motion(reaction, 0, 3),
      idle() {
        if (destroyed) return
        manager.stopAllMotions()
        internal.focusController.focus(0, 0, true)
        void currentModel.motion('idle', 0, 3)
      },
      reducedMotion: () => reducedMotion.matches,
      change(state) {
        if (state.phase === 'noticing') internal.focusController.focus(0, 0)
        // Let the authored response own head, eye and body parameters completely.
        if (state.phase === 'responding' || state.phase === 'recovering') internal.focusController.focus(0, 0, true)
        onState(state)
      },
    })
    manager.on('motionFinish', () => behavior?.finish())
    const pause = (next: boolean) => {
      if (destroyed) return
      if (entrancePending && !reducedMotion.matches) {
        // Loading behind search, a toast or a background tab keeps home frozen
        // at its first frame; its recovery timer starts only when actually shown.
        if (!next) {
          entrancePending = false
          behavior?.enter()
        }
      } else if (next !== paused || wasReduced !== reducedMotion.matches) {
        entrancePending = false
        behavior?.reset()
      }
      paused = next
      wasReduced = reducedMotion.matches
      behavior?.setAutoplay(chatEnabled && !paused)
      if (paused || reducedMotion.matches) currentApp.stop()
      else currentApp.start()
    }
    pause(initiallyPaused())

    return {
      destroy,
      pause,
      focus(x, y) {
        if (destroyed || paused || reducedMotion.matches || behavior?.state.phase !== 'idle') return
        // Normalize against the viewport so tracking stays gentle outside the small canvas.
        internal.focusController.focus(x * 0.65, y * 0.45)
      },
      hitTest(x, y) {
        return destroyed || paused ? null : hit.hitTest(x, y)
      },
      react(reaction) {
        return !destroyed && !paused && (behavior?.request(reaction) ?? false)
      },
      setChatEnabled(enabled) {
        if (destroyed || enabled === chatEnabled) return
        chatEnabled = enabled
        if (!enabled) behavior?.reset()
        behavior?.setAutoplay(enabled && !paused)
      },
    }
  } catch (error) {
    destroy()
    throw error
  }
}
