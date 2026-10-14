import { useEffect, useId, useRef } from 'react'

function GridPaper() {
  const gridId = useId()
  return (
    <svg viewBox="0 0 180 500" fill="none" focusable="false">
      <defs>
        <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" stroke="#9bafbc" strokeWidth="0.7" opacity="0.6" />
        </pattern>
      </defs>
      <g>
        <path d="M103 101h83v370l-13-4-10 8-11-5-13 8-10-5-12 7-14-6Z" fill="#f9fbfc" />
        <path d="M103 101h83v370l-13-4-10 8-11-5-13 8-10-5-12 7-14-6Z" fill={`url(#${gridId})`} stroke="#a9bac5" strokeWidth="0.8" />
        <path d="m114 84 38-12 13 38-38 12Z" fill="#d88794" opacity="0.7" />
        <path d="m152 72 13 38-10-5Z" fill="#b45e70" opacity="0.6" />
        <path d="m122 97 25-8" stroke="#fff" strokeWidth="1" opacity="0.65" />
        <path d="m129 268 16-24 11 8 22-42M124 381h31m-31 8h19" stroke="#64878f" strokeWidth="1.1" />
        <path d="m140 304 6 15 15-4-13 11 8 13-15-6-9 13 1-17-15-3 16-7Z" stroke="#cf7685" strokeWidth="1.3" />
      </g>
    </svg>
  )
}

// Short, alternating facets suggest curled paper instead of continuous ribbons.
function Streamers() {
  return (
    <svg viewBox="0 0 180 280" fill="none" focusable="false">
      {[0, 1, 2].map(ribbon => (
        <g key={ribbon} fill={ribbon === 1 ? '#315371' : '#dc8593'}>
          {Array.from({ length: 12 }, (_, i) => {
            const phase = i * 0.77 + ribbon * 1.5
            const x = 44 + ribbon * 36 + Math.sin(phase) * 19
            const y = 18 + ribbon * 48 + i * 11
            return <path key={i} opacity={0.85 - i * 0.045} transform={`translate(${x} ${y}) rotate(${Math.cos(phase) * 42 - 15})`} d={i % 2 ? 'm0 0 8 2-2 5-5-1Z' : 'm0 0 7-2 1 6-6 1Z'} />
          })}
        </g>
      ))}
    </svg>
  )
}

function Constellation() {
  return (
    <svg viewBox="0 0 180 300" fill="none" focusable="false">
      <path d="m24 171 42-76 49 31 29-77M66 95l-7 124 56-93 25 88M24 171l116 43" stroke="#96b9c1" strokeWidth="1.1" />
      <path d="m24 171 35 48 81-5 4-165" stroke="#b7cbd1" strokeDasharray="2 6" />
      <g fill="#6f979e">
        <circle cx="24" cy="171" r="3" /><circle cx="115" cy="126" r="4" /><circle cx="59" cy="219" r="2.5" /><circle cx="144" cy="49" r="3" />
      </g>
      <g className="journey-art-orbit" style={{ transformOrigin: '66px 95px' }}>
        <circle cx="66" cy="95" r="20" stroke="#c6b786" strokeDasharray="44 18 10 54" />
        <circle cx="66" cy="75" r="3" fill="#c6b786" />
      </g>
      <path className="journey-art-spark" d="m66 84 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#ce8291" />
      <path d="m140 204 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#ce8291" opacity="0.7" />
      <path d="M25 257h40m-40 6h24" stroke="#b7cbd1" />
    </svg>
  )
}

