import { motion } from 'motion/react'
import heroImg from '../assets/hero.png'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
} from '../lib/animations'

const heroHighlights = [
  { label: 'Frontend', value: 'React + TypeScript' },
  { label: 'Style', value: 'Tailwind CSS' },
  { label: 'Deploy', value: 'GitHub Pages' },
]

const techTags = ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Motion']

export function Hero() {
  return (
    <section
      className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-6xl items-center gap-10 px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14"
      id="home"
    >
      <div className="max-w-2xl">
        <motion.div
          animate={fadeUpVisible}
          className="inline-flex max-w-full items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100 shadow-lg shadow-cyan-950/30 backdrop-blur sm:px-4 sm:text-sm"
          initial={fadeUpHidden}
          transition={getRevealTransition(0)}
        >
          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.85)]" />
          <span className="min-w-0">Building thoughtful digital experiences</span>
        </motion.div>
        <motion.h1
          animate={fadeUpVisible}
          className="mt-6 text-3xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl"
          initial={fadeUpHidden}
          transition={getRevealTransition(1)}
        >
          你好，我是 Jordnary，
          <span className="block bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent">
            打造清爽而有质感的 Web 体验。
          </span>
        </motion.h1>
        <motion.p
          animate={fadeUpVisible}
          className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg"
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
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300"
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
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
                Live Preview
              </p>
              <p className="mt-1 text-base font-semibold text-white sm:text-lg">
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
            <div className="flex min-h-44 items-center justify-center bg-gradient-to-br from-cyan-300/10 via-slate-900/40 to-fuchsia-300/10 p-4 sm:min-h-52">
              <img
                alt=""
                className="max-h-56 w-full object-contain opacity-90 drop-shadow-[0_24px_60px_rgba(56,189,248,0.24)]"
                src={heroImg}
              />
            </div>

            <div className="grid content-center">
              {heroHighlights.map((item) => (
                <div className="border-b border-white/10 px-1 py-4 last:border-b-0" key={item.label}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 sm:tracking-[0.22em]">
                      {item.label}
                    </p>
                    <p className="text-sm font-semibold text-slate-100">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-cyan-300/15 pt-4 text-sm text-cyan-100">
            静态优先，结构可维护，轻量动效已接入。
          </div>
        </div>
      </motion.div>
    </section>
  )
}
