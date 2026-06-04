import { useEffect, useState } from 'react'

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
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    let frameId = 0

    const updateScrollState = () => {
      frameId = 0
      setIsScrolled(window.scrollY > 12)
    }

    const scheduleUpdate = () => {
      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updateScrollState)
      }
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })

    return () => {
      window.removeEventListener('scroll', scheduleUpdate)

      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [])

  const closeMenu = () => {
    setIsOpen(false)
  }

  return (
    <header className={`nav-shell page-gutter ${isScrolled ? 'is-scrolled' : ''}`}>
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
          className={`icon-button nav-menu-button lg:hidden ${
            isOpen ? 'is-open' : ''
          }`}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className="relative h-4 w-5" aria-hidden="true">
            <span className="menu-line menu-line-top" />
            <span className="menu-line menu-line-middle" />
            <span className="menu-line menu-line-bottom" />
          </span>
        </button>
      </nav>

      <div
        className={`site-container mobile-nav-panel lg:hidden ${
          isOpen ? 'is-open' : ''
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
