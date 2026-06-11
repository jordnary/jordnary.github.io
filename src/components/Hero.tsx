import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
} from '../lib/animations'

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
  'Undergraduate Learner',
  'CS Fundamentals',
  'AI Learning Notes',
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
      <div className="hero-decor" aria-hidden="true">
        <span className="hero-decor-glow hero-decor-glow-left" />
        <span className="hero-decor-glow hero-decor-glow-right" />
        <span className="hero-decor-grid" />
        <span className="hero-decor-line hero-decor-line-a" />
        <span className="hero-decor-line hero-decor-line-b" />
        <span className="hero-decor-line hero-decor-line-c" />
        <span className="hero-decor-dot hero-decor-dot-a" />
        <span className="hero-decor-dot hero-decor-dot-b" />
        <span className="hero-decor-dot hero-decor-dot-c" />
        <span className="hero-decor-dot hero-decor-dot-d" />
        <span className="hero-decor-dot hero-decor-dot-e" />
        <span className="hero-decor-mark hero-decor-mark-a" />
        <span className="hero-decor-mark hero-decor-mark-b" />
      </div>

      <div className="hero-copy">
        <motion.div
          animate={fadeUpVisible}
          className="highlight-pill"
          initial={fadeUpHidden}
          transition={getRevealTransition(0)}
        >
          <span className="glow-dot" />
          <span className="min-w-0">Learning Computer Science, AI and Web Development</span>
        </motion.div>
        <motion.h1
          animate={fadeUpVisible}
          aria-label="你好，我是 Jordnary，一名正在探索 AI 与 Web 开发的学生。"
          className="hero-title"
          initial={fadeUpHidden}
          transition={getRevealTransition(1)}
        >
          <span className="block">你好，我是 Jordnary</span>
          <span className="gradient-text block">
            一名正在探索 AI 与 Web 开发的学生。
          </span>
        </motion.h1>
        <motion.div
          animate={fadeUpVisible}
          aria-label="角色标签循环展示：Undergraduate Learner、CS Fundamentals、AI Learning Notes、AI & Web Explorer。"
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
          这里记录我的学习路径、项目实践、技术笔记与阶段性作品。我正在系统学习计算机基础、数据库、机器学习、深度学习和大模型相关知识，也会用 React、TypeScript 和 GitHub Pages 搭建自己的展示空间。
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
          <a className="btn-primary hero-cta hero-cta-primary w-full sm:w-auto" href="#projects">
            <span className="hero-cta-label">查看项目</span>
            <span className="hero-cta-arrow" aria-hidden="true">→</span>
          </a>
          <a className="btn-secondary hero-cta hero-cta-secondary w-full sm:w-auto" href="#contact">
            <span className="hero-cta-label">联系我</span>
            <span className="hero-cta-arrow" aria-hidden="true">→</span>
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
                  <p className="console-avatar-role">Undergraduate Learner</p>
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

            <div className="console-footer">
              <div className="console-flow" aria-label="Control deck workflow">
                {consoleFlow.map((item, index) => (
                  <span className="console-flow-step" key={item}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {item}
                  </span>
                ))}
              </div>
              <div className="console-terminal" aria-label="Console activity">
                <p>
                  <span>$</span>
                  持续学习，持续构建，持续记录。
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

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
