import { motion } from 'motion/react'
import heroImg from '../assets/hero.png'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
} from '../lib/animations'

const heroHighlights = [
  {
    label: 'Frontend',
    value: 'React + TypeScript',
  },
  {
    label: 'Style',
    value: 'Tailwind CSS',
  },
  {
    label: 'Deploy',
    value: 'GitHub Pages',
  },
]

const techTags = [
  'React',
  'TypeScript',
  'Tailwind CSS',
  'Vite',
  'Motion',
]

export function Hero() {
  return (
    <section className="site-container page-gutter hero-section" id="home">
      <div className="max-w-2xl">
        <motion.div
          animate={fadeUpVisible}
          className="highlight-pill"
          initial={fadeUpHidden}
          transition={getRevealTransition(0)}
        >
          <span className="glow-dot" />
          <span className="min-w-0">Building thoughtful digital experiences</span>
        </motion.div>
        <motion.h1
          animate={fadeUpVisible}
          className="hero-title"
          initial={fadeUpHidden}
          transition={getRevealTransition(1)}
        >
          你好，我是 Jordnary，
          <span className="gradient-text block">
            打造清爽而有质感的 Web 体验。
          </span>
        </motion.h1>
        <motion.p
          animate={fadeUpVisible}
          className="lead-copy mt-6 max-w-xl"
          initial={fadeUpHidden}
          transition={getRevealTransition(2)}
        >
          这里会逐步沉淀我的项目、技能、经历与联系方式。首屏先聚焦清晰表达、
          快速导航和适合 GitHub Pages 的静态展示体验。
        </motion.p>
        <motion.div
          animate={fadeUpVisible}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
          initial={fadeUpHidden}
          transition={getRevealTransition(3)}
        >
          <a className="btn-primary w-full sm:w-auto" href="#projects">
            View projects
          </a>
          <a className="btn-secondary w-full sm:w-auto" href="#contact">
            Contact me
          </a>
        </motion.div>
        <motion.div
          animate={fadeUpVisible}
          className="mt-8 flex flex-wrap gap-2"
          initial={fadeUpHidden}
          transition={getRevealTransition(4)}
        >
          {techTags.map((tag) => (
            <span
              className="tag-pill py-1.5 text-sm"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </motion.div>
      </div>

      <motion.div
        animate={fadeUpVisible}
        className="relative"
        initial={fadeUpHidden}
        transition={getRevealTransition(0, 0.22)}
      >
        <div className="glass-card relative overflow-hidden p-4 sm:p-6">
          <div className="accent-line" />
          <div className="flex items-center justify-between border-b border-subtle pb-4">
            <div>
              <p className="meta-label">
                Live Preview
              </p>
              <p className="card-title mt-1 text-base sm:text-lg">
                Personal console
              </p>
            </div>
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
            </div>
          </div>

          <div className="grid gap-5 py-6 sm:py-7 md:grid-cols-[0.95fr_1.05fr] lg:grid-cols-1 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="hero-preview-media">
              <img
                alt=""
                className="hero-preview-image"
                src={heroImg}
              />
            </div>

            <div className="grid content-center">
              {heroHighlights.map((item) => (
                <div
                  className="border-b border-subtle px-1 py-4 last:border-b-0"
                  key={item.label}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="meta-label-muted">
                      {item.label}
                    </p>
                    <p className="body-copy text-sm font-semibold">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-accent-subtle pt-4 text-sm text-accent">
            静态优先，结构可维护，轻量动效已接入。
          </div>
        </div>
      </motion.div>
    </section>
  )
}
