type AboutNextSketchProps = {
  kind: 'notes' | 'projects'
}

function NotebookSketch() {
  return (
    <>
      <g className="journey-next-art-wash" fill="currentColor" stroke="none" opacity="0.12">
        <path d="M28 45C43 37 59 40 75 49 88 41 102 40 117 44L113 89C97 85 85 88 75 96 61 86 44 84 29 88Z" />
        <path d="M108 33 116 36 99 83 92 89 91 79Z" />
      </g>
      <g className="journey-next-art-lines">
        <path d="M26 39C44 34 60 38 75 47 88 39 103 37 120 41 118 55 118 72 116 84 100 81 87 86 75 94 60 85 43 81 27 85 26 68 28 53 26 39Z" />
        <path d="M75 47C74 62 76 79 75 94M30 89C46 86 61 90 75 99 88 91 101 87 116 89" />
        <path d="M24 45C23 58 24 77 24 86M32 36C47 33 60 37 70 43M80 94C90 89 101 86 111 87" opacity="0.32" strokeWidth="0.9" />
      </g>
      <g className="journey-next-art-detail" opacity="0.67" strokeWidth="1.2">
        <path d="M36 50C45 48 55 51 64 55M36 59C46 57 56 61 63 64M36 68C42 67 49 68 54 71" />
        <path d="M85 56C92 52 99 51 108 51M85 65C90 62 96 61 102 61M86 75C91 72 96 71 100 71" />
        <path d="M37 75C45 73 53 77 59 78" stroke="var(--journey-next-accent, currentColor)" strokeWidth="2.6" opacity="0.7" />
      </g>
      <g className="journey-next-art-pencil">
        <path d="M108 29C110 28 115 30 117 32L101 78 93 85 92 75Z" fill="var(--journey-next-paper, var(--bg-primary))" />
        <path d="M109 34 115 36M94 74 101 78M96 73C100 63 105 48 109 38M93 84 94 80" />
        <path d="M108 29 110 23C112 22 117 24 119 26L117 32" stroke="var(--journey-next-accent, currentColor)" />
        <path d="M112 27 116 28" opacity="0.35" />
      </g>
      <g className="journey-next-art-detail" stroke="var(--journey-next-accent, currentColor)" opacity="0.7">
        <path d="M24 27 20 23M34 25 35 19M126 74 132 72" />
        <path d="M51 106C66 109 87 108 100 104" strokeWidth="1" opacity="0.6" />
      </g>
    </>
  )
}

function ProjectSketch() {
  return (
    <>
      <g className="journey-next-art-wash" fill="currentColor" stroke="none" opacity="0.12">
        <path d="M28 35C50 33 83 36 111 33L115 85C90 89 59 86 31 89Z" />
        <path d="M40 89C59 85 90 87 106 89L121 98C97 101 56 100 31 98Z" />
      </g>
      <g className="journey-next-art-lines">
        <path d="M25 31C47 28 81 32 110 29 113 45 112 66 114 84 85 87 55 83 28 87 26 68 28 48 25 31Z" />
        <path d="M28 45C52 43 82 46 111 43M29 90C54 87 87 90 113 87" />
        <path d="M32 89C28 92 23 97 22 99 52 102 91 103 123 99 119 96 115 93 111 91" />
        <path d="M33 28C52 26 84 29 102 27M116 42C117 55 117 71 117 80M31 102C56 105 85 104 108 103" opacity="0.32" strokeWidth="0.9" />
      </g>
      <g className="journey-next-art-detail" strokeWidth="1.3">
        <path d="M54 55C51 58 47 62 43 64 47 66 50 70 54 73M85 53C89 56 92 59 96 62 92 65 88 69 85 73M75 52C72 59 68 69 65 77" />
        <path d="M51 58 45 64M92 63 87 68M73 56 68 69" opacity="0.3" strokeWidth="0.8" />
        <path d="M34 38 36 38M42 37 44 37M50 38 52 38M59 95C67 94 75 96 82 95" opacity="0.65" />
      </g>
      <g className="journey-next-art-spark" stroke="var(--journey-next-accent, currentColor)">
        <path d="M123 20C123 25 120 29 115 31 121 32 124 35 126 41 126 35 130 31 135 29 129 29 125 25 123 20Z" fill="var(--journey-next-paper, var(--bg-primary))" />
        <path d="M138 18 142 14M140 40 145 42M112 17 110 13" opacity="0.72" />
      </g>
      <g className="journey-next-art-detail" stroke="var(--journey-next-accent, currentColor)" opacity="0.65">
        <path d="M17 65C10 64 11 73 17 73 22 73 20 67 17 67M130 81 136 79M132 88 139 90" strokeWidth="1.1" />
      </g>
    </>
  )
}

export function AboutNextSketch({ kind }: AboutNextSketchProps) {
  return (
    <svg
      className="journey-next-art"
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'notes' ? <NotebookSketch /> : <ProjectSketch />}
    </svg>
  )
}
