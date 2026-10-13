import { useLearningHoverLoop } from './useLearningHoverLoop'

export function LearningPixelArrow({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  const arrowRef = useLearningHoverLoop<SVGSVGElement>(direction)

  return (
    <span className="learning-pixel-arrow" aria-hidden="true">
      <svg ref={arrowRef} viewBox="0 0 24 20" focusable="false">
        <path d={direction === 'left' ? 'M20 10H4m4-4-4 4 4 4' : 'M4 10h16m-4-4 4 4-4 4'} />
      </svg>
    </span>
  )
}
