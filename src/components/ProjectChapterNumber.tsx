import { useLayoutEffect, useRef, useState } from 'react'
import './ProjectChapterNumber.css'

type Direction = 1 | -1

function ChapterDigit({ value, direction, reducedMotion }: {
  value: string
  direction: Direction
  reducedMotion: boolean
}) {
  const [initialValue] = useState(value)
  const digitRef = useRef<HTMLSpanElement>(null)
  const targetRef = useRef(value)
  const animationsRef = useRef<Animation[]>([])
  const revisionRef = useRef(0)

  useLayoutEffect(() => {
    const digit = digitRef.current
    if (!digit || (targetRef.current === value && !reducedMotion)) return
    const faces = [...digit.querySelectorAll<HTMLSpanElement>('.project-chapter-digit-face')]
    if (faces.length !== 2) return

    const height = digit.getBoundingClientRect().height
    // Read both rendered positions before cancelling either animation.
    const positions = faces.map(face => {
      const transform = getComputedStyle(face).transform
      return height && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 / height * 100 : 0
    })
    const revision = ++revisionRef.current
    animationsRef.current.forEach(animation => animation.cancel())
    animationsRef.current = []
    targetRef.current = value

    const settle = (active: number) => {
      faces.forEach((face, index) => {
        face.textContent = value
        face.style.transform = `translateY(${index === active ? 0 : direction * 100}%)`
      })
    }
    if (reducedMotion || !height) {
      settle(0)
      return
    }

    const nearest = Math.abs(positions[0]) <= Math.abs(positions[1]) ? 0 : 1
    let incoming: number
    if (Math.abs(positions[nearest]) < 0.05) {
      if (faces[nearest].textContent === value) {
        settle(nearest)
        return
      }
      incoming = 1 - nearest
      // A fully clipped face may move to the other side without a visible jump.
      positions[incoming] = direction * 100
    } else {
      // Reversals reuse the opposite face from its current painted position.
      // A newer destination replaces the incoming numeral directly, without a
      // queued run through intervening chapter numbers.
      incoming = direction === 1
        ? (positions[0] > positions[1] ? 0 : 1)
        : (positions[0] < positions[1] ? 0 : 1)
    }
    faces[incoming].textContent = value
    const destinations = faces.map((_, index) => index === incoming ? 0 : -direction * 100)
    const distance = Math.max(...destinations.map((position, index) => Math.abs(position - positions[index])))
    const duration = Math.max(140, Math.min(480, distance * 4.8))
    const startTime = document.timeline.currentTime
    const animations = faces.map((face, index) => {
      const from = `translateY(${positions[index]}%)`
      const to = `translateY(${destinations[index]}%)`
      face.style.transform = from
      const animation = face.animate([{ transform: from }, { transform: to }], {
        duration,
        easing: 'cubic-bezier(.22, .8, .22, 1)',
        fill: 'both',
      })
      if (startTime !== null) animation.startTime = startTime
      return animation
    })
    animationsRef.current = animations
    void Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (revisionRef.current !== revision) return
      settle(incoming)
      animations.forEach(animation => animation.cancel())
      animationsRef.current = []
    }).catch(() => {
      // Cancellation is expected when a newer chapter takes over.
    })
  }, [value, direction, reducedMotion])

  useLayoutEffect(() => () => {
    revisionRef.current++
    animationsRef.current.forEach(animation => animation.cancel())
    animationsRef.current = []
  }, [])

  return <span className="project-chapter-digit" ref={digitRef} data-value={value} aria-hidden="true">
    <span className="project-chapter-digit-face">{initialValue}</span>
    <span className="project-chapter-digit-face">{initialValue}</span>
  </span>
}

export function ProjectChapterNumber({ value, direction, reducedMotion }: {
  value: number
  direction: Direction
  reducedMotion: boolean
}) {
  const number = String(value).padStart(2, '0')
  return <span className="project-chapter-number" data-value={number}
    data-direction={direction === 1 ? 'next' : 'previous'} role="img" aria-label={`Chapter ${number}`}>
    {number.split('').map((digit, index) => <ChapterDigit key={index} value={digit}
      direction={direction} reducedMotion={reducedMotion} />)}
  </span>
}
