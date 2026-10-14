import { useEffect, useRef } from 'react'
import { CodeGrowth, ExplorationPlane, KnowledgeConnections, ValidationNotes } from './AboutJourneySketches'
import './AboutJourneyDecorations.css'

// Three pencil poses keep the marks alive without moving their page anchors.
const scribbles = [
  'M28 77C8 62 78 49 71 65S12 96 24 77 86 76 66 91 16 54 37 59 67 113 48 107 25 63 54 66 82 86 53 91 8 83 28 69 71 64 62 80 27 108 29 86 49 50 58 72 54 107 41 91 13 77 39 76 82 58 67 75 30 98 23 84',
  'M26 75C12 56 78 56 70 68S14 99 25 79 83 72 68 88 13 60 35 57 70 109 49 108 21 65 52 64 82 91 54 89 10 88 26 72 74 60 64 79 25 106 27 87 52 52 60 73 51 110 39 94 16 73 41 74 79 62 69 77 34 102 25 84',
  'M29 79C7 64 74 50 73 64S17 94 23 76 83 79 64 94 19 54 39 61 64 111 46 105 26 60 55 67 79 85 52 94 8 81 30 67 68 67 60 83 30 110 31 87 46 49 55 70 57 104 43 90 11 81 37 78 84 56 65 73 28 96 22 86',
]

const loops = [
  'M79 84C56 87 38 69 40 47S58 13 79 16 116 35 112 58 98 82 79 84Z',
  'M79 85C55 85 39 70 41 48S57 14 80 17 115 34 111 57 99 83 79 85Z',
  'M80 84C57 88 37 68 40 46S60 14 81 16 113 37 112 59 97 81 80 84Z',
]

function PencilLoop() {
  return (
    <svg viewBox="0 0 132 124" fill="none" focusable="false">
      {loops.map((loop, index) => (
        <g className="journey-pencil-frame" key={loop}>
          <path className="journey-pencil-loop" d={loop} />
          <path className="journey-pencil-scribble" d={scribbles[index]} />
        </g>
      ))}
    </svg>
  )
}

function PencilRings() {
  return (
    <svg viewBox="0 0 112 116" fill="none" focusable="false">
      <g className="journey-pencil-frame">
        <path className="journey-pencil-ring-blue" d="M79 82C63 98 33 87 27 66S32 29 51 24 92 34 94 55M36 22C59 6 90 22 99 43" />
        <path className="journey-pencil-ring-coral" d="M78 69C66 87 39 79 36 61S47 31 62 34 85 51 78 69Z" />
        <path className="journey-pencil-ring-ink" d="M73 61C70 76 48 76 44 60S55 39 64 43 75 53 73 61ZM19 58C17 84 38 98 60 98M23 88c8 9 18 14 31 15" />
      </g>
      <g className="journey-pencil-frame">
        <path className="journey-pencil-ring-blue" d="M80 81C61 98 32 88 26 65S34 28 52 25 92 35 93 55M37 21C60 8 89 21 99 44" />
        <path className="journey-pencil-ring-coral" d="M79 68C65 87 38 78 37 60S46 32 63 35 84 52 79 68Z" />
        <path className="journey-pencil-ring-ink" d="M73 60C69 76 48 74 45 61S53 39 65 44 74 54 73 60ZM18 59C19 84 37 99 61 97M23 87c8 10 18 16 32 16" />
      </g>
      <g className="journey-pencil-frame">
        <path className="journey-pencil-ring-blue" d="M78 83C64 97 34 86 28 67S31 30 50 23 93 33 95 54M35 23C58 7 91 23 98 42" />
        <path className="journey-pencil-ring-coral" d="M77 70C67 86 40 80 35 62S48 30 61 33 86 50 77 70Z" />
        <path className="journey-pencil-ring-ink" d="M74 62C71 75 47 77 43 59S56 40 63 42 76 52 74 62ZM20 57C16 83 39 97 59 99M24 89c7 8 17 13 30 14" />
      </g>
    </svg>
  )
}

export function AboutJourneyDecorations() {
  const marginRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const margin = marginRef.current
    if (!margin) return

    const visible = new Set<HTMLElement>()
    const pieces = Array.from(margin.querySelectorAll<HTMLElement>('.journey-margin-motif'))
    const syncMotion = () => {
      pieces.forEach(piece => { piece.dataset.motion = visible.has(piece) && !document.hidden ? 'running' : 'paused' })
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const piece = entry.target as HTMLElement
        if (entry.isIntersecting) visible.add(piece)
        else visible.delete(piece)
      })
      syncMotion()
    })
    pieces.forEach(piece => observer.observe(piece))
    document.addEventListener('visibilitychange', syncMotion)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncMotion)
    }
  }, [])

  return (
    <div className="journey-margin-art" ref={marginRef} aria-hidden="true">
      <div className="journey-margin-paper journey-margin-paper--left" />
      <div className="journey-margin-paper journey-margin-paper--right" />
      <div className="journey-margin-motif journey-margin-motif--loop" data-side="left" data-kind="question" data-motion="paused"><PencilLoop /></div>
      <div className="journey-margin-motif journey-margin-motif--connections" data-side="right" data-kind="connections" data-motion="paused"><KnowledgeConnections /></div>
      <div className="journey-margin-motif journey-margin-motif--notes" data-side="left" data-kind="notes" data-motion="paused"><ValidationNotes /></div>
      <div className="journey-margin-motif journey-margin-motif--rings" data-side="right" data-kind="rings" data-motion="paused"><PencilRings /></div>
      <div className="journey-margin-motif journey-margin-motif--growth" data-side="left" data-kind="growth" data-motion="paused"><CodeGrowth /></div>
      <div className="journey-margin-motif journey-margin-motif--next" data-side="right" data-kind="next" data-motion="paused"><ExplorationPlane /></div>
    </div>
  )
}
