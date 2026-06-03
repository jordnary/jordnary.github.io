import type { ReactNode } from 'react'

type PageSectionProps = {
  children: ReactNode
  description: string
  eyebrow: string
  id: string
  title: string
}

export function PageSection({
  children,
  description,
  eyebrow,
  id,
  title,
}: PageSectionProps) {
  return (
    <section className="px-6 py-20 sm:py-24" id={id}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            {eyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-400">{description}</p>
        </div>
        {children}
      </div>
    </section>
  )
}
