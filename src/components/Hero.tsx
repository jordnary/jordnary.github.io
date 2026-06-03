import heroImg from '../assets/hero.png'

export function Hero() {
  return (
    <section
      className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 px-6 pb-20 pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:pt-32"
      id="home"
    >
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Personal Website
        </p>
        <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
          个人主页基础布局已就绪
        </h1>
        <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
          这一阶段先完成页面骨架、视觉基底和响应式容器。后续步骤会逐段加入内容、
          数据和 motion 动效。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a className="btn-primary" href="#projects">
            View structure
          </a>
          <a className="btn-secondary" href="#contact">
            Contact area
          </a>
        </div>
      </div>

      <div className="glass-card relative min-h-80 overflow-hidden p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,0.2),transparent_42%)]" />
        <img
          alt=""
          className="relative mx-auto h-full max-h-80 w-full object-contain opacity-90 drop-shadow-[0_24px_60px_rgba(56,189,248,0.2)]"
          src={heroImg}
        />
      </div>
    </section>
  )
}
