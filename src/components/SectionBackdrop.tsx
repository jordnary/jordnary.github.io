import { useId } from 'react'
import { paperTear, surfaceTear } from '../lib/paper-tear'
import './SectionBackdrop.css'

export type SectionTone = 'white' | 'paper' | 'sage' | 'sky' | 'lilac'
export type SectionDecoration =
  | 'collage-left' | 'collage-right' | 'grid-right' | 'rings-right'
  | 'contour-left' | 'botanical-right' | 'fold-left' | 'halftone-right'

type SectionBackdropProps = {
  tone?: SectionTone
  edge?: 'paper' | 'arc' | 'none'
  decoration?: SectionDecoration
}

export function SectionPaperSeam({ className = '' }: { className?: string }) {
  return (
    <svg className={`section-paper-seam ${className}`} viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {/* The footer mask supplies the upper edge; everything below this rim is transparent. */}
      <g className="section-paper-seam-shadow">
        <path className="section-backdrop-paper-rim" d={`M0 0H1440V64H0Z ${surfaceTear}`} fillRule="evenodd" />
      </g>
    </svg>
  )
}

// A transparent rim lets an illustration sit behind the same tear as the backdrop.
export function SectionPaperRim({ className = '' }: { className?: string }) {
  const maskId = useId()
  return (
    <svg className={`section-backdrop-edge ${className}`} viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="64">
          <path d={paperTear} fill="white" />
          <path d={surfaceTear} fill="black" />
        </mask>
      </defs>
      <path className="section-backdrop-paper-rim" d={paperTear} mask={`url(#${maskId})`} />
    </svg>
  )
}

// Place inside a .section-surface host. The background never participates in layout.
export function SectionBackdrop({ tone = 'white', edge = 'paper', decoration }: SectionBackdropProps) {
  return (
    <div className={`section-backdrop section-backdrop--${tone}`} aria-hidden="true">
      {edge !== 'none' && (
        <svg className={`section-backdrop-edge section-backdrop-edge--${edge}`} viewBox="0 0 1440 64" preserveAspectRatio="none" focusable="false">
          {edge === 'paper' ? (
            <>
              <path className="section-backdrop-paper-shadow" d={paperTear} transform="translate(0 -2)" />
              <path className="section-backdrop-paper-rim" d={paperTear} />
              <path className="section-backdrop-fiber" d={surfaceTear} transform="translate(0 -1.8)" />
              <path d={surfaceTear} />
            </>
          ) : (
            <>
              <path className="section-backdrop-paper-rim" d="M0 22C220 46 390 0 650 13S1130 46 1440 8V64H0Z" />
              <path d="M0 42C220 62 390 23 650 35S1130 65 1440 30V64H0Z" />
            </>
          )}
        </svg>
      )}
      {decoration && <SectionAccent kind={decoration} />}
    </div>
  )
}

