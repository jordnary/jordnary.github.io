import './AboutIcebergFlag.css'

const flagFrames = [
  'M18 13C29 8 39 19 57 12L54 39C40 44 30 30 18 36Z',
  'M18 13C30 6 41 18 59 15L55 41C41 41 30 29 18 36Z',
  'M18 13C29 10 40 21 56 10L53 37C40 46 29 31 18 36Z',
]

export function AboutIcebergFlag() {
  return (
    <svg className="iceberg-flag" viewBox="0 0 72 96" fill="none" aria-hidden="true" focusable="false">
      <g className="iceberg-flag-cloth">
        {flagFrames.map((path, index) => (
          <path className="iceberg-flag-frame iceberg-motion" key={index} d={path} />
        ))}
      </g>
      <path className="iceberg-flag-pole" d="M16 90C16.5 65 18.5 36 17 10" />
      <path className="iceberg-flag-pencil" d="M18.5 51L17.5 84M20 15L20 31" />
    </svg>
  )
}
