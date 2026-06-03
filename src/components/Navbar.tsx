import { useState } from 'react'

const navItems = [
  { href: '#home', label: 'Home' },
  { href: '#about', label: 'About' },
  { href: '#skills', label: 'Skills' },
  { href: '#projects', label: 'Projects' },
  { href: '#timeline', label: 'Timeline' },
  { href: '#contact', label: 'Contact' },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  const closeMenu = () => {
    setIsOpen(false)
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/75 px-4 backdrop-blur-xl sm:px-6">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex h-20 max-w-6xl items-center justify-between"
      >
        <a
          className="group inline-flex items-center gap-3 text-lg font-semibold tracking-tight text-white"
          href="#home"
          onClick={closeMenu}
        >
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-sm text-cyan-100 shadow-lg shadow-cyan-950/30 transition before:content-['J'] group-hover:border-cyan-200/60 group-hover:bg-cyan-300/20"
          />
          <span>Jordnary</span>
        </a>
        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <a
              className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </div>
        <a className="btn-secondary hidden lg:inline-flex" href="#contact">
          Let&apos;s talk
        </a>
        <button
          aria-controls="mobile-navigation"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-slate-100 transition hover:border-cyan-200/50 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 lg:hidden"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className="relative h-4 w-5" aria-hidden="true">
            <span
              className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition ${
                isOpen ? 'translate-y-[7px] rotate-45' : ''
              }`}
            />
            <span
              className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition ${
                isOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition ${
                isOpen ? '-translate-y-[7px] -rotate-45' : ''
              }`}
            />
          </span>
        </button>
      </nav>

      <div
        className={`mx-auto max-w-6xl overflow-hidden transition-[max-height,opacity] duration-300 lg:hidden ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
        id="mobile-navigation"
      >
        <div className="grid gap-2 border-t border-white/10 py-4">
          {navItems.map((item) => (
            <a
              className="rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              href={item.href}
              key={item.href}
              onClick={closeMenu}
            >
              {item.label}
            </a>
          ))}
          <a className="btn-primary mt-2 w-full" href="#contact" onClick={closeMenu}>
            Let&apos;s talk
          </a>
        </div>
      </div>
    </header>
  )
}
