import Matter from 'matter-js'

const { Bodies, Body, Composite, Engine, Sleeping, Vertices } = Matter
const rad = Math.PI / 180
const physicsStep = 1000 / 120
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

// Keep the drawing and its collision surfaces in the same glyph coordinates.
// The four has four convex strokes; its crossbar and toe
// can each catch the floor or another digit.
export const four = 'M4 -362H119V0H199V102H119V243H3V102H-255V-10ZM0 -204V0H-155Z'
export const zero = 'M0 -315C146 -315 223 -211 223 0S146 315 0 315S-223 211 -223 0S-146 -315 0 -315ZM0 -213C73 -213 100 -157 100 0S73 213 0 213S-100 157 -100 0S-73 -213 0 -213Z'

function polygon(points: number[][]) {
  const vertices = points.map(([x, y]) => ({ x, y }))
  return Body.create({ vertices, position: Vertices.centre(vertices) })
}

function makeFour() {
  return Body.create({ parts: [
    polygon([[4, -362], [119, -362], [119, 0], [0, 0], [0, -204]]),
    polygon([[4, -362], [0, -204], [-155, 0], [-255, 0], [-255, -10]]),
    Bodies.rectangle(-28, 51, 454, 102), Bodies.rectangle(61, 172.5, 116, 141),
  ] })
}

function makeZero() {
  // Sample the outer Bézier, including the flat shoulders that let it settle
  // on its side. The enclosed counter doesn't take part in external contacts.
  const quarter = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10, u = 1 - t
    return { x: 3*u*u*t*146 + 3*u*t*t*223 + t*t*t*223,
      y: -315*(u*u*u + 3*u*u*t) - 211*3*u*t*t }
  })
  const vertices = [quarter, quarter.toReversed().map(p => ({ x: p.x, y: -p.y })),
    quarter.map(p => ({ x: -p.x, y: -p.y })), quarter.toReversed().map(p => ({ x: -p.x, y: p.y }))]
    .flatMap(arc => arc.slice(0, -1))
  return Body.create({ vertices, density: .0007 })
}

export function createDigitScene(width: number, height: number) {
  // Glyphs and the supporting slab keep their entry size. Widening the stage
  // can uncover a gap beside the slab, allowing overhanging digits to tumble.
  const scale = Math.min(height / 1340, width / 1520)
  let w = width / scale, h = height / scale
  const supportWidth = w
  let leftX = 0, wallX = w, floorY = h, floorWidth = w, squeezeTime = 0
  const engine = Engine.create({ enableSleeping: true, positionIterations: 12, velocityIterations: 8,
    gravity: { x: 0, y: 1, scale: .0032 } })
  const above = 1800, depth = Math.max(w, h, above) * 4
  const wall = { isStatic: true, friction: .45, restitution: 0 }
  const floor = Bodies.rectangle(w / 2, h + depth / 2, w, depth, wall)
  const left = Bodies.rectangle(-depth / 2, (h - above) / 2, depth, h + above, wall)
  const right = Bodies.rectangle(w + depth / 2, (h - above) / 2, depth, h + above, wall)
  const movingEdges = () => leftX !== 0 || wallX !== w || floorY !== h
  const placeEdges = () => {
    const nextWidth = Math.min(supportWidth, wallX - leftX)
    if (nextWidth !== floorWidth) Body.scale(floor, nextWidth / floorWidth, 1)
    floorWidth = nextWidth
    Body.setPosition(floor, { x: (leftX + wallX) / 2, y: floorY + depth / 2 })
    Body.setPosition(left, { x: leftX - depth / 2, y: (h - above) / 2 })
    Body.setPosition(right, { x: wallX + depth / 2, y: (h - above) / 2 })
  }
  // The top four overhangs the zero to the left; the bottom four catches it
  // on the right. Only release conditions are chosen, never landing slots.
  const spawnX = w / 2 + Math.min(220, w * .1)
  const digits = [
    { body: makeFour(), x: spawnX - 85, y: -1380, angle: 1 },
    { body: makeZero(), x: spawnX, y: -880, angle: 130 },
    { body: makeFour(), x: spawnX + 45, y: -245, angle: 1 },
  ].map(({ body, x, y, angle }) => {
    const origin = { ...body.position }
    if (body.parts.length > 1) Body.setInertia(body, body.inertia * 1.5)
    body.friction = .25
    body.frictionAir = .016
    body.restitution = .025
    Body.translate(body, { x, y })
    Body.setAngle(body, angle * rad)
    Body.setVelocity(body, { x: 0, y: 18 })
    return { body, origin, escaped: false }
  })
  Composite.add(engine.world, [floor, left, right, ...digits.map(d => d.body)])
  return {
    digits,
    get viewBox() { return `0 0 ${w} ${h}` },
    get asleep() { return !movingEdges() && digits.every(({ body, escaped }) => escaped || body.isSleeping) },
    step() {
      if (movingEdges()) {
        // Sweep inward a few units per substep so contact normals stay local.
        // Moving a static wall must not also inject a launch velocity.
        leftX += clamp(-leftX, -10, 10)
        wallX += clamp(w - wallX, -10, 10)
        floorY += clamp(h - floorY, -10, 10)
        placeEdges()
        squeezeTime = 180
        digits.forEach(d => { if (!d.escaped) Sleeping.set(d.body, false) })
      }
      Engine.update(engine, physicsStep)
      squeezeTime = Math.max(0, squeezeTime - physicsStep)
      for (const digit of digits) {
        if (digit.escaped) continue
        if (squeezeTime > 0) {
          // Compression should lift and roll the pile, with little rebound.
          const { body } = digit
          Body.setVelocity(body, { x: clamp(body.velocity.x, -10, 10), y: Math.max(-8, body.velocity.y) })
          Body.setAngularVelocity(body, clamp(body.angularVelocity, -.045, .045))
        }
        if (digit.body.bounds.min.y > h + 630) {
          digit.escaped = true
          Composite.remove(engine.world, digit.body)
        }
      }
    },
    resize(width: number, height: number) {
      const nw = width / scale, nh = height / scale
      if (nw === w && nh === h) return
      const live = digits.filter(d => !d.escaped)
      // Measure from the simulated edges, so many small events arriving
      // faster than physics can follow receive the same protection as a jump.
      const abruptX = wallX - nw > 120 / scale
      const abruptY = floorY - nh > 100 / scale
      if (live.length && (abruptX || abruptY)) {
        // Restore/maximise can skip the entire pile in one resize event.
        // Carry the pile into the smaller frame as a group, preserving its
        // sizes, relative contacts, rotations and momentum before squeezing.
        const minX = Math.min(...live.map(d => d.body.bounds.min.x))
        const maxX = Math.max(...live.map(d => d.body.bounds.max.x))
        const centre = (minX + maxX) / 2, half = (maxX - minX) / 2
        const target = half * 2 <= nw ? clamp(centre * nw / w, half, nw - half) : nw / 2
        const dx = abruptX ? target - centre : 0
        const dy = abruptY ? nh - floorY : 0
        live.forEach(({ body }) => Body.translate(body, { x: dx, y: body.bounds.max.y > 0 ? dy : 0 }))
        if (abruptX) {
          // Start outside the carried pile, then squeeze it over successive
          // frames instead of placing a wall through several whole glyphs.
          leftX = Math.min(0, minX + dx)
          wallX = Math.max(nw, maxX + dx)
        }
        if (abruptY) floorY = nh
        squeezeTime = 180
      }
      // Outward edges withdraw immediately. Gravity and the finite support
      // surface decide which digits land, pivot at the edge, or fall away.
      if (nw > wallX) { leftX = 0; wallX = nw }
      if (nh > floorY) floorY = nh
      for (const side of [left, right]) {
        Body.scale(side, 1, (nh + above) / (h + above))
        Body.setPosition(side, { x: side === left ? leftX - depth / 2 : wallX + depth / 2, y: (nh - above) / 2 })
      }
      w = nw; h = nh
      placeEdges()
      live.forEach(d => Sleeping.set(d.body, false))
    },
    dispose() { Composite.clear(engine.world, false); Engine.clear(engine) },
  }
}

