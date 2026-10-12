import type { CSSProperties } from 'react'

type DraftStroke = {
  id: string
  d: string
  delay: number
  duration: number
  width?: number
}

// Individual strokes follow the reference's construction order. The shared
// coordinate transform keeps every line aligned with the finished illustration.
const strokes: DraftStroke[] = [
  { id: 'ground', d: 'M99 629H1428', delay: 0.3, duration: 0.9, width: 0.9 },
  { id: 'stair-wall', d: 'M170 629V521H325', delay: 0.4, duration: 0.56 },
  { id: 'stair-post', d: 'M189 629V521', delay: 0.48, duration: 0.38 },
  { id: 'stair-landing', d: 'M189 549H413', delay: 0.56, duration: 0.44 },
  { id: 'stair-return', d: 'M208 549V521', delay: 0.6, duration: 0.25 },
  ...[560, 570, 580, 590, 600, 610, 619].map((y, index) => ({
    id: `stair-tread-${index}`,
    d: `M194 ${y}H413`,
    delay: 0.58 + index * 0.055,
    duration: 0.48,
    width: 0.8,
  })),
  { id: 'left-wall-outer', d: 'M325 521V91H484', delay: 0.74, duration: 0.86 },
  { id: 'left-wall-inner', d: 'M340 521V100H484', delay: 0.92, duration: 0.84 },
  { id: 'left-column-outer', d: 'M484 629V96H502', delay: 1.08, duration: 0.84 },
  { id: 'left-column-inner', d: 'M502 629V100H550V132', delay: 1.25, duration: 0.82 },
  { id: 'left-panel-bottom', d: 'M340 273H484', delay: 1.19, duration: 0.48 },
  { id: 'left-floor-upper', d: 'M340 318H484', delay: 1.32, duration: 0.48 },
  { id: 'left-floor-lower', d: 'M340 342H484', delay: 1.43, duration: 0.48 },
  { id: 'left-base', d: 'M413 629V472H484', delay: 1.48, duration: 0.6 },
  { id: 'left-base-center', d: 'M502 472H641', delay: 1.64, duration: 0.45 },
  { id: 'upper-beam-left', d: 'M502 132H641', delay: 1.45, duration: 0.5 },
  { id: 'upper-beam-left-edge', d: 'M502 151H641', delay: 1.51, duration: 0.5 },
  { id: 'upper-beam-left-bottom', d: 'M502 158H641', delay: 1.56, duration: 0.5 },
  { id: 'floor-left', d: 'M502 317H641', delay: 1.58, duration: 0.5 },
  { id: 'floor-left-edge', d: 'M502 337H641', delay: 1.66, duration: 0.5 },
  { id: 'floor-left-bottom', d: 'M502 346H641', delay: 1.72, duration: 0.5 },
  { id: 'central-column-left', d: 'M641 523V71H656V508', delay: 1.68, duration: 0.9 },
  { id: 'central-beam-top', d: 'M656 132H873', delay: 1.84, duration: 0.56 },
  { id: 'central-beam-edge', d: 'M656 151H873', delay: 1.9, duration: 0.56 },
  { id: 'central-beam-bottom', d: 'M656 158H873', delay: 1.96, duration: 0.56 },
  { id: 'central-floor-top', d: 'M656 317H873', delay: 2.03, duration: 0.56 },
  { id: 'central-floor-bottom', d: 'M656 346H873', delay: 2.11, duration: 0.56 },
  { id: 'upper-window-left', d: 'M575 313V158', delay: 1.84, duration: 0.65 },
  { id: 'lower-window-left', d: 'M575 471V346', delay: 2.03, duration: 0.58 },
  ...[705, 763, 822].flatMap((x, index) => [
    { id: `upper-window-${index}`, d: `M${x} 313V158`, delay: 2.13 + index * 0.16, duration: 0.62, width: 0.85 },
    { id: `lower-window-${index}`, d: `M${x} 502V351`, delay: 2.33 + index * 0.16, duration: 0.62, width: 0.85 },
  ]),
  { id: 'central-column-right', d: 'M873 508V71H888V523', delay: 2.56, duration: 0.9 },
  { id: 'central-sill-inner', d: 'M656 508H873', delay: 2.65, duration: 0.55 },
  { id: 'central-sill-outer', d: 'M641 523H888', delay: 2.73, duration: 0.55 },
  { id: 'upper-beam-right', d: 'M888 132H1028', delay: 2.79, duration: 0.5 },
  { id: 'upper-beam-right-edge', d: 'M888 151H1028', delay: 2.85, duration: 0.5 },
  { id: 'upper-beam-right-bottom', d: 'M888 158H1028', delay: 2.91, duration: 0.5 },
  { id: 'floor-right-top', d: 'M888 317H1028', delay: 2.96, duration: 0.5 },
  { id: 'floor-right-bottom', d: 'M888 346H1028', delay: 3.02, duration: 0.5 },
  { id: 'upper-window-right', d: 'M954 273V158', delay: 2.98, duration: 0.56, width: 0.85 },
  { id: 'upper-window-right-sill', d: 'M888 273H1028', delay: 3.11, duration: 0.5 },
  { id: 'lower-window-right', d: 'M954 471V346', delay: 3.14, duration: 0.58, width: 0.85 },
  { id: 'right-column-inner', d: 'M1028 629V88H1047', delay: 3.08, duration: 0.86 },
  { id: 'right-column-outer', d: 'M1047 629V99H1191', delay: 3.25, duration: 0.86 },
  { id: 'right-roof-return', d: 'M980 132V99H1028', delay: 3.27, duration: 0.46 },
  { id: 'right-wall-outer', d: 'M1191 99H1206V521', delay: 3.48, duration: 0.84 },
  { id: 'right-wall-inner', d: 'M1191 104V521', delay: 3.59, duration: 0.76 },
  { id: 'right-panel-bottom', d: 'M1047 273H1191', delay: 3.54, duration: 0.5 },
  { id: 'right-floor-top', d: 'M1047 318H1191', delay: 3.68, duration: 0.5 },
  { id: 'right-floor-bottom', d: 'M1047 342H1191', delay: 3.79, duration: 0.5 },
  { id: 'right-base-center', d: 'M888 472H1028', delay: 3.78, duration: 0.5 },
  { id: 'right-base-wall', d: 'M1047 472H1116V629', delay: 3.91, duration: 0.64 },
  { id: 'right-landscape-base', d: 'M1116 521H1358V629', delay: 4.08, duration: 0.72 },
]

export function LearningCoverOutline() {
  return (
    <svg className="learning-cover-panorama learning-cover-outline" viewBox="0 0 1440 800" fill="none" aria-hidden="true">
      <g transform="translate(0 69.401929) scale(0.926045016)" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {strokes.map(({ id, d, delay, duration, width = 1.05 }) => (
          <path
            key={id}
            d={d}
            pathLength={1}
            className="learning-cover-stroke"
            strokeWidth={width}
            style={{ '--stroke-delay': `${delay}s`, '--stroke-duration': `${duration}s` } as CSSProperties}
          />
        ))}
      </g>
    </svg>
  )
}
