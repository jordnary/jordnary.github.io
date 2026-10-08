import type { ReactNode } from 'react'
import './ArtisticLabel.css'

export function ArtisticLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`artistic-label ${className}`.trim()}>
      <span className="artistic-label-text">{children}</span>
      <svg className="artistic-label-stroke" viewBox="0 0 120 12" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <path d="M2 8C30 2 73 2 118 5" />
        <path d="M49 10c23-4 44-4 60-2" />
      </svg>
    </span>
  )
}
