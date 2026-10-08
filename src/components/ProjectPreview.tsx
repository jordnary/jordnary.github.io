import { useState } from 'react'
import type { ProjectCase } from '../data/projects'

export function ProjectPreview({
  project,
  index,
}: {
  project: ProjectCase
  index: number
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = imageFailed ? undefined : project.image?.cover ?? project.image
  return (
    <div className={`portfolio-preview${image ? ' has-image' : ''}`}>
      <div className="portfolio-preview-top" aria-hidden="true">
        <span>
          {String(index + 1).padStart(2, '0')} /{' '}
          {project.category === 'Web 应用' ? 'BUILD' : 'EXPERIMENT'}
        </span>
        <span>{image ? '项目预览' : '原理示意'}</span>
      </div>
      {image ? (
        <div className="portfolio-image-preview">
          <span className="portfolio-image-frame">
            <img
              alt={image.alt}
              src={`${import.meta.env.BASE_URL}images/projects/${image.file}`}
              width="1600"
              height="1000"
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          </span>
          <span className="portfolio-image-caption">
            {image.caption}
          </span>
        </div>
      ) : (
        <div
          aria-hidden="true"
          className={`portfolio-art portfolio-art-${project.visual}`}
        >
          <ProjectArtwork variant={project.visual} id={project.id} />
        </div>
      )}
      <div className="portfolio-pipeline" aria-label="项目流程">
        {project.pipeline.map((step, i) => (
          <span key={step}>
            {i > 0 && <b aria-hidden="true">→</b>}
            {step}
          </span>
        ))}
      </div>
    </div>
  )
}

function ProjectArtwork({
  variant,
  id,
}: {
  variant: ProjectCase['visual']
  id: string
}) {
  switch (variant) {
    case 'attention':
      return (
        <svg viewBox="0 0 440 170" fill="none">
          {Array.from({ length: 48 }, (_, i) => {
            const row = Math.floor(i / 8)
            const column = i % 8
            return <rect key={i} x={60 + column * 22} y={22 + row * 22} width="17" height="17" fill="currentColor" fillOpacity={Math.abs(row - column) < 2 ? 0.85 : 0.12} />
          })}
          <path d="M250 85H280" stroke="currentColor" strokeDasharray="4 4" />
          <text x="310" y="80" fill="currentColor" fontSize="22">Int8</text>
          <text x="294" y="104" fill="currentColor" fontSize="10">SPARSE QK</text>
        </svg>
      )
    case 'fewshot':
      return (
        <div className="portfolio-fewshot-art">
          <div className="portfolio-sample-grid">
            {Array.from({ length: 15 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <span>→</span>
          <div className="portfolio-feature-block">
            f(x)<small>FROZEN FEATURES</small>
          </div>
          <span>→</span>
          <div className="portfolio-class-points">
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </div>
      )
    case 'generative':
      return (
        <svg viewBox="0 0 440 170" fill="none">
          <path
            d="M45 38 142 64V104L45 130Z M395 38 298 64V104L395 130Z"
            fill="currentColor"
            fillOpacity=".07"
            stroke="currentColor"
            strokeOpacity=".55"
          />
          <path
            d="M146 84H188M252 84H294"
            stroke="currentColor"
            strokeDasharray="4 5"
          />
          <rect
            x="192"
            y="54"
            width="56"
            height="60"
            rx="14"
            stroke="currentColor"
          />
          <text
            x="220"
            y="91"
            textAnchor="middle"
            fill="currentColor"
            fontSize="24"
          >
            z
          </text>
          <text
            x="83"
            y="90"
            textAnchor="middle"
            fill="currentColor"
            fontSize="12"
          >
            ENCODE
          </text>
          <text
            x="355"
            y="90"
            textAnchor="middle"
            fill="currentColor"
            fontSize="12"
          >
            DECODE
          </text>
        </svg>
      )
    case 'gaussian':
      return (
        <svg viewBox="0 0 440 170">
          <defs>
            <radialGradient id={`${id}-soft`}>
              <stop stopColor="currentColor" stopOpacity=".85" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          {[
            [124, 73, 86, 35, -30],
            [220, 92, 98, 40, 18],
            [310, 64, 70, 34, -42],
            [173, 115, 64, 25, 8],
          ].map(([cx, cy, rx, ry, angle], i) => (
            <g key={i} transform={`rotate(${angle} ${cx} ${cy})`}>
              <ellipse
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fill={`url(#${id}-soft)`}
              />
              <ellipse
                cx={cx}
                cy={cy}
                rx={rx * 0.7}
                ry={ry * 0.7}
                fill="none"
                stroke="currentColor"
                strokeOpacity=".5"
              />
              <circle cx={cx} cy={cy} r="2" fill="currentColor" />
            </g>
          ))}
        </svg>
      )
    case 'color':
      return (
        <div className="portfolio-color-art">
          <div>
            {['#28464c', '#477f7a', '#88ae92', '#ced3a6', '#e8dbba'].map(
              (color) => (
                <i key={color} style={{ background: color }} />
              ),
            )}
          </div>
          <span>φ(x)W</span>
          <div>
            {['#454060', '#7d668a', '#bc90a0', '#e1b4ae', '#f3d3bc'].map(
              (color) => (
                <i key={color} style={{ background: color }} />
              ),
            )}
          </div>
        </div>
      )
    case 'gabor':
      return (
        <div className="portfolio-gabor-art">
          <div />
          <span>Δθ</span>
          <div />
        </div>
      )
    default:
      return (
        <div className="portfolio-website-art">
          <span>J.</span>
          <div>
            <b>BUILD SOMETHING</b>
            <i />
            <i />
            <i />
          </div>
        </div>
      )
  }
}