function BotanicalStudy() {
  return (
    <svg viewBox="0 0 180 350" fill="none" focusable="false">
      <path d="M13 82h107v203H13Z" fill="#eff3eb" transform="rotate(-8 65 180)" />
      <g stroke="#7d9a87" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M46 300c49-67 22-150 77-248" />
        <path d="M75 235c-39-5-52-30-47-50 34 0 48 21 47 50Zm4-48c35-3 55-26 52-45-31 3-48 20-52 45Zm12-52c-32-8-44-32-32-49 24 7 36 22 32 49Zm15-39c30-1 45-20 39-41-25 5-37 19-39 41Z" />
        <path d="m28 185 47 50m4-48 52-45M59 86l32 49m15-39 39-41" opacity="0.5" />
      </g>
      <path d="m94 249 41-13m-5 4 5-4-6-1M24 310h42m-42 6h29" stroke="#acb7aa" />
      <circle cx="136" cy="234" r="3" fill="#d3938b" />
      <g fill="#c5b78f"><circle cx="27" cy="53" r="2" /><circle cx="38" cy="45" r="1.5" /><circle cx="42" cy="58" r="2.5" /></g>
    </svg>
  )
}

function HangingShapes() {
  return (
    <svg viewBox="0 0 180 300" fill="none" focusable="false">
      <circle cx="86" cy="20" r="3" stroke="#9eb3bb" />
      <path d="M86 23v29" stroke="#9eb3bb" />
      <g className="journey-art-mobile">
        <path d="M30 81C47 64 66 52 86 52c15 0 27 6 36 16" stroke="#829ba4" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M30 81v44m92-57v74" stroke="#9eb3bb" strokeWidth="1" />
        <circle cx="86" cy="52" r="2.5" fill="#fff" stroke="#829ba4" />
        <circle cx="30" cy="140" r="15" fill="#dce9eb" stroke="#91afb8" />
        <path d="M20 139a10 10 0 0 0 11 11" stroke="#b6cdd1" strokeLinecap="round" />
        <g className="journey-art-mobile-tier">
          <path d="M72 165c14-16 32-23 50-23 6 0 12 3 16 8" stroke="#829ba4" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M72 165v44m66-59v73" stroke="#9eb3bb" />
          <circle cx="122" cy="142" r="2.5" fill="#fff" stroke="#829ba4" />
          <path d="M72 209c12 10 15 23 0 36-15-13-12-26 0-36Z" fill="#cf8f9b" />
          <path d="M72 214v24" stroke="#e8bbc3" strokeWidth="0.8" />
          <circle cx="138" cy="232" r="9" stroke="#bfa878" strokeWidth="2" />
        </g>
      </g>
    </svg>
  )
}

function WaveStudy() {
  return (
    <svg viewBox="0 0 180 300" fill="none" focusable="false">
      <circle cx="80" cy="112" r="36" fill="#f1e8d6" />
      <path d="M80 58V45m-39 29-9-10m86 7 9-10" stroke="#bea77e" />
      <g className="journey-art-tide" stroke="#88aeb8" strokeWidth="1.2">
        {[0, 1, 2, 3, 4].map(i => <path key={i} transform={`translate(0 ${i * 13})`} d="M8 153c25-35 41 30 70-4s43-20 64 1 30 7 40-5" />)}
      </g>
      <path d="m36 230 32 18 38-11-32-16Z" fill="#edf2f4" stroke="#a4bac4" />
      <path d="m68 248 6-27 11 22" stroke="#a4bac4" />
      <circle cx="142" cy="94" r="3" fill="#ce8291" />
    </svg>
  )
}

export function AboutJourneyDecorations() {
  const marginRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { (entry.target as HTMLElement).dataset.visible = String(entry.isIntersecting) })
    })
    marginRef.current?.querySelectorAll('[data-animated]').forEach(piece => observer.observe(piece))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="journey-margin-art" ref={marginRef} aria-hidden="true">
      <div className="journey-margin-piece journey-margin-piece--left journey-margin-piece--one" data-animated><Constellation /></div>
      <div className="journey-margin-piece journey-margin-piece--right journey-margin-piece--two"><GridPaper /></div>
      <div className="journey-margin-piece journey-margin-piece--left journey-margin-piece--three"><BotanicalStudy /></div>
      <div className="journey-margin-piece journey-margin-piece--right journey-margin-piece--four" data-animated><HangingShapes /></div>
      <div className="journey-margin-piece journey-margin-piece--left journey-margin-piece--five" data-animated><WaveStudy /></div>
      <div className="journey-margin-piece journey-margin-piece--right journey-margin-piece--six"><Streamers /></div>
    </div>
  )
}
