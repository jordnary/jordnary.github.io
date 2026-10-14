import './HeroSamuraiArt.css'

/** Decorative ink studies, layered between the paper and the hero content. */
export function HeroSamuraiArt() {
  return (
    <div className="hero-samurai-art" aria-hidden="true">
      <svg className="hero-kabuto" viewBox="0 0 340 320" fill="none" focusable="false">
        <g transform="rotate(3 174 180)">
          {/* Overlapping lamellae wrap around the back of a three-quarter bowl. */}
          <g className="samurai-ink">
            <path className="samurai-shade" d="M77 163 250 153c13 40 28 81 48 111-65 39-192 42-269 10 29-35 43-72 48-111Z" />
            <path className="samurai-paper" d="M42 247c65 34 178 28 241-11l15 28c-66 37-185 40-269 10Z" />
            <path className="samurai-wash" d="M56 222c61 29 163 24 216-10l12 27c-59 38-171 45-242 10Z" />
            <path className="samurai-paper" d="M68 197c55 26 142 24 195-10l10 27c-56 35-157 41-217 10Z" />
            <path className="samurai-wash" d="M77 170c51 25 128 23 178-7l9 26c-54 34-141 36-196 10Z" />
            <path className="samurai-fine" d="M36 271c79 31 194 29 257-9M48 245c68 31 174 26 231-8M62 220c57 25 149 22 206-7M73 194c50 22 133 20 187-8" />
            <path className="samurai-fine samurai-muted" d="m54 257-9 12m18-8-7 12m18-8-5 12m18-8-4 12m20-10-3 12m151-23 8 10m-19-5 7 10m-19-5 5 10" />
            {[0, 1, 2, 3].map(index => (
              <path key={index} className="samurai-fine" d={`M${83 + index * 18} ${195 + index * 5}q-5 13-11 24m7 2-11 23m7 4-11 21`} />
            ))}
          </g>
          {/* Receding ribs, a lit crown, and a shaded flank describe the volume. */}
          <g className="samurai-ink">
            <path className="samurai-paper" d="M68 169C61 116 101 69 159 62c53-7 92 29 105 85l-23 24c-53 26-126 25-173-2Z" />
            <path className="samurai-wash" stroke="none" d="M159 62c-45 23-59 63-52 111l-39-4C61 116 101 69 159 62Z" />
            <path className="samurai-shade" stroke="none" d="M172 64c34 14 54 48 59 95l33-12c-12-50-44-85-92-83Z" />
            <path d="M164 68c-39 20-56 56-53 107m57-105c-17 29-20 66-13 108m18-108c7 28 17 59 20 100m-16-100c25 22 42 54 46 89" />
            <path className="samurai-fine" d="M154 72c-43 13-69 49-72 91m82-90c-32 24-45 58-42 94m49-92c-8 27-10 58-6 91m14-92c16 22 28 51 32 84" />
            <path className="samurai-fine samurai-muted" d="m82 135 10-6m-12 15 12-7m-12 16 12-7m-11 15 11-6m143-28 11-4m-9 11 12-4m-10 11 12-4" />
            <ellipse className="samurai-wash" cx="166" cy="65" rx="13" ry="5" transform="rotate(-9 166 65)" />
            <ellipse className="samurai-fine" cx="166" cy="64" rx="6" ry="2.5" transform="rotate(-9 166 64)" />
          </g>
          {/* A dark recess sits behind the projected brow and the raised mask. */}
          <path className="samurai-ink samurai-shade" d="M136 184c39 7 84-3 121-22l3 45c-8 30-29 54-55 63l-37-10c-23-20-32-48-32-76Z" />
          <g className="samurai-ink">
            <path className="samurai-wash" d="M71 161c56 20 136 11 191-15l29 17-3 7c-56 30-158 43-223 14Z" />
            <path className="samurai-paper" d="M71 156c59 20 135 12 190-14l30 21c-62 29-155 40-222 15Z" />
            <path className="samurai-fine" d="M80 169c66 20 145 5 199-8m-38-8 18-5 16 10" />
          </g>
          {/* Unequal horns follow the forehead perspective instead of a flat symmetry. */}
          <g className="samurai-ink">
            <path className="samurai-wash" d="M213 142c29-26 44-62 46-104 16 42 8 85-33 117Z" />
            <path className="samurai-fine" d="M261 55c8 34-4 68-39 94" />
            <path className="samurai-paper" d="M204 141C160 127 123 84 111 25c-15 62 15 112 79 132Z" />
            <path className="samurai-wash" d="M111 25c-7 60 23 103 79 123l14-7-14 16C126 137 96 87 111 25Z" />
            <path className="samurai-fine" d="M116 55c9 41 35 72 75 88" />
            <path className="samurai-paper" d="m208 125 17 17-8 24-23-15Z" />
            <path className="samurai-accent" d="m209 134 9 9-4 14-13-9Z" />
          </g>
          <g className="samurai-ink">
            <path className="samurai-paper" d="M105 182c-16-4-30-17-42-33l-14 38c9 18 26 30 49 32l16-8Z" />
            <path className="samurai-shade" d="m105 182 9 29-16 8 3-30Z" />
            <path className="samurai-fine" d="m65 163-10 24c9 13 20 21 36 24l5-23c-13-4-23-13-31-25Z" />
            <ellipse className="samurai-fine" cx="76" cy="188" rx="9" ry="11" transform="rotate(-23 76 188)" />
            <path className="samurai-accent" d="m76 181 5 8-5 5-4-8Z" />
            <path className="samurai-wash" d="m266 165 12-17 9 26-12 14-12-4Z" />
            <path className="samurai-fine" d="m277 159 5 14-7 9" />
          </g>
          {/* The near cheek overlaps a narrow far cheek and a projecting nose. */}
          <g className="samurai-ink">
            <path className="samurai-paper" d="m147 207 38 12 31-10 22-17 8 17 19 11-15 10 1 12-21 19-23 12-30-10-18-23Z" />
            <path className="samurai-wash" stroke="none" d="m147 207 22 17 12 28 26 21-30-10-18-23Z" />
            <path className="samurai-wash" stroke="none" d="m238 192-6 32 18 6 15-10-19-11Z" />
            <path d="m155 214 26 13 15-4m26-10 14-10m-7 8 3 13 18 6m-47 12c11-7 24-9 38-8" />
            <path className="samurai-fine" d="m211 245 26-5m-20 12 17-7m-67-10 15 6m-12 1 14 6m-10 1 13 5m57-33 7-2m-49 39 6 5 17-7" />
            <path d="M126 192c-8 27 3 68 40 87m96-88c12 28-5 59-25 72" />
            <path className="samurai-fine" d="M131 194c-6 29 6 62 36 80m-3 4c-15-9-27-2-20 6 8 9 20 0 26-6m0 0c15-11 29-4 22 4-6 7-17 1-22-4m-1 3-5 25m8-25 12 22" />
            <path className="samurai-accent" d="m160 302 9 1m11-3 8-3" />
          </g>
          <g className="samurai-rivets">
            {[[88, 180], [112, 185], [137, 186], [162, 184], [186, 181], [239, 167], [263, 159]].map(([x, y]) => (
              <circle key={x} cx={x} cy={y} r="1.3" />
            ))}
          </g>
        </g>
      </svg>

      <svg className="hero-katana" viewBox="0 0 300 660" fill="none" focusable="false">
        <g transform="rotate(204 150 330)">
          {/* The curved spine, cutting edge, and yokote meet at the kissaki. */}
          <g className="samurai-ink samurai-paper katana-blade">
            <path d="M140 448c-6-107-4-221 12-338 3-22 11-52 24-79 2 34 3 66-1 94-12 113-14 215-12 323Z" />
            <path className="samurai-wash" stroke="none" d="M140 433c-5-109-3-211 12-323 3-22 11-52 24-79l-13 81c-14 108-16 214-12 324Z" />
            <path d="M151 436c-4-110-2-216 12-324l13-81m-25 80 23 14" className="samurai-fine" />
            <path d="M155 425c-3-103-1-203 11-302m-12-11 16 9 4-39" className="samurai-hairline" />
            <path d="M158 426c-5-22 4-26 0-45s4-27 1-45 5-26 2-45 5-27 3-44 5-28 3-44 5-26 3-44 3-22 3-28" className="samurai-fine samurai-muted" />
            <path d="m145 148-2 33m-2 17-2 18m-2 53-1 34" className="samurai-fine samurai-muted" />
            <path d="m138 433 26 1 1 21-26-1Z" />
            <path d="m141 436 20 1v14l-19-1Z" className="samurai-fine" />
            <path d="m144 439 4 3-4 3m5-6 4 3-4 3m5-6 4 3-4 3" className="samurai-accent" />
            <path d="m137 451 29 1v4l-29-1Z" className="samurai-wash samurai-fine" />
          </g>
          <g className="samurai-ink samurai-wash">
            <path className="samurai-shade" d="M113 456c-2-6 4-10 13-11 3-6 16-8 25-4 11-3 24 0 27 6 11 2 17 7 13 12-1 7-13 10-23 9-8 5-24 4-30-1-13 0-23-4-25-11Z" />
            <path d="M113 452c-2-6 4-10 13-11 3-6 16-8 25-4 11-3 24 0 27 6 11 2 17 7 13 12-1 7-13 10-23 9-8 5-24 4-30-1-13 0-23-4-25-11Z" />
            <path className="samurai-fine" d="M119 451c-1-4 4-6 12-7 3-5 13-6 20-3 9-3 19 0 22 5 9 1 14 5 12 8-2 5-11 7-19 6-7 4-20 3-26-1-11 0-19-3-21-8Z" />
            <path className="samurai-paper samurai-fine" d="M122 450q9-9 17-4l-4 9q-10 0-13-5Zm44-3q9-3 16 6-5 5-14 3Z" />
            <path className="samurai-accent" d="m125 449 5 2m43-1 5 3m-33-11 7 1" />
          </g>
          <g className="samurai-ink samurai-paper katana-hilt">
            <path d="m139 463 26 1c-3 40-3 88 1 130-7 5-19 5-26-1 2-42 2-89-1-130Z" />
            <path className="samurai-wash" stroke="none" d="m139 463 6 1c3 44 3 87 1 131l-6-2c2-42 2-89-1-130Z" />
            <path className="samurai-wash" d="m138 463 28 1v7l-27-1Zm2 120 26 1 1 10c-7 6-20 6-28-1Z" />
            <path className="samurai-fine" d="m142 466 19 1m-18 122 18 1m-18 4 18 1" />
            {Array.from({ length: 7 }, (_, index) => (
              <g key={index} className="samurai-fine">
                <path d={`m141 ${471 + index * 16} 22 16m-1-16-21 16`} />
                <path d={`m142 ${474 + index * 16} 20 14m0-17-20 14`} className="samurai-hairline" />
                <path d={`m152 ${475 + index * 16} 5 5-5 5-5-5Z`} className="samurai-handle-wrap" />
                <path d={`m151 ${478 + index * 16} 2 2-2 2`} className="samurai-hairline" />
              </g>
            ))}
            <circle cx="152" cy="487" r="1.6" className="samurai-rivets" />
            <path d="m145 590 3-2 3 3 3-3 5 3m-12-64 5-3 5 3-5 3Z" className="samurai-accent" />
          </g>
          <g className="samurai-ink samurai-fine">
            <path d="M164 477c27 2 43-24 30-35-13-12-31 6-17 16 18 13 42-23 37-49" />
            <path d="M165 481c29 0 46-27 32-40m17-32-4-13m7 12 1-13" className="samurai-muted" />
            <path d="m208 401 11-2" className="samurai-accent" />
          </g>
        </g>
      </svg>
    </div>
  )
}