function SectionAccent({ kind }: { kind: SectionDecoration }) {
  if (kind === 'collage-left' || kind === 'collage-right') {
    return <PaperMargin side={kind === 'collage-left' ? 'left' : 'right'} />
  }
  const side = kind.endsWith('left') ? 'left' : 'right'
  return (
    <div className={`section-margin section-margin--compact section-margin--${side} section-margin--${kind}`}>
      <svg viewBox="0 0 180 360" fill="none" focusable="false">
        {kind === 'grid-right' && (
          <g transform="rotate(8 140 180)">
            <path className="section-margin-grid-paper" d="M72 54h122v231H72Z" />
            <g className="section-margin-grid-line">
              {Array.from({ length: 9 }, (_, i) => <path key={`v${i}`} d={`M${72 + i * 15} 54v231`} />)}
              {Array.from({ length: 16 }, (_, i) => <path key={`h${i}`} d={`M72 ${54 + i * 15}h122`} />)}
            </g>
            <path className="section-margin-ink" d="M61 48h19m-10-10v20M140 295h20m-10-10v20M87 254l29-45 26 14 34-64" />
            <circle className="section-margin-coral" cx="116" cy="209" r="6" />
          </g>
        )}
        {kind === 'rings-right' && (
          <>
            <g className="section-margin-ink">
              <circle cx="116" cy="156" r="39" /><circle cx="116" cy="156" r="31" />
              <path d="M69 146a48 48 0 0 1 66-34M161 173a48 48 0 0 1-67 26M58 144a60 60 0 0 1 26-39M170 182a60 60 0 0 1-56 34" />
              <path d="M76 240c16-9 20 10 36 2s20 10 36 2m-68 4c16-9 20 10 36 2s20 10 36 2" />
            </g>
            <path className="section-margin-coral" d="M87 120c-9-39 52 5 22 23s-40-37-14-32 27 39 6 26 26-32 14-3-37-28-14-22" />
            <path className="section-margin-trail" d="M149 60c-62-4-88 15-78 41M99 281l31 35" />
          </>
        )}
        {kind === 'contour-left' && (
          <>
            <g className="section-margin-ink">
              {Array.from({ length: 8 }, (_, i) => <path key={i} transform={`translate(${-i * 7} ${i * 6})`} d="M-25 28C94 16 143 64 101 117S155 178 101 222 127 289-16 304" />)}
              <path d="M24 74h15m-7-7v15M100 249h15m-7-7v15" />
            </g>
            <circle className="section-margin-coral" cx="98" cy="116" r="5" />
            <path className="section-margin-trail" d="m40 44 58 72-33 71 43 69" />
          </>
        )}
        {kind === 'botanical-right' && (
          <>
            <ellipse cx="156" cy="179" rx="62" ry="114" fill="var(--section-sage)" transform="rotate(16 156 179)" />
            <g className="section-margin-botanical">
              <path d="M91 316c35-57 8-135 61-257" />
              <path d="M110 253c-44-3-50-35-42-49 28 4 42 23 42 49Zm-1-45c43-5 57-32 49-51-28 8-43 25-49 51Zm9-46c-37-10-44-39-30-59 24 15 34 34 30 59Zm16-43c34-1 48-24 44-43-22 3-37 17-44 43Zm12-39c-22-13-20-40-7-54 15 18 17 34 7 54Z" />
              <path d="m68 204 42 49m-1-45 49-51m-40 5-30-59m46 16 44-43m-32 4-7-54" />
            </g>
            <path className="section-margin-trail" d="M60 297c-22-48-19-82-1-111" />
            <circle className="section-margin-coral" cx="60" cy="183" r="4" />
          </>
        )}
        {kind === 'fold-left' && (
          <>
            <path d="M-20 69 122 39 100 133-20 165Z" fill="var(--section-sky)" />
            <path d="m100 133 22-94 25 57Z" fill="#b9ced8" opacity="0.65" />
            <path d="M-20 194 147 96 123 204-20 281Z" fill="var(--section-paper)" />
            <path d="m123 204 24-108 20 62Z" fill="#d9cbb0" opacity="0.55" />
            <path d="M-20 305 167 158 123 271-20 354Z" fill="var(--section-sage)" />
            <path className="section-margin-trail" d="m-10 83 112-28m-111 155 126-76M0 312l132-105" />
            <path className="section-margin-coral" d="m100 297 13-8m-10 15 13-8m-9 14 12-7" />
          </>
        )}
        {kind === 'halftone-right' && (
          <>
            <path d="M91 52h100v100H91Z" fill="var(--section-lilac)" transform="rotate(12 141 102)" />
            <g fill="#819fae" opacity="0.5">
              {Array.from({ length: 11 }, (_, row) => Array.from({ length: 10 }, (_, col) => (
                <circle key={`${row}-${col}`} cx={55 + col * 12} cy={103 + row * 12} r={Math.max(0.6, 2.5 - Math.abs(row - 5) * 0.3 - col * 0.1)} />
              )))}
            </g>
            <g className="section-margin-ink">
              {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${88 - i * 9} 286a${46 + i * 9} ${46 + i * 9} 0 0 1 ${92 + i * 18} 0`} />)}
            </g>
            <path className="section-margin-coral" d="m68 71 12 12m-12 0 12-12" />
          </>
        )}
      </svg>
    </div>
  )
}

function PaperMargin({ side }: { side: 'left' | 'right' }) {
  const id = useId()
  const grid = `${id}-grid`
  const fibers = `${id}-fibers`
  const paper = side === 'left'
    ? 'M-12 38 112 29 116 46 110 58 119 74 115 91 124 106 117 126 123 148 116 166 126 184 122 205 130 224 120 243 126 267 119 288 128 309 121 333 127 354 116 373 122 396 112 419 120 442 109 461 114 484 103 508-12 521Z'
    : 'M70 106 184 92 196 511 76 532 81 510 69 493 77 474 68 455 75 437 64 416 72 397 65 379 73 359 62 339 70 320 64 299 72 280 63 262 70 240 61 221 70 199 64 180 73 159 65 140Z'
  return (
    <div className={`section-margin section-margin--${side}`}>
      <svg viewBox="0 0 180 600" fill="none" focusable="false">
        <defs>
          <pattern id={grid} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" className="section-margin-grid-line" />
          </pattern>
          <pattern id={fibers} width="37" height="43" patternUnits="userSpaceOnUse">
            <path d="m3 7 3-1m9 13 2 1m13-15 3 1M8 35l4 1m16-7 3-1m-8 12 1-2" className="section-margin-fibers" />
          </pattern>
        </defs>
        <path className="section-margin-sheet-shadow" d={paper} transform="translate(3 2)" />
        <path className="section-margin-sheet" d={paper} />
        <path d={paper} fill={`url(#${fibers})`} />
        {side === 'left' ? (
          <>
            <g transform="rotate(-5 55 270)">
              <path className="section-margin-grid-paper" d="M-20 140H104V420l-8-3-6 5-8-3-6 6-9-3-7 4-9-3-8 4-8-2-6 4-10-3-9 4-11-2-9 4Z" />
              <path d="M-20 140H104V420l-8-3-6 5-8-3-6 6-9-3-7 4-9-3-8 4-8-2-6 4-10-3-9 4-11-2-9 4Z" fill={`url(#${grid})`} />
              <path className="section-margin-fold" d="m83 140 21 21v-21Z" />
            </g>
            <path className="section-margin-tape" d="m20 129 55-10 2 6 5 3-2 7 4 4-56 11 1-6-5-3 1-6Z" />
            <g className="section-margin-ink" transform="rotate(-13 108 80)">
              <circle cx="108" cy="80" r="27" /><circle cx="108" cy="80" r="19" />
              <path d="M75 69a35 35 0 0 1 60-12M142 85a35 35 0 0 1-47 28" />
            </g>
            <path className="section-margin-coral" d="M86 78c30-37 44-1 14 18S83 50 114 65s-36 34-23 7 40 22 17 26-8-44 9-21" />
            <path className="section-margin-trail" d="M28 218c104 31-46 97 16 135s94 71 47 117" />
            <g className="section-margin-ink">
              <path d="M102 481c-29-21-54-7-51 14s36 23 48 4-2-35-17-31M111 489c-2 25-30 43-52 29M116 497c-6 25-28 38-47 34" />
              <path d="m131 215 4 10 11 1-9 7 2 12-9-7-10 6 3-12-9-8 12 1Z" />
              <path d="M23 552h72m-65 7h45m-52 8h62" />
            </g>
            <path className="section-margin-coral" d="m101 371 13-12-3 19 15-6-8 17" />
          </>
        ) : (
          <>
            <g transform="rotate(6 136 253)">
              <path className="section-margin-grid-paper" d="M87 54h110v335l-9-4-7 6-10-3-9 6-10-4-7 5-10-4-8 5-9-3-9 4-12-3Z" />
              <path d="M87 54h110v335l-9-4-7 6-10-3-9 6-10-4-7 5-10-4-8 5-9-3-9 4-12-3Z" fill={`url(#${grid})`} />
            </g>
            <path className="section-margin-tape" d="m106 43 51 13-4 5 2 5-5 5 1 6-51-13 4-5-2-5 5-5Z" />
            <g className="section-margin-ink">
              <circle cx="82" cy="412" r="29" /><circle cx="82" cy="412" r="21" />
              <path d="M48 400a36 36 0 0 1 49-22M115 422a36 36 0 0 1-53 20M36 398a47 47 0 0 1 24-27" />
              <path d="M108 155c19-9 24 12 43 3s24 12 43 3m-86 2c19-9 24 12 43 3s24 12 43 3m-86 2c19-9 24 12 43 3s24 12 43 3" />
            </g>
            <path className="section-margin-coral" d="M54 386c13-33 39 5 15 18s-37-25-14-25 38 34 12 25 9-39 7-17-36 6-20-9" />
            <path className="section-margin-trail" d="M129 204c-91 7 29 56-41 76s-57 54-20 69" />
            <path className="section-margin-star" d="m117 494 5-17 5 17 15-11-9 16 19 3-18 5 12 14-17-7-3 19-5-18-14 12 7-17-19-3 18-5-12-14Z" />
            <path className="section-margin-ink" d="M62 552h65m-59 7h40m-53 7h62M42 114h12m-6-6v12" />
          </>
        )}
      </svg>
    </div>
  )
}
