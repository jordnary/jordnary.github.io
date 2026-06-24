import { useState, type ReactNode } from 'react'
import { BackToTop } from '../components/BackToTop'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { ScrollProgress } from '../components/ScrollProgress'
import { SiteSearch } from '../components/SiteSearch'
import type { SitePage } from '../lib/routes'

type SiteLayoutProps = {
  children: ReactNode
  page: SitePage
}

export function SiteLayout({ children, page }: SiteLayoutProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return (
    <div className={`app-shell${isSearchOpen ? ' is-search-open' : ''}`} id="top">
      <div className="app-shell-content">
        <div className="ambient-bg" />
        <div className="grid-bg" />
        <ScrollProgress />
        <BackToTop />

        <Navbar activePage={page} onSearchOpen={() => setIsSearchOpen(true)} />

        <main>{children}</main>

        <Footer />
      </div>
      <SiteSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onOpen={() => setIsSearchOpen(true)}
      />
    </div>
  )
}
