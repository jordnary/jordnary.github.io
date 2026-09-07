import { Application } from 'pixi.js'
import type { Cubism4InternalModel, Live2DModel as Model } from 'pixi-live2d-display/cubism4'
import { createLive2DScene } from '../src/lib/live2d'
import { companionMotions } from '../src/lib/companion-behavior'

// Verify full idle coverage and stable framing through the real motions.
const script = document.createElement('script')
script.src = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
await new Promise<void>((resolve, reject) => { script.onload = () => resolve(); script.onerror = reject; document.head.append(script) })
const { Live2DModel } = await import('pixi-live2d-display/cubism4')
const originalRender = Application.prototype.render
const originalMotion = Live2DModel.prototype.motion
const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
const captured: { app?: Application; model?: Model<Cubism4InternalModel> } = {}
Application.prototype.render = function () { captured.app = this; return originalRender.call(this) }
Live2DModel.prototype.motion = function (...args) {
  captured.model = this as Model<Cubism4InternalModel>
  return originalMotion.apply(this, args)
}
const container = document.querySelector<HTMLElement>('#fixture')!
const report: string[] = []
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const check = (condition: boolean, label: string) => {
  report.push(`${condition ? 'PASS' : 'FAIL'}: ${label}`)
  document.querySelector('#result')!.textContent = report.join('\n')
  if (!condition) throw new Error(label)
}
let activeScene: Awaited<ReturnType<typeof createLive2DScene>> | undefined
try {
  for (const resolution of [1, 1.5, 2]) {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: resolution })
    for (const [width, height] of [[240, 336], [192, 336], [192, 220]]) {
      container.style.width = `${width}px`; container.style.height = `${height}px`
      let idle = { scale: 0, x: 0, y: 0 }
      for (const initial of ['idle', 'home']) {
        const canvas = document.createElement('canvas')
        container.replaceChildren(canvas)
        let phase = 'idle'
        activeScene = await createLive2DScene(canvas, container, new AbortController().signal, (state) => { phase = state.phase }, () => true, initial === 'home')
        const app = captured.app!, model = captured.model!
        await delay(30)
        if (initial === 'idle') {
          idle = { scale: model.scale.x, x: model.x, y: model.y }
          const canvasWidth = app.screen.width
          const offset = Number.parseFloat(canvas.style.left)
          check(canvasWidth > width && Math.abs(offset + canvasWidth - width) < 0.001,
            `${width}x${height}, DPR ${resolution}: canvas expands left while the layout and right edge stay fixed`)
          // Render into a larger probe so clipped pixels cannot hide beyond an edge.
          // Read every visible alpha value, including translucent hair and ribbons.
          const padding = 32
          app.renderer.resize(canvasWidth + padding * 2, height + padding * 2)
          model.position.set(idle.x + padding, idle.y + padding)
          const gl = (app.renderer as import('pixi.js').Renderer).gl
          const pixels = new Uint8Array(canvas.width * canvas.height * 4)
          let clipped = false
          let marginLeft = Infinity
          for (let frame = 0; frame <= 1092; frame++) {
            model.update(1000 / 30)
            app.render()
            gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
            for (let y = 0; y < canvas.height; y++) {
              for (let x = 0; x < canvas.width; x++) {
                if (!pixels[(y * canvas.width + x) * 4 + 3]) continue
                const px = x / resolution - padding
                const py = (canvas.height - 1 - y) / resolution - padding
                marginLeft = Math.min(marginLeft, px)
                clipped ||= px < 0 || px >= canvasWidth || py < 0 || py >= height
              }
            }
            if (frame % 30 === 0) await delay(0)
          }
          check(!clipped, `${width}x${height}, DPR ${resolution}: two complete idle loops fit, including translucent edges (left margin ${marginLeft.toFixed(1)}px)`)
          activeScene.destroy()
          continue
        }
        const sameFraming = () => Math.abs(model.scale.x - idle.scale) < 0.000001
          && Math.abs(model.x - idle.x) < 0.000001 && Math.abs(model.y - idle.y) < 0.000001
        const canvasWidth = app.screen.width
        const sameCanvas = () => app.screen.width === canvasWidth && app.screen.height === height
          && canvas.width === Math.round(canvasWidth * resolution) && canvas.height === Math.round(height * resolution)
        check(sameFraming() && sameCanvas(), `${width}x${height}, DPR ${resolution}: home starts at the original idle scale, position and canvas size`)
        let unchanged = true
        for (let frame = 0; frame <= Math.floor(companionMotions.home.duration / 1000 * 30); frame++) {
          if (frame) model.update(1000 / 30)
          app.render()
          unchanged &&= sameFraming() && sameCanvas()
          if (resolution === 1 && width === 240 && [0, 42, 90, 180].includes(frame)) {
            const preview = document.createElement('canvas')
            preview.width = canvasWidth; preview.height = height
            preview.getContext('2d')!.drawImage(canvas, 0, 0, canvasWidth, height)
            const figure = document.createElement('figure')
            const caption = document.createElement('figcaption')
            caption.textContent = `home at ${(frame / 30).toFixed(1)}s`
            figure.append(preview, caption)
            document.querySelector('#previews')!.append(figure)
          }
          if (frame % 30 === 0) await delay(0)
        }
        check(unchanged, `${width}x${height}, DPR ${resolution}: all 183 home frames retain the same framing`)
        activeScene.pause(false)
        const deadline = performance.now() + 2500
        while (phase !== 'idle' && performance.now() < deadline) await delay(50)
        check(phase === 'idle' && sameFraming() && sameCanvas(), `${width}x${height}, DPR ${resolution}: home joins idle without any scaling or layout change`)
        activeScene.destroy()
      }
    }
  }
  document.querySelector('#result')!.textContent = `${report.length} checks passed\n${report.join('\n')}`
} catch (error) {
  document.querySelector('#result')!.textContent = `${report.join('\n')}\nFailed: ${error instanceof Error ? error.message : 'Framing regression failed'}`
} finally {
  activeScene?.destroy()
  Application.prototype.render = originalRender
  Live2DModel.prototype.motion = originalMotion
  if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr)
  else Reflect.deleteProperty(window, 'devicePixelRatio')
}
