const pencilPoses = [
  { x: 0, y: 0, angle: 0 },
  { x: 0.6, y: -0.5, angle: -0.8 },
  { x: -0.4, y: 0.6, angle: 0.7 },
]

const connectionLines = [
  'M83 143C78 129 83 119 96 109S109 91 103 75M96 109C108 111 119 101 124 89M103 75C94 65 92 55 96 46M103 75C114 69 122 65 127 55',
  'M84 143C78 130 84 118 97 109S108 92 102 75M97 109C109 112 119 102 125 89M102 75C93 65 93 56 97 46M102 75C114 68 121 66 127 55',
  'M83 144C79 128 82 120 96 108S110 90 104 75M96 108C108 110 120 101 124 88M104 75C95 66 91 55 96 47M104 75C115 70 123 64 128 55',
]

export function KnowledgeConnections() {
  return (
    <svg viewBox="0 0 152 196" fill="none" focusable="false" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {pencilPoses.map((pose, index) => (
        <g className="journey-pencil-frame" key={index} transform="translate(152 0) scale(-1 1)">
          <path d="M55 143C37 124 38 99 52 82M62 134C49 119 51 100 62 88" stroke="var(--margin-blue)" opacity="0.7" />
          <path d="M47 149C26 127 29 93 43 77" stroke="var(--margin-ink)" strokeWidth="1.3" opacity="0.3" />
          <path d={connectionLines[index]} stroke="var(--margin-ink)" />
          <path d="M77 144L85 151 90 142" stroke="var(--margin-blue)" strokeWidth="1.4" />
          <g transform={`translate(${pose.x} ${pose.y})`}>
            <path d="M98 68C105 67 110 73 108 79S97 83 95 78 94 70 98 68Z" fill="var(--margin-blue)" fillOpacity="0.34" stroke="var(--margin-ink)" />
            <path d="M91 103C96 99 103 104 102 109S96 117 91 113 87 107 91 103Z" fill="var(--margin-paper-fill)" stroke="var(--margin-ink)" />
            <path d="M122 84C127 81 131 85 129 90S122 95 120 91 119 87 122 84Z" fill="var(--margin-coral)" fillOpacity="0.6" stroke="var(--margin-coral)" />
            <circle cx="96" cy="46" r="4" fill="var(--margin-paper-fill)" stroke="var(--margin-blue)" />
            <circle cx="127" cy="55" r="3" fill="var(--margin-coral)" fillOpacity="0.55" />
            <path d="M114 38l2-5m8 9 5-2M76 160l5 2 5-1" stroke="var(--margin-ink)" strokeWidth="1.3" opacity="0.62" />
          </g>
          <path d="M62 62l8 2m-4-5-1 7" stroke="var(--margin-coral)" opacity="0.7" />
        </g>
      ))}
    </svg>
  )
}

const noteMarks = [
  'M46 93l5-1 4 2 7-1 7 1M45 101l7 1 5-2 8 2M47 112l9 1 4-1',
  'M46 94l5-2 5 2 6-1 7 2M45 101l7 2 5-3 8 2M47 113l9 1 4-2',
  'M46 93l5-1 4 3 7-2 7 1M46 102l6 1 5-2 8 1M47 112l9 2 4-2',
]

const checkMarks = ['M65 119l5 5 12-15', 'M64 119l6 6 12-15', 'M65 120l5 4 13-15']

export function ValidationNotes() {
  return (
    <svg viewBox="0 0 152 196" fill="none" focusable="false" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {pencilPoses.map((pose, index) => (
        <g className="journey-pencil-frame" key={index} transform="translate(24 0)">
          <g transform={`rotate(${-9 + pose.angle} 61 85)`}>
            <path d="M33 55L77 54 79 109 35 111Z" fill="var(--margin-blue)" fillOpacity="0.14" stroke="var(--margin-blue)" />
            <path d="M43 68l23-1m-22 8 18-1m-18 8 22-1" stroke="var(--margin-blue)" opacity="0.7" />
            <path d="M49 51l15-1 1 9-15 1Z" fill="var(--margin-paper-fill)" fillOpacity="0.75" stroke="var(--margin-blue)" strokeWidth="1.3" />
          </g>
          <g transform={`rotate(${6 + pose.angle} 61 109)`}>
            <path d="M38 79L80 81 82 129 72 138 37 135Z" fill="var(--margin-paper-fill)" stroke="var(--margin-ink)" />
            <path d="M72 138l1-11 9 2" fill="var(--margin-blue)" fillOpacity="0.17" stroke="var(--margin-ink)" strokeWidth="1.3" />
            <path d={noteMarks[index]} stroke="var(--margin-ink)" opacity="0.7" />
            <path d="M44 99l22 6m-22-4 22 1" stroke="var(--margin-coral)" strokeWidth="1.3" opacity="0.7" />
            <path d={checkMarks[index]} stroke="var(--margin-coral)" strokeWidth="1.7" />
          </g>
          <g transform={`rotate(${pose.angle} 98 124)`}>
            <path d="M98 91l7 2-15 47-6 6-1-8Z" fill="var(--margin-blue)" fillOpacity="0.25" stroke="var(--margin-ink)" strokeWidth="1.3" />
            <path d="M85 137l5 3m8-44 6 2m-17 38 13-37M84 146l1-5" stroke="var(--margin-ink)" strokeWidth="1.3" />
            <path d="M98 91l1-4 7 2-1 4" stroke="var(--margin-coral)" />
          </g>
          <path d="M33 151c9 3 22 4 33 2" stroke="var(--margin-blue)" opacity="0.6" />
          <path d={`M${23 + pose.x} 91l-5-2m8-6-2-5`} stroke="var(--margin-coral)" strokeWidth="1.3" opacity="0.65" />
        </g>
      ))}
    </svg>
  )
}

