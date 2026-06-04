import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import heroImg from '../assets/hero.png'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
} from '../lib/animations'

const consoleMetrics = [
  {
    label: 'Focus',
    value: 'Frontend',
  },
  {
    label: 'Stack',
    value: 'React TS',
  },
  {
    label: 'Mode',
    value: 'Static',
  },
]

const keywordTags = [
  'Frontend Engineering',
  'TypeScript',
  'React',
  'Clean Tech UI',
  'GitHub Pages',
]

const consoleModules = [
  {
    index: '01',
    label: 'Interface',
    value: 'Clean UI systems',
  },
  {
    index: '02',
    label: 'Delivery',
    value: 'Static builds',
  },
  {
    index: '03',
    label: 'Motion',
    value: 'Subtle motion',
  },
]

const consoleLogs = [
  'init profile.system',
  'sync projects.catalog',
  'render responsive.hero',
]

const typewriterLabels = [
  'Frontend Learner',
  'React Developer',
  'Design-minded Builder',
  'AI & Web Explorer',
]

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
        <motion.div
          animate={fadeUpVisible}
          className="highlight-pill"
          initial={fadeUpHidden}
          transition={getRevealTransition(0)}
        >
          <span className="glow-dot" />
          <span className="min-w-0">Jordnary / Personal Web Console</span>
        </motion.div>
        <motion.h1
          animate={fadeUpVisible}
          aria-label="你好，我是 Jordnary。用代码、设计与结构感，构建清爽的数字体验。"
          className="hero-title"
          initial={fadeUpHidden}
          transition={getRevealTransition(1)}
        >
          <span className="block">你好，我是 Jordnary</span>
          <span className="gradient-text block">
            用代码、设计与结构感，构建清爽的数字体验。
          </span>
        </motion.h1>
        <motion.div
          animate={fadeUpVisible}
          aria-label="角色标签循环展示：Frontend Learner、React Developer、Design-minded Builder、AI & Web Explorer。"
          className="hero-typewriter"
          initial={fadeUpHidden}
          transition={getRevealTransition(2)}
        >
          <span className="typewriter-prefix">Currently</span>
          <span className="typewriter-text" aria-hidden="true">
            {activeTypewriterLabel}
            <span className="typewriter-cursor" />
          </span>
        </motion.div>
        <motion.p
          animate={fadeUpVisible}
          className="hero-role"
          initial={fadeUpHidden}
          transition={getRevealTransition(3)}
        >
          专注 React、TypeScript 与可维护界面，把复杂信息整理成有质感、响应迅速的数字体验。
        </motion.p>
        <motion.div
          animate={fadeUpVisible}
          className="hero-keywords"
          initial={fadeUpHidden}
          transition={getRevealTransition(4)}
        >
          {keywordTags.map((tag) => (
            <span
              className="tag-pill hero-keyword"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </motion.div>
        <motion.div
          animate={fadeUpVisible}
          className="hero-actions"
          initial={fadeUpHidden}
          transition={getRevealTransition(5)}
        >
          <a className="btn-primary w-full sm:w-auto" href="#projects">
            查看项目
          </a>
          <a className="btn-secondary w-full sm:w-auto" href="#contact">
            联系我
          </a>
        </motion.div>
      </div>

      <motion.div
        animate={fadeUpVisible}
        className="hero-visual"
        initial={fadeUpHidden}
        transition={getRevealTransition(0, 0.22)}
      >
        <div className="glass-card hero-console">
          <div className="accent-line" />
          <div className="console-header">
            <div>
              <p className="meta-label">
                Personal Console
              </p>
              <p className="card-title mt-1 text-lg sm:text-xl">
                Jordnary Control Deck
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
                  <p className="console-avatar-role">Digital Builder</p>
                </div>
              </div>
              <img
                alt=""
                className="console-core-image"
                src={heroImg}
              />
              <div className="console-scanline" aria-hidden="true" />
              <div className="console-readout">
                <span>Build Pulse</span>
                <strong>98%</strong>
              </div>
            </div>

            <div className="console-metrics">
              {consoleMetrics.map((item) => (
                <div
                  className="console-metric"
                  key={item.label}
                >
                  <p className="meta-label-muted">
                    {item.label}
                  </p>
                  <p className="body-copy text-sm font-semibold">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="console-modules">
              {consoleModules.map((item) => (
                <div className="console-module" key={item.index}>
                  <span className="console-module-index">{item.index}</span>
                  <div className="min-w-0">
                    <p className="card-title text-sm">{item.label}</p>
                    <p className="card-copy text-sm">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="console-terminal" aria-label="Console activity">
              {consoleLogs.map((line) => (
                <p key={line}>
                  <span>$</span>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
