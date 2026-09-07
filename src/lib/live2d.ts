import type { Application } from 'pixi.js'
import type { Cubism4InternalModel, Live2DModel } from 'pixi-live2d-display/cubism4'

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
  contains: (x: number, y: number) => boolean
  greet: () => void
}

export async function createLive2DScene(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  signal: AbortSignal,
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
  let destroyed = false
  const destroy = () => {
    if (destroyed) return
    destroyed = true
    observer?.disconnect()
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
      width: container.clientWidth || 200,
      height: container.clientHeight || 280,
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
      { autoInteract: false, autoUpdate: false, motionPreload: MotionPreloadStrategy.IDLE },
    ) as Live2DModel<Cubism4InternalModel>
    if (signal.aborted) {
      loadedModel.destroy({ children: true, texture: true, baseTexture: true })
      signal.throwIfAborted()
    }
    model = loadedModel
    const currentApp = app
    const currentModel = model
    const internal = model.internalModel
    app.stage.addChild(model)
    // This model includes its own blinking and breathing in the idle motion.
    await model.motion('Idle', 0)
    signal.throwIfAborted()
    model.update(0)
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
      currentModel.position.set(
        (width - (right - left) * scale) / 2 - left * scale,
        height - 8 - bottom * scale,
      )
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
        if (pixels[(y * canvas.width + x) * 4 + 3] < 24) continue
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

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pause = (paused: boolean) => {
      if (destroyed) return
      if (paused || reducedMotion.matches) currentApp.stop()
      else currentApp.start()
    }
    pause(document.hidden)

    return {
      destroy,
      pause,
      focus(x, y) {
        if (destroyed || reducedMotion.matches) return
        // Normalize against the viewport so tracking stays gentle outside the small canvas.
        internal.focusController.focus(x * 0.65, y * 0.45)
      },
      contains(x, y) {
        const point = currentModel.toLocal({ x, y })
        return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
      },
      greet() {
        if (!destroyed && !reducedMotion.matches) void currentModel.motion('Tap', 0)
      },
    }
  } catch (error) {
    destroy()
    throw error
  }
}