const growthStems = [
  'M97 139C94 122 102 111 100 95S102 70 111 58M100 103C93 95 88 87 84 76M101 91C111 86 117 76 121 67',
  'M98 139C95 122 101 110 101 95S102 71 111 57M100 103C92 95 88 88 84 77M101 91C112 85 118 77 122 67',
  'M97 139C94 123 103 112 100 94S103 69 112 58M100 102C94 94 89 87 85 76M101 91C111 87 117 75 121 68',
]

export function CodeGrowth() {
  return (
    <svg viewBox="0 0 152 196" fill="none" focusable="false" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {pencilPoses.map((pose, index) => (
        <g className="journey-pencil-frame" key={index}>
          <path d="M73 108c-11-2-13 4-12 15s-4 12-8 13c6 1 10 4 10 12s2 14 13 12M120 106c11-2 14 3 13 14s4 12 9 13c-7 2-10 6-9 14s-2 15-12 14" stroke="var(--margin-ink)" strokeWidth="1.7" />
          <path d="M74 111c-8-1-10 3-10 9m61 38c5-1 6-5 5-10" stroke="var(--margin-blue)" strokeWidth="1.3" />
          <path d={growthStems[index]} stroke="var(--margin-ink)" />
          <g transform={`rotate(${pose.angle} 101 97)`}>
            <path d="M99 107C87 106 78 99 78 89 89 88 99 94 99 107Z" fill="var(--margin-sage)" fillOpacity="0.24" stroke="var(--margin-sage)" />
            <path d="M102 92C104 81 116 77 125 81 122 90 113 96 102 92Z" fill="var(--margin-blue)" fillOpacity="0.3" stroke="var(--margin-ink)" strokeWidth="1.3" />
            <path d="M85 77C76 76 71 69 72 62 81 61 87 68 85 77Z" fill="var(--margin-sage)" fillOpacity="0.28" stroke="var(--margin-sage)" />
            <path d="M110 60C102 54 104 45 113 40 119 47 119 55 110 60Z" fill="var(--margin-blue)" fillOpacity="0.3" stroke="var(--margin-ink)" strokeWidth="1.3" />
            <path d="M121 68c-5-5-3-12 3-15 5 6 4 11-3 15Z" fill="var(--margin-coral)" fillOpacity="0.45" stroke="var(--margin-coral)" strokeWidth="1.3" />
            <path d="M99 106l-13-10m17-4 13-6m-5-27 1-10" stroke="var(--margin-ink)" strokeWidth="1.3" opacity="0.58" />
          </g>
          <path d="M80 145c10 3 22 4 34 0M86 150c6 1 14 2 20 0" stroke="var(--margin-blue)" strokeWidth="1.3" />
          <path d={`M${64 + pose.x} 87l-4-2m7-5-1-4`} stroke="var(--margin-coral)" strokeWidth="1.3" opacity="0.7" />
          <circle cx="89" cy="164" r="1.7" fill="var(--margin-ink)" opacity="0.4" />
          <circle cx="96" cy="166" r="1.5" fill="var(--margin-ink)" opacity="0.4" />
        </g>
      ))}
    </svg>
  )
}

const flightRoutes = [
  'M38 162C12 145 22 118 48 124S78 155 96 137 82 105 66 120 75 147 93 126 97 91 75 79',
  'M38 162C13 144 21 117 48 125S79 155 96 138 82 104 66 119 74 147 94 126 98 91 75 79',
  'M38 163C11 145 23 119 48 123S77 155 95 137 83 106 67 120 76 148 93 125 96 90 75 78',
]

export function ExplorationPlane() {
  return (
    <svg viewBox="0 0 152 196" fill="none" focusable="false" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {pencilPoses.map((pose, index) => (
        <g className="journey-pencil-frame" key={index}>
          <path d={flightRoutes[index]} stroke="var(--margin-ink)" strokeWidth="1.3" strokeDasharray="3 5 2 6" opacity="0.7" />
          <circle cx="31" cy="126" r="3.5" fill="var(--margin-paper-fill)" stroke="var(--margin-blue)" />
          <circle cx="66" cy="139" r="3" fill="var(--margin-coral)" fillOpacity="0.55" stroke="var(--margin-coral)" />
          <circle cx="94" cy="104" r="3.5" fill="var(--margin-paper-fill)" stroke="var(--margin-blue)" />
          <g transform={`rotate(${pose.angle * 1.6} 64 63)`}>
            <path d="M26 58L91 35 71 85 57 67Z" fill="var(--margin-paper-fill)" stroke="var(--margin-ink)" />
            <path d="M26 58l31 9 34-32-46 26Z" fill="var(--margin-blue)" fillOpacity="0.22" stroke="var(--margin-ink)" strokeWidth="1.3" />
            <path d="M57 67l2 19 12-1M59 86l7-13" fill="var(--margin-blue)" fillOpacity="0.38" stroke="var(--margin-ink)" strokeWidth="1.3" />
            <path d="M63 65l17-19" stroke="var(--margin-blue)" strokeWidth="1.3" />
          </g>
          <path d="M34 78l-9 7m17 1-8 7" stroke="var(--margin-blue)" opacity="0.75" />
          <path d={`M${105 + pose.x} 54l5-3m-7-3 1-5`} stroke="var(--margin-coral)" strokeWidth="1.3" opacity="0.75" />
          <path d="M46 168l5 2m8 3 2 1" stroke="var(--margin-ink)" strokeWidth="1.3" opacity="0.5" />
        </g>
      ))}
    </svg>
  )
}
