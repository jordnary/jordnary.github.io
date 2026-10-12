import { useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { useInView } from 'motion/react'

export type LearningGeometryKind = 'foundation' | 'network' | 'layers' | 'orbit' | 'framework' | 'assembly' | 'experiment'

function Stroke({ d, delay = 0, duration = 0.7 }: { d: string; delay?: number; duration?: number }) {
  return <path
    className="geometry-draw"
    d={d}
    pathLength={1}
    style={{ '--draw-delay': `${delay}s`, '--draw-duration': `${duration}s` } as CSSProperties}
  />
}

function Guides({ children, delay = 0.75 }: { children: ReactNode; delay?: number }) {
  return <g className="geometry-guides" style={{ '--guide-delay': `${delay}s` } as CSSProperties}>{children}</g>
}

function WireCube({ x = 160, y = 110, size = 54, delay = 0, guidesOnly = false }: { x?: number; y?: number; size?: number; delay?: number; guidesOnly?: boolean }) {
  const rise = size * 0.58
  const outline = `M${x} ${y - rise}L${x - size} ${y}V${y + size}L${x} ${y + size + rise}L${x + size} ${y + size}V${y}Z`
  const front = `M${x - size} ${y}L${x} ${y + rise}L${x + size} ${y}M${x} ${y + rise}V${y + size + rise}`
  const back = `M${x} ${y - rise}V${y + size - rise}L${x + size} ${y + size}M${x} ${y + size - rise}L${x - size} ${y + size}`
  if (guidesOnly) return <path className="geometry-hidden-edge" d={`${outline}${front}${back}`} />
  return <>
    <Stroke d={outline} delay={delay} duration={0.75} />
    <Stroke d={front} delay={delay + 0.18} duration={0.65} />
    <Guides delay={delay + 0.72}><path className="geometry-hidden-edge" d={back} /></Guides>
  </>
}

function layerSilhouette(y: number, size: number, depth: number) {
  const rise = size * 0.58
  return `M160 ${y - rise}L${160 + size} ${y}V${y + depth}L160 ${y + rise + depth}L${160 - size} ${y + depth}V${y}Z`
}

function WireLayer({ y = 112, size = 68, depth = 25, delay = 0, occludedBy }: { y?: number; size?: number; depth?: number; delay?: number; occludedBy?: string }) {
  const maskId = useId()
  const rise = size * 0.58
  return <>
    {occludedBy && <defs>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="250">
        <rect width="320" height="250" fill="white" stroke="none" />
        <path d={occludedBy} fill="black" stroke="none" />
      </mask>
    </defs>}
    <g mask={occludedBy ? `url(#${maskId})` : undefined}>
      <Stroke d={`M160 ${y - rise}L${160 - size} ${y}V${y + depth}L160 ${y + rise + depth}`} delay={delay} />
      <Stroke d={`M160 ${y - rise}L${160 + size} ${y}V${y + depth}L160 ${y + rise + depth}`} delay={delay} />
      <Stroke d={`M${160 - size} ${y}L160 ${y + rise}L${160 + size} ${y}M160 ${y + rise}V${y + rise + depth}`} delay={delay + 0.22} duration={0.55} />
      <Guides delay={delay + 0.85}>
        <path className="geometry-hidden-edge" d={`M160 ${y - rise}V${y - rise + depth}L${160 + size} ${y + depth}M160 ${y - rise + depth}L${160 - size} ${y + depth}`} />
      </Guides>
    </g>
  </>
}

const geometry: Record<LearningGeometryKind, ReactNode> = {
  foundation: <>
    <Stroke d="M140 61a20 11 0 1 0 40 0a20 11 0 1 0-40 0" duration={0.5} />
    <Stroke d="M140 61V124M180 61V124" delay={0.1} duration={0.55} />
    <WireLayer y={130} delay={0.12} occludedBy="M140 40H180V124H140Z" />
    <Stroke d="M140 183V201C140 216 180 216 180 201V183" delay={0.5} duration={0.5} />
    <Guides delay={0.95}><path className="geometry-axis" d="M160 69V199M92 155L160 116L228 155" /></Guides>
  </>,
  network: <>
    <Stroke d="M139 67a21 21 0 1 0 42 0a21 21 0 1 0-42 0" duration={0.5} />
    <Stroke d="M141.8 77.5L103 100V166L160 199L217 166V100L178.2 77.5" delay={0.08} duration={0.8} />
    <Stroke d="M103 100L160 133L217 100M160 133V199" delay={0.23} duration={0.65} />
    <Guides><path className="geometry-hidden-edge" d="M160 67V133M103 166L160 133L217 166M103 100L160 67L217 100" /></Guides>
  </>,
  layers: <>
    <WireLayer y={95} delay={0} />
    <WireLayer y={149} delay={0.4} occludedBy={layerSilhouette(95, 68, 25)} />
    <Guides delay={1.12}><path className="geometry-axis" d="M160 56V213" /></Guides>
  </>,
  orbit: <>
    <Stroke d="M80 125a80 80 0 1 1 160 0a80 80 0 1 1-160 0" duration={1} />
    <Guides delay={0.55}><path className="geometry-axis" d="M160 45V125L91 165M160 125L229 165" /></Guides>
    <Guides delay={0.85}><WireCube x={160} y={103} size={41} guidesOnly /></Guides>
  </>,
  framework: <>
    <WireLayer y={166} size={68} depth={15} delay={0} occludedBy="M160 68.84L212 99V151L160 181.16L108 151V99Z" />
    <WireCube x={160} y={99} size={52} delay={0.2} />
    <Guides delay={0.95}>
      <path className="geometry-hidden-edge" d="M108 99V60L160 30L212 60V99M108 60L160 90L212 60M160 90V129" />
      <path className="geometry-axis" d="M65 179L160 124L255 179L160 234ZM97 161L192 216M128 142L224 198M97 198L192 142M128 216L224 161" />
    </Guides>
  </>,
  assembly: <>
    <WireLayer y={72} size={48} depth={21} delay={0} />
    <WireLayer y={121} size={58} depth={21} delay={0.25} occludedBy={layerSilhouette(72, 48, 21)} />
    <WireLayer y={174} size={68} depth={15} delay={0.5} occludedBy={layerSilhouette(121, 58, 21)} />
    <Guides delay={1.2}><path className="geometry-axis" d="M112 72V174M160 44V226M208 72V174" /></Guides>
  </>,
  experiment: <>
    <Stroke d="M84 172a90 36 -32 1 1 152-94a90 36 -32 1 1-152 94" duration={0.9} />
    <g className="geometry-secondary-ring"><Stroke d="M84 78a90 36 32 1 1 152 94a90 36 32 1 1-152-94" delay={0.25} duration={0.9} /></g>
    <Guides delay={0.85}>
      <WireCube x={160} y={103} size={40} guidesOnly />
      <circle className="geometry-hidden-edge" cx="160" cy="125" r="77" />
      <path className="geometry-axis" d="M160 37V213M66 125H254" />
    </Guides>
  </>,
}

export function LearningGeometry({ kind }: { kind: LearningGeometryKind }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isVisible = useInView(svgRef, { amount: 0.2 })

  return (
    <div className="learning-panel-diagram" aria-hidden="true">
      <svg className="learning-geometry" viewBox="0 0 320 250" fill="none" ref={svgRef} data-visible={isVisible} focusable="false">
        <g className="geometry-registration"><path d="M15 18H25M20 13V23M295 18H305M300 13V23M15 232H25M20 227V237M295 232H305M300 227V237" /></g>
        <g className="geometry-object">{geometry[kind]}</g>
      </svg>
    </div>
  )
}
