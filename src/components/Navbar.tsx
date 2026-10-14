import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { getGitHubSnapshot } from '../lib/github'
import { useNavScrollVisibility } from '../lib/useNavScrollVisibility'
import { getHomepagePortalHref, getRouteHref, sitePages, siteRoutes, type SitePage } from '../lib/routes'
import { navigationSections, type NavigationIcon } from '../data/navigation'
import { navigationPhotos, type NavigationPhoto } from '../data/navigation-photos'
import './Navbar.css'

type NavbarProps = { activePage: SitePage; onSearchOpen: () => void }

export function Navbar({ activePage, onSearchOpen }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mobilePage, setMobilePage] = useState<SitePage | null>(null)
  const [mobileSubmenuOpen, setMobileSubmenuOpen] = useState(false)
  const [expandedPage, setExpandedPage] = useState<SitePage | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const { isScrolled, isHidden } = useNavScrollVisibility(headerRef, Boolean(expandedPage || isOpen), activePage)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const mobilePanelRef = useRef<HTMLElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    const header = headerRef.current
    const panel = header?.querySelector<HTMLElement>(`#nav-panel-${expandedPage}`)
    if (!header) return
    if (!expandedPage || !panel) {
      header.style.setProperty('--nav-panel-height', '0px')
      return
    }
    const updateSurfaceHeight = () => {
      header.style.setProperty('--nav-panel-height', `${Math.ceil(panel.getBoundingClientRect().height)}px`)
    }
    updateSurfaceHeight()
    const observer = new ResizeObserver(updateSurfaceHeight)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [expandedPage])

  useEffect(() => {
    let active = true
    getGitHubSnapshot().then(({ snapshot }) => {
      if (active) setAvatarUrl(snapshot.profile.avatarUrl ?? 'https://github.com/jordnary.png?size=96')
    }).catch(() => {
      if (active) setAvatarUrl('https://github.com/jordnary.png?size=96')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const dismiss = () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      if (openTimer.current) clearTimeout(openTimer.current)
      setExpandedPage(null)
      dialogRef.current?.close()
      setIsOpen(false)
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        if (openTimer.current) clearTimeout(openTimer.current)
        if (closeTimer.current) clearTimeout(closeTimer.current)
        setExpandedPage(null)
      }
    }
    const desktop = window.matchMedia('(min-width: 1024px)')
    desktop.addEventListener('change', dismiss)
    window.addEventListener('popstate', dismiss)
    document.addEventListener('pointerdown', outside)
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      if (openTimer.current) clearTimeout(openTimer.current)
      desktop.removeEventListener('change', dismiss)
      window.removeEventListener('popstate', dismiss)
      document.removeEventListener('pointerdown', outside)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    closeButtonRef.current?.focus()
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isOpen || !mobilePage) return
    if (mobileSubmenuOpen) {
      const panel = mobilePanelRef.current
      if (panel) panel.scrollTop = 0
      panel?.querySelector<HTMLButtonElement>('.mobile-nav-back')?.focus({ preventScroll: true })
    } else {
      dialogRef.current?.querySelector<HTMLButtonElement>(`#mobile-nav-toggle-${mobilePage}`)?.focus({ preventScroll: true })
    }
  }, [isOpen, mobilePage, mobileSubmenuOpen])

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (openTimer.current) clearTimeout(openTimer.current)
    closeTimer.current = null
    openTimer.current = null
  }
  const closeMenu = () => {
    cancelClose()
    setExpandedPage(null)
    dialogRef.current?.close()
    setIsOpen(false)
  }
  const openSearch = () => { closeMenu(); onSearchOpen() }
  const openWithKeyboard = (event: KeyboardEvent, page: SitePage) => {
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    cancelClose()
    setExpandedPage(page)
    window.requestAnimationFrame(() => headerRef.current?.querySelector<HTMLAnchorElement>(`#nav-panel-${page} a`)?.focus())
  }
  const mobileSection = mobilePage ? navigationSections[mobilePage] : undefined
  const brand = (
    <a className="nav-brand" href={getHomepagePortalHref()} onClick={closeMenu}>
      <span className="brand-mark">
        {avatarUrl ? <img alt="" aria-hidden="true" onError={() => setAvatarUrl(null)} src={avatarUrl} /> : <span aria-hidden="true">J</span>}
      </span>
      <span>Jordnary</span>
    </a>
  )

  return (
    <>
      <header
        className={`nav-shell page-gutter ${isScrolled ? 'is-scrolled' : ''} ${isHidden && !expandedPage && !isOpen ? 'is-hidden' : ''}`}
        ref={headerRef}
        onPointerEnter={cancelClose}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'mouse') return
          cancelClose()
          closeTimer.current = setTimeout(() => {
            // Preserve the panel while a keyboard user is reading its links.
            if (!headerRef.current?.querySelector('.nav-mega-panel:focus-within')) setExpandedPage(null)
          }, 180)
        }}
        onBlur={(event) => {
          // Switching panels makes outgoing links inert and clears their focus.
          if (!event.relatedTarget && event.target.closest('.nav-mega-panel[inert]')) return
          if (!event.currentTarget.contains(event.relatedTarget)) { cancelClose(); setExpandedPage(null) }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && expandedPage) {
            event.preventDefault()
            headerRef.current?.querySelector<HTMLButtonElement>(`#nav-toggle-${expandedPage}`)?.focus()
            cancelClose()
            setExpandedPage(null)
          }
        }}
      >
        <nav aria-label="主导航" className="site-container nav-content">
          {brand}
          <ul className="nav-desktop-list">
            {sitePages.map((page) => {
              const section = navigationSections[page]
              const expanded = expandedPage === page
              return (
                <li
                  className={`nav-item ${activePage === page ? 'is-active' : ''} ${expanded ? 'is-expanded' : ''}`}
                  key={page}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== 'mouse') return
                    cancelClose()
                    if (section) openTimer.current = setTimeout(() => setExpandedPage(page), 120)
                    else setExpandedPage(null)
                  }}
                  onPointerLeave={() => { if (openTimer.current) clearTimeout(openTimer.current) }}
                >
                  <div className="nav-item-heading">
                    <a
                      aria-current={activePage === page ? 'page' : undefined}
                      className={`nav-link ${activePage === page ? 'is-active' : ''}`}
                      href={getRouteHref(page)}
                      onClick={closeMenu}
                      onKeyDown={section ? (event) => openWithKeyboard(event, page) : undefined}
                    ><span className="nav-link-label">{siteRoutes[page].label}</span></a>
                    {section && <button
                      aria-label={`${expanded ? '收起' : '展开'}${siteRoutes[page].label}菜单`}
                      aria-expanded={expanded}
                      aria-controls={`nav-panel-${page}`}
                      className="nav-dropdown-toggle"
                      id={`nav-toggle-${page}`}
                      onClick={() => { cancelClose(); setExpandedPage(expanded ? null : page) }}
                      onKeyDown={(event) => openWithKeyboard(event, page)}
                      type="button"
                    ><ChevronIcon /></button>}
                  </div>
                  {section && <div className={`nav-mega-panel nav-mega-panel--${page} page-gutter`} id={`nav-panel-${page}`} hidden={!expanded} inert={!expanded}>
                    <div className="site-container nav-mega-content">
                      <div className="nav-mega-intro">
                        <span className="nav-eyebrow">{section.eyebrow}</span>
                        <h2>{section.title}</h2>
                        <p>{section.description}</p>
                        <a className="nav-overview-link" href={getRouteHref(page)} onClick={closeMenu}>
                          {page === 'projects' ? '探索全部项目' : page === 'learning' ? '浏览学习内容' : '更多关于我'}<ArrowIcon />
                        </a>
                      </div>
                      <div className="nav-mega-links">
                        <span className="nav-column-label">{page === 'projects' ? '精选项目' : page === 'about' ? '关于我' : '探索内容'}</span>
                        <div className="nav-feature-list">
                          {section.links.map((link, index) => <a className={`nav-feature-link ${link.photo ? 'nav-feature-link--photo' : ''}`} href={link.href} key={link.href} onClick={closeMenu}>
                            {link.photo ? <span className="nav-photo-frame"><NavigationImage photo={link.photo} /></span> : <span className={`nav-feature-icon nav-feature-icon--${index}`}><NavigationGlyph icon={link.icon} /></span>}
                            <span className="nav-feature-copy">
                              {link.category && <span className="nav-photo-category">{link.category}</span>}
                              <strong>{link.label}</strong><small>{link.description}</small>
                            </span>
                            <ArrowIcon />
                          </a>)}
                        </div>
                      </div>
                      <div className="nav-related-links">
                        {section.feature ? <a className="nav-story-link" href={section.feature.href} onClick={closeMenu}>
                          <span className="nav-photo-frame"><NavigationImage photo={section.feature.photo} /></span>
                          <span className="nav-story-copy"><strong>{section.feature.label}</strong><small>{section.feature.caption}</small></span>
                          <ArrowIcon />
                        </a> : <span className="nav-column-label">继续发现</span>}
                        <div className="nav-related-list">
                          {section.related.map((link) => <a href={link.href} key={link.href} onClick={closeMenu}><span>{link.label}</span><ArrowIcon /></a>)}
                        </div>
                      </div>
                    </div>
                  </div>}
                </li>
              )
            })}
          </ul>
          <div className="nav-actions">
            <button aria-haspopup="dialog" aria-label="搜索站内内容" className="nav-search-button" onClick={openSearch} type="button">
              <SearchIcon /><span className="nav-search-label">搜索</span><kbd className="nav-search-shortcut">Ctrl K</kbd>
            </button>
            <button
              aria-controls="mobile-navigation"
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              aria-label="打开导航菜单"
              className={`icon-button nav-menu-button ${isOpen ? 'is-open' : ''}`}
              onClick={() => { setExpandedPage(null); setMobilePage(null); setMobileSubmenuOpen(false); setIsOpen(true) }}
              type="button"
            ><MenuIcon /></button>
          </div>
        </nav>
      </header>
      {createPortal(<dialog
        aria-label="全站导航"
        className="mobile-nav-dialog"
        id="mobile-navigation"
        inert={!isOpen}
        onCancel={(event) => { event.preventDefault(); closeMenu() }}
        onClose={(event) => { if (!event.currentTarget.open) setIsOpen(false) }}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]
              .filter((control) => !control.closest('[inert]') && control.getClientRects().length > 0)
            const first = controls[0]
            const last = controls[controls.length - 1]
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault()
            event.stopPropagation()
            openSearch()
          }
        }}
        ref={dialogRef}
      >
        <div className="mobile-nav-layout">
          <div className="mobile-nav-header">
            {brand}
            <button aria-label="关闭导航菜单" className="mobile-nav-close" onClick={closeMenu} ref={closeButtonRef} type="button"><MenuIcon /></button>
          </div>
          <div className="mobile-nav-body">
            <div className="mobile-nav-primary" inert={mobileSubmenuOpen} aria-hidden={mobileSubmenuOpen}>
              <nav aria-label="移动端主导航" className="mobile-nav-list">
                {sitePages.map((page) => navigationSections[page] ? <button
                  aria-current={activePage === page ? 'page' : undefined}
                  aria-controls="mobile-navigation-panel"
                  aria-expanded={mobileSubmenuOpen && mobilePage === page}
                  className={`mobile-nav-link ${activePage === page ? 'is-active' : ''}`}
                  id={`mobile-nav-toggle-${page}`}
                  key={page}
                  onClick={() => { setMobilePage(page); setMobileSubmenuOpen(true) }}
                  type="button"
                ><span>{siteRoutes[page].label}</span><ChevronIcon /></button> : <a
                  aria-current={activePage === page ? 'page' : undefined}
                  className={`mobile-nav-link ${activePage === page ? 'is-active' : ''}`}
                  href={getRouteHref(page)}
                  key={page}
                  onClick={closeMenu}
                ><span>{siteRoutes[page].label}</span><ChevronIcon /></a>)}
              </nav>
              <div className="mobile-nav-footer">
                <button className="mobile-nav-search" onClick={openSearch} type="button"><SearchIcon /><span>搜索站内内容</span><ArrowIcon /></button>
              </div>
            </div>
            <nav
              aria-label={mobilePage ? `${siteRoutes[mobilePage].label}导航` : '栏目导航'}
              aria-hidden={!mobileSubmenuOpen}
              className={`mobile-nav-panel ${mobileSubmenuOpen ? 'is-active' : ''}`}
              id="mobile-navigation-panel"
              inert={!mobileSubmenuOpen}
              ref={mobilePanelRef}
            >
              {mobilePage && mobileSection && <>
                <button className="mobile-nav-back" onClick={() => setMobileSubmenuOpen(false)} type="button"><ArrowIcon /><span>返回</span></button>
                <div className="mobile-nav-section mobile-nav-intro">
                  <span className="nav-eyebrow">{mobileSection.eyebrow}</span>
                  <h2>{mobileSection.title}</h2>
                  <p>{mobileSection.description}</p>
                  <a className="mobile-nav-overview" href={getRouteHref(mobilePage)} onClick={closeMenu}>
                    <span className="mobile-nav-bullet"><ArrowIcon /></span>
                    <span>{mobilePage === 'projects' ? '探索全部项目' : mobilePage === 'learning' ? '浏览学习内容' : '更多关于我'}</span>
                  </a>
                </div>
                {mobileSection.feature && <div className="mobile-nav-section">
                  <a className="mobile-nav-story" href={mobileSection.feature.href} onClick={closeMenu}>
                    <span className="nav-photo-frame"><NavigationImage photo={mobileSection.feature.photo} sizes="(max-width: 1023px) 112px, 260px" /></span>
                    <span className="nav-story-copy"><strong>{mobileSection.feature.label}</strong><small>{mobileSection.feature.caption}</small><span className="mobile-nav-story-action">了解更多 <ArrowIcon /></span></span>
                  </a>
                </div>}
                <div className="mobile-nav-section">
                  <h3>{mobilePage === 'projects' ? '精选项目' : mobilePage === 'about' ? '关于我' : '探索内容'}</h3>
                  <div className="mobile-nav-features">
                    {mobileSection.links.map((link, index) => <a className="mobile-nav-feature" href={link.href} key={link.href} onClick={closeMenu}>
                      {link.photo ? <span className="nav-photo-frame"><NavigationImage photo={link.photo} sizes="(max-width: 1023px) 88px, 260px" /></span> : <span className={`nav-feature-icon nav-feature-icon--${index}`}><NavigationGlyph icon={link.icon} /></span>}
                      <span className="mobile-nav-feature-copy">{link.category && <span className="nav-photo-category">{link.category}</span>}<strong>{link.label}</strong><small>{link.description}</small></span>
                    </a>)}
                  </div>
                </div>
                <div className="mobile-nav-section mobile-nav-related">
                  <h3>继续发现</h3>
                  {mobileSection.related.map((link) => <a href={link.href} key={link.href} onClick={closeMenu}><span className="mobile-nav-bullet"><ArrowIcon /></span><span>{link.label}</span></a>)}
                </div>
              </>}
            </nav>
          </div>
        </div>
      </dialog>, document.body)}
    </>
  )
}

