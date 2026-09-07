import type { Application } from 'pixi.js'
import type { Cubism4InternalModel, Live2DModel } from 'pixi-live2d-display/cubism4'

export type CompanionHit = 'head' | 'special' | 'body' | null
export const hitAlphaThreshold = 24
// Verified against isolated drawable previews for this model: wing membranes,
// spars, trailing ribbons and held ornaments are nested among body/face parts.
const decorativeMeshes = new Set([
  'ArtMesh148', 'ArtMesh149', 'ArtMesh150', 'ArtMesh160', 'ArtMesh161', 'ArtMesh162',
  'ArtMesh190', 'ArtMesh191', 'ArtMesh238', 'ArtMesh212', 'ArtMesh213', 'ArtMesh214', 'ArtMesh215',
])

export function inMesh(x: number, y: number, vertices: Float32Array, indices: Uint16Array) {
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 2, b = indices[i + 1] * 2, c = indices[i + 2] * 2
    const cross = (p: number, q: number) => (vertices[q] - vertices[p]) * (y - vertices[p + 1]) - (vertices[q + 1] - vertices[p + 1]) * (x - vertices[p])
    const area = (vertices[b] - vertices[a]) * (vertices[c + 1] - vertices[a + 1]) - (vertices[b + 1] - vertices[a + 1]) * (vertices[c] - vertices[a])
    if (Math.abs(area) < 1e-6) continue
    const ab = cross(a, b), bc = cross(b, c), ca = cross(c, a)
    if ((ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0)) return true
  }
  return false
}

/** Pick actual rendered body parts, preserving texture alpha, deformation and masks. */
export function createCompanionHitTest(app: Application, model: Live2DModel<Cubism4InternalModel>, canvas: HTMLCanvasElement) {
  if (!('gl' in app.renderer)) throw new Error('Live2D requires WebGL')
  const gl = app.renderer.gl
  const internal = model.internalModel
  const core = internal.coreModel
  const raw = core.getModel()
  // Core 5 exposes these indices; the adapter's older declarations omit the field.
  const parents = (raw.drawables as typeof raw.drawables & { parentPartIndices?: Int32Array }).parentPartIndices
  const categories = raw.drawables.ids.map((id, index): CompanionHit => {
    if (!parents || id.startsWith('Touch') || decorativeMeshes.has(id)) return null
    let part = parents[index]
    for (let depth = 0; part >= 0 && depth < raw.parts.count; depth++) {
      const name = raw.parts.ids[part]
      // The export nests the body beneath facial parts, so the nearest root wins.
      if (name === 'shenti') return 'body'
      if (name === 'tou') return 'head'
      part = raw.parts.parentIndices[part]
    }
    return null
  })
  const headIndex = core.getDrawableIndex('TouchHead')
  const specialIndex = core.getDrawableIndex('TouchSpecial')
  const pixel = new Uint8Array(4)
  const saved = new Float32Array(raw.drawables.count)
  const local = { x: 0, y: 0 }
  const sample = (x: number, y: number) => {
    app.render()
    pixel.fill(0)
    gl.readPixels(Math.floor(x / app.screen.width * canvas.width), canvas.height - 1 - Math.floor(y / app.screen.height * canvas.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    return pixel[3] >= hitAlphaThreshold
  }
  const isolated = <T>(category: CompanionHit, read: () => T) => {
    const opacities = raw.drawables.opacities
    saved.set(opacities)
    try {
      categories.forEach((part, index) => { if (part !== category) opacities[index] = 0 })
      return read()
    } finally {
      opacities.set(saved)
      // Restore the full artwork in the same task, without advancing any parameters.
      app.render()
    }
  }
  return {
    hitTest(x: number, y: number): CompanionHit {
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= app.screen.width || y >= app.screen.height || gl.isContextLost()) return null
      if (!sample(x, y)) return null
      // Convert through both Pixi and Cubism transforms; never assume a CSS rectangle.
      model.worldTransform.applyInverse({ x, y }, local)
      internal.localTransform.applyInverse(local, local)
      if (headIndex >= 0 && inMesh(local.x, local.y, internal.getDrawableVertices(headIndex), core.getDrawableVertexIndices(headIndex))
        && isolated('head', () => sample(x, y))) return 'head'
      if (isolated('body', () => sample(x, y))) {
        if (specialIndex >= 0 && inMesh(local.x, local.y, internal.getDrawableVertices(specialIndex), core.getDrawableVertexIndices(specialIndex))) return 'special'
        return 'body'
      }
      return null
    },
    // Used only by the development fixture to inspect the exact semantic alpha masks.
    drawDebug(output: HTMLCanvasElement, category: 'head' | 'body') {
      output.width = canvas.width; output.height = canvas.height
      isolated(category, () => {
        app.render()
        output.getContext('2d')?.drawImage(canvas, 0, 0)
      })
    },
  }
}
