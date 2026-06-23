import type { ReactNode } from 'react'
import { BackToTop } from '../components/BackToTop'
import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'
import { ScrollProgress } from '../components/ScrollProgress'
import type { SitePage } from '../lib/routes'

type SiteLayoutProps = {
  children: ReactNode
  page: SitePage
}

export function SiteLayout({ children, page }: SiteLayoutProps) {
  return (
    <div className="app-shell" id="top">
      <div className="ambient-bg" />
      <div className="grid-bg" />
      <ScrollProgress />
      <BackToTop />

      <Navbar activePage={page} />

      <main>{children}</main>

      <Footer />
    </div>
  )
}
