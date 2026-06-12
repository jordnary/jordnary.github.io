import { useEffect, useState } from 'react'
import { Reveal } from './Reveal'

const consoleMetrics = [
  {
    icon: '<>',
    label: 'Focus',
    value: 'AI & CS Learning',
  },
  {
    icon: 'TS',
    label: 'Stack',
    value: 'React + TypeScript',
  },
  {
    icon: 'GH',
    label: 'Goal',
    value: 'Build and Learn',
  },
]

const keywordTags = [
  'Computer Science',
  'Database',
  'Machine Learning',
  'LLM Basics',
  'Web Development',
  'TypeScript',
]

const consoleFlow = ['Learn', 'Build', 'Record']

const typewriterLabels = [
  'CS Undergrad',
  'CS Basics',
  'AI Notes',
  'Web Explorer',
]

const longestTypewriterLabel = typewriterLabels.reduce((longest, label) =>
  label.length > longest.length ? label : longest,
)

const typewriterIntervalMs = 85

type TypewriterState = {
  charIndex: number
  isDeleting: boolean
  pauseTicks: number
  wordIndex: number
}

export function Hero() {
  const [typewriter, setTypewriter] = useState<TypewriterState>({
    charIndex: 0,
    isDeleting: false,
    pauseTicks: 0,
    wordIndex: 0,
  })

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTypewriter((current) => {
        const activeLabel = typewriterLabels[current.wordIndex]

        if (current.pauseTicks > 0) {
          return {
            ...current,
            pauseTicks: current.pauseTicks - 1,
          }
        }

        if (!current.isDeleting) {
          if (current.charIndex < activeLabel.length) {
            return {
              ...current,
              charIndex: current.charIndex + 1,
            }
          }

          return {
            ...current,
            isDeleting: true,
            pauseTicks: 12,
          }
        }

        if (current.charIndex > 0) {
          return {
            ...current,
            charIndex: current.charIndex - 1,
          }
        }

        return {
          charIndex: 0,
          isDeleting: false,
          pauseTicks: 3,
          wordIndex: (current.wordIndex + 1) % typewriterLabels.length,
        }
      })
    }, typewriterIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const activeTypewriterLabel = typewriterLabels[typewriter.wordIndex].slice(
    0,
    typewriter.charIndex,
  )

  return (
    <section className="site-container page-gutter hero-section" id="home">
      <div className="hero-copy">
        <Reveal
          className="highlight-pill"
          immediate
        >
          <span className="glow-dot" />
          <span className="min-w-0">Learning CS, AI and Web Development</span>
        </Reveal>
        <Reveal
          ariaLabel="你好，我是 Jordnary，正在探索AI与Web"
          as="h1"
          className="hero-title"
          immediate
          index={1}
        >
          <span className="block">你好，我是 Jordnary</span>
          <span className="gradient-text block">
            正在探索AI与Web
          </span>
        </Reveal>
        <Reveal
          ariaLabel="角色标签循环展示：CS Undergrad、CS Basics、AI Notes、Web Explorer。"
          className="hero-typewriter"
          immediate
          index={2}
        >
          <span className="typewriter-prefix">Currently</span>
          <span className="typewriter-text" aria-hidden="true">
            <span className="typewriter-measure">
              {longestTypewriterLabel}
            </span>
            <span className="typewriter-current">
              {activeTypewriterLabel}
              <span className="typewriter-cursor" />
            </span>
          </span>
        </Reveal>
        <Reveal
          as="p"
          className="hero-role"
          immediate
          index={3}
        >
          记录学习、项目与技术笔记，用 React、TypeScript 和 GitHub Pages 持续构建个人展示空间。
        </Reveal>
        <Reveal
          className="hero-keywords"
          immediate
          index={4}
        >
          {keywordTags.map((tag) => (
            <span
              className="tag-pill hero-keyword"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </Reveal>
        <Reveal
          className="hero-actions"
          immediate
          index={5}
        >
          <a className="btn-primary hero-cta hero-cta-primary w-full sm:w-auto" href="#projects">
            <span className="hero-cta-label">查看项目</span>
            <span className="hero-cta-arrow" aria-hidden="true">→</span>
          </a>
          <a className="btn-secondary hero-cta hero-cta-secondary w-full sm:w-auto" href="#contact">
            <span className="hero-cta-label">联系我</span>
            <span className="hero-cta-arrow" aria-hidden="true">→</span>
          </a>
        </Reveal>
      </div>

      <Reveal
        className="hero-visual"
        baseDelay={0.22}
        immediate
      >
        <div className="glass-card hero-console">
          <div className="accent-line" />
          <div className="console-header">
            <div>
              <p className="meta-label">
                Learning Console
              </p>
              <p className="card-title mt-1 text-lg sm:text-xl">
                Jordnary Study Deck
              </p>
            </div>
            <span className="console-status">
              <span className="glow-dot" />
              Online
            </span>
          </div>

          <div className="console-body">
            <div className="console-display">
              <div className="console-grid-lines" aria-hidden="true" />
              <div
                aria-label="Jordnary 的字母头像标识"
                className="console-avatar-card"
              >
                <div className="console-avatar" aria-hidden="true">
                  <span>J</span>
                </div>
                <div className="min-w-0">
                  <p className="console-avatar-name">Jordnary</p>
                  <p className="console-avatar-role">CS Undergrad</p>
                </div>
              </div>
              <span className="console-orbit-tag">AI + CS</span>
              <div className="console-scanline" aria-hidden="true" />
              <div className="console-readout">
                <span>Focus</span>
                <strong>AI & CS Learning</strong>
                <span className="console-readout-meter" aria-hidden="true">
                  <span />
                </span>
              </div>
            </div>

            <div className="console-metrics">
              {consoleMetrics.map((item) => (
                <div
                  className="console-stat-card"
                  key={item.label}
                >
                  <span className="console-stat-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="console-stat-label">
                      {item.label}
                    </p>
                    <p className="console-stat-value">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="console-flow" aria-label="Control deck workflow">
              {consoleFlow.map((item, index) => (
                <span className="console-flow-step" key={item}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      <a
        aria-label="Scroll to explore the next section"
        className="hero-scroll-cue"
        href="#about"
      >
        <span className="scroll-mouse" aria-hidden="true">
          <span className="scroll-wheel" />
        </span>
        <span className="scroll-cue-text">Scroll to explore</span>
        <span className="scroll-cue-arrow" aria-hidden="true">↓</span>
      </a>
    </section>
  )
}
