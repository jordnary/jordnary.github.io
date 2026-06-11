import { useEffect, useState } from 'react'

const fallbackVisibilityThreshold = 720
const viewportVisibilityRatio = 0.9

const getVisibilityThreshold = () => {
  const viewportThreshold = Math.max(
    fallbackVisibilityThreshold,
    window.innerHeight * viewportVisibilityRatio,
  )
  const heroElement = document.getElementById('home')

  if (!heroElement) {
    return viewportThreshold
  }

  return Math.max(viewportThreshold, heroElement.offsetTop + heroElement.offsetHeight)
}

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    let frameId = 0

    const updateVisibility = () => {
      frameId = 0
      setIsVisible((current) => {
        const shouldShow = window.scrollY > getVisibilityThreshold()

        return current === shouldShow ? current : shouldShow
      })
    }

    const scheduleUpdate = () => {
      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updateVisibility)
      }
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)

      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ behavior: 'smooth', top: 0 })
  }

  return (
    <a
      aria-hidden={isVisible ? undefined : true}
      aria-label="返回顶部"
      className={`back-to-top-button ${isVisible ? 'is-visible' : ''}`}
      href="#top"
      onClick={scrollToTop}
      tabIndex={isVisible ? 0 : -1}
    >
      <svg
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="m6 15 6-6 6 6" />
      </svg>
    </a>
  )
}