function NavigationImage({ photo, sizes }: { photo: NavigationPhoto; sizes?: string }) {
  const image = navigationPhotos[photo]
  const base = `${import.meta.env.BASE_URL}images/navigation/${image.file}`
  return <img
    alt={image.alt}
    src={`${base}-640.webp`}
    srcSet={`${base}-640.webp 640w, ${base}-1920.webp 1920w`}
    sizes={sizes ?? (photo === 'landscape' ? '(min-width: 1200px) 320px, 28vw' : '(min-width: 1200px) 260px, 22vw')}
    width={1920}
    height={1200}
    loading="lazy"
    decoding="async"
  />
}

function MenuIcon() {
  return <span className="menu-icon" aria-hidden="true"><span className="menu-line menu-line-top" /><span className="menu-line menu-line-middle" /><span className="menu-line menu-line-bottom" /></span>
}

function ChevronIcon() {
  return <svg aria-hidden="true" className="nav-chevron" fill="none" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
}
function ArrowIcon() {
  return <svg aria-hidden="true" className="nav-arrow" fill="none" viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
}
function SearchIcon() {
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></svg>
}
function NavigationGlyph({ icon }: { icon: NavigationIcon }) {
  const paths: Record<NavigationIcon, string> = {
    person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
    path: 'M6 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm0 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 4h7a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h10m-3-3 3 3-3 3',
    book: 'M12 5C8 2 4 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-2-1-6-2-10 1Zm0 0v16',
    grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
    code: 'm8 7-5 5 5 5m8-10 5 5-5 5M14 3l-4 18',
    spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',
  }
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d={paths[icon]} /></svg>
}
