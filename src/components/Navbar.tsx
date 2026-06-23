import { useEffect, useState, type CSSProperties } from 'react'
import {
  applyTheme,
  getInitialTheme,
  storeTheme,
  type Theme,
} from '../lib/theme'
import { getRouteHref, sitePages, siteRoutes, type SitePage } from '../lib/routes'

const getStaggerStyle = (index: number) =>
  ({ '--stagger-delay': `${60 + index * 42}ms` } as CSSProperties)

export function Navbar({ activePage }: { activePage: SitePage }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

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

  const handleThemeToggle = () => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'

      storeTheme(nextTheme)

      return nextTheme
    })
  }

  const themeToggleLabel =
    theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'

  return (
    <header
      className={`nav-shell page-gutter ${isScrolled ? 'is-scrolled' : ''}`}
    >
      <nav
        aria-label="Primary navigation"
        className="site-container nav-content"
      >
        <a className="nav-brand" href={getRouteHref('home')} onClick={closeMenu}>
          <span aria-hidden="true" className="brand-mark" />
          <span>Jordnary</span>
        </a>
        <div className="hidden items-center gap-1 lg:flex">
          {sitePages.map((page) => (
            <a
              aria-current={activePage === page ? 'page' : undefined}
              className={`nav-link ${activePage === page ? 'is-active' : ''}`}
              href={getRouteHref(page)}
              key={page}
            >
              <span className="nav-link-label">{siteRoutes[page].label}</span>
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <button
            aria-label={themeToggleLabel}
            aria-pressed={theme === 'dark'}
            className="icon-button theme-toggle-button"
            onClick={handleThemeToggle}
            title={themeToggleLabel}
            type="button"
          >
            <span aria-hidden="true" className="theme-toggle-icon">
              <svg
                className="theme-icon theme-icon-sun"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.8v2.4" />
                <path d="M12 18.8v2.4" />
                <path d="m4.2 4.2 1.7 1.7" />
                <path d="m18.1 18.1 1.7 1.7" />
                <path d="M2.8 12h2.4" />
                <path d="M18.8 12h2.4" />
                <path d="m4.2 19.8 1.7-1.7" />
                <path d="m18.1 5.9 1.7-1.7" />
              </svg>
              <svg
                className="theme-icon theme-icon-moon"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path d="M20.2 14.2A7.7 7.7 0 0 1 9.8 3.8a8.5 8.5 0 1 0 10.4 10.4Z" />
              </svg>
            </span>
          </button>
          <a className="btn-secondary hidden lg:inline-flex" href={getRouteHref('contact')}>
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
        </div>
      </nav>

      <div
        className={`mobile-nav-panel lg:hidden ${isOpen ? 'is-open' : ''}`}
        id="mobile-navigation"
      >
        <div className="mobile-nav-list">
          {sitePages.map((page, index) => (
            <a
              aria-current={activePage === page ? 'page' : undefined}
              className={`mobile-nav-link mobile-nav-item ${
                activePage === page ? 'is-active' : ''
              }`}
              href={getRouteHref(page)}
              key={page}
              onClick={closeMenu}
              style={getStaggerStyle(index)}
            >
              <span className="nav-link-label">{siteRoutes[page].label}</span>
            </a>
          ))}
          <a
            className="btn-primary mobile-nav-item mt-2 w-full"
            href={getRouteHref('contact')}
            onClick={closeMenu}
            style={getStaggerStyle(sitePages.length)}
          >
            联系我
          </a>
        </div>
      </div>
    </header>
  )
}
