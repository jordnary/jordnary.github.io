import { useEffect, useState, type CSSProperties } from 'react'

const navItems = [
  { href: '#home', id: 'home', label: '首页' },
  { href: '#about', id: 'about', label: '关于' },
  { href: '#skills', id: 'skills', label: '技能' },
  { href: '#projects', id: 'projects', label: '项目' },
  { href: '#timeline', id: 'timeline', label: '路径' },
  { href: '#contact', id: 'contact', label: '联系' },
] as const

type SectionId = (typeof navItems)[number]['id']

const observerThresholds = Array.from({ length: 21 }, (_, index) => index / 20)

const getStaggerStyle = (index: number) =>
  ({ '--stagger-delay': `${60 + index * 42}ms` } as CSSProperties)

export function Navbar() {
  const [activeSection, setActiveSection] = useState<SectionId>('home')
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

  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section))

    if (sections.length === 0) {
      return
    }

    const getCurrentSection = () => {
      const viewportAnchor = window.innerHeight * 0.42
      let currentSection = sections[0].id as SectionId

      for (const section of sections) {
        const rect = section.getBoundingClientRect()

        if (rect.top <= viewportAnchor && rect.bottom > viewportAnchor) {
          currentSection = section.id as SectionId
          break
        }

        if (rect.top < viewportAnchor) {
          currentSection = section.id as SectionId
        }
      }

      return currentSection
    }

    const updateActiveSection = () => {
      const nextSection = getCurrentSection()

      setActiveSection((current) =>
        current === nextSection ? current : nextSection,
      )
    }

    const observer = new IntersectionObserver(updateActiveSection, {
      root: null,
      rootMargin: '-30% 0px -45% 0px',
      threshold: observerThresholds,
    })

    sections.forEach((section) => observer.observe(section))
    updateActiveSection()

    return () => {
      observer.disconnect()
    }
  }, [])

  const closeMenu = () => {
    setIsOpen(false)
  }

  const handleNavItemClick = (sectionId: SectionId) => {
    setActiveSection(sectionId)
    closeMenu()
  }

  return (
    <header
      className={`nav-shell page-gutter ${isScrolled ? 'is-scrolled' : ''}`}
    >
      <nav
        aria-label="Primary navigation"
        className="site-container nav-content"
      >
        <a
          className="nav-brand"
          href="#home"
          onClick={() => handleNavItemClick('home')}
        >
          <span aria-hidden="true" className="brand-mark" />
          <span>Jordnary</span>
        </a>
        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const isActive = activeSection === item.id

            return (
              <a
                aria-current={isActive ? 'page' : undefined}
                className={`nav-link ${isActive ? 'is-active' : ''}`}
                href={item.href}
                key={item.href}
                onClick={() => handleNavItemClick(item.id)}
              >
                <span className="nav-link-label">{item.label}</span>
              </a>
            )
          })}
        </div>
        <a
          className="btn-secondary hidden lg:inline-flex"
          href="#contact"
          onClick={() => handleNavItemClick('contact')}
        >
          联系我
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
          <span className="menu-icon" aria-hidden="true">
            <span className="menu-line menu-line-top" />
            <span className="menu-line menu-line-middle" />
            <span className="menu-line menu-line-bottom" />
          </span>
        </button>
      </nav>

      <div
        className={`mobile-nav-panel lg:hidden ${
          isOpen ? 'is-open' : ''
        }`}
        id="mobile-navigation"
      >
        <div className="mobile-nav-list">
          {navItems.map((item, index) => {
            const isActive = activeSection === item.id

            return (
              <a
                aria-current={isActive ? 'page' : undefined}
                className={`mobile-nav-link mobile-nav-item ${
                  isActive ? 'is-active' : ''
                }`}
                href={item.href}
                key={item.href}
                onClick={() => handleNavItemClick(item.id)}
                style={getStaggerStyle(index)}
              >
                <span className="nav-link-label">{item.label}</span>
              </a>
            )
          })}
          <a
            className="btn-primary mobile-nav-item mt-2 w-full"
            href="#contact"
            onClick={() => handleNavItemClick('contact')}
            style={getStaggerStyle(navItems.length)}
          >
            联系我
          </a>
        </div>
      </div>
    </header>
  )
}