export function mountFallingDigits(svg: SVGSVGElement) {
  const paths = svg.querySelectorAll('path')
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let scene = createDigitScene(svg.clientWidth, svg.clientHeight)
  let frame = 0, last = 0, remainder = 0

  const paint = () => scene.digits.forEach(({ body, origin, escaped }, i) => {
    paths[i].style.visibility = escaped ? 'hidden' : ''
    paths[i].setAttribute('transform', `translate(${body.position.x} ${body.position.y}) rotate(${body.angle / rad}) translate(${-origin.x} ${-origin.y})`)
  })
  const tick = (now: number) => {
    remainder += Math.min(now - last, 64)
    last = now
    while (remainder >= physicsStep && !scene.asleep) { scene.step(); remainder -= physicsStep }
    if (scene.asleep) remainder = 0
    paint()
    frame = scene.asleep ? 0 : requestAnimationFrame(tick)
  }
  const sync = () => {
    if (motion.matches || document.hidden) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    if (motion.matches) {
      // Resolve the same contacts without displaying motion.
      for (let i = 0; i < 3600 && !scene.asleep; i++) scene.step()
    } else if (!document.hidden && !scene.asleep && !frame) {
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }
    svg.setAttribute('viewBox', scene.viewBox)
    paint()
  }
  const restore = (e: PageTransitionEvent) => {
    if (!e.persisted) return
    scene.dispose()
    scene = createDigitScene(svg.clientWidth, svg.clientHeight)
    remainder = 0
    sync()
  }
  const size = new ResizeObserver(() => {
    if (svg.clientWidth && svg.clientHeight) {
      scene.resize(svg.clientWidth, svg.clientHeight)
      sync()
    }
  })
  sync()
  size.observe(svg)
  window.addEventListener('pageshow', restore)
  document.addEventListener('visibilitychange', sync)
  motion.addEventListener('change', sync)
  return () => {
    size.disconnect()
    window.removeEventListener('pageshow', restore)
    document.removeEventListener('visibilitychange', sync)
    motion.removeEventListener('change', sync)
    cancelAnimationFrame(frame)
    scene.dispose()
  }
}
