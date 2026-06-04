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
    <header className="nav-shell page-gutter">
      <nav
        aria-label="Primary navigation"
        className="site-container nav-content"
      >
        <a
          className="nav-brand"
          href="#home"
          onClick={closeMenu}
        >
          <span aria-hidden="true" className="brand-mark" />
          <span>Jordnary</span>
        </a>
        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <a
              className="nav-link"
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
          className="icon-button lg:hidden"
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
        className={`site-container mobile-nav-panel lg:hidden ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
        id="mobile-navigation"
      >
        <div className="mobile-nav-list">
          {navItems.map((item) => (
            <a
              className="mobile-nav-link"
              href={item.href}
              key={item.href}
              onClick={closeMenu}
            >
              {item.label}
            </a>
          ))}
          <a
            className="btn-primary mt-2 w-full"
            href="#contact"
            onClick={closeMenu}
          >
            Let&apos;s talk
          </a>
        </div>
      </div>
    </header>
  )
}
