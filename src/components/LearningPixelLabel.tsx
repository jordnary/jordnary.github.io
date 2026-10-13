import { useLearningHoverLoop } from './useLearningHoverLoop'

export function LearningPixelLabel({ children }: { children: string }) {
  const labelRef = useLearningHoverLoop<HTMLSpanElement>('up')

  return (
    <span className="learning-pixel-label-clip">
      <span ref={labelRef} className="learning-pixel-label">{children}</span>
    </span>
  )
}
