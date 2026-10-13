import { useEffect, useRef, useState, type CSSProperties } from 'react'
import './LearningPixelFill.css'

// The same left-to-right sequence fills and clears the button.
export function LearningPixelFill() {
  const fillRef = useRef<HTMLSpanElement>(null)
  const [grid, setGrid] = useState({ columns: 1, rows: 1 })

  useEffect(() => {
    const fill = fillRef.current
    if (!fill) return
    const resize = new ResizeObserver(([entry]) => {
      const columns = Math.max(1, Math.ceil(entry.contentRect.width / 10))
      const rows = Math.max(1, Math.ceil(entry.contentRect.height / 10))
      setGrid(current => current.columns === columns && current.rows === rows ? current : { columns, rows })
    })
    resize.observe(fill)
    return () => resize.disconnect()
  }, [])

  return (
    <span
      ref={fillRef}
      className="learning-pixel-fill"
      aria-hidden="true"
      style={{ '--pixel-columns': grid.columns, '--pixel-rows': grid.rows } as CSSProperties}
    >
      {Array.from({ length: grid.columns * grid.rows }, (_, index) => {
        const column = index % grid.columns
        const row = Math.floor(index / grid.columns)
        const scatter = ((column * 17 + row * 29 + column * row * 7) % 11) * 9
        return <i key={index} style={{ '--pixel-delay': `${column * 16 + scatter}ms` } as CSSProperties} />
      })}
    </span>
  )
}
