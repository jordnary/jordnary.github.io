import { About } from './components/About'
import { BackToTop } from './components/BackToTop'
import { Contact } from './components/Contact'
import { CursorGlow } from './components/CursorGlow'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Navbar } from './components/Navbar'
import { Projects } from './components/Projects'
import { ScrollProgress } from './components/ScrollProgress'
import { Skills } from './components/Skills'
import { Timeline } from './components/Timeline'

function App() {
  return (
    <div className="app-shell" id="top">
      <div className="ambient-bg" />
      <div className="grid-bg" />
      <CursorGlow />
      <ScrollProgress />
      <BackToTop />

      <Navbar />

      <main>
        <Hero />
        <About />
        <Skills />
        <Projects />
        <Timeline />
        <Contact />
      </main>

      <Footer />
    </div>
  )
}

export default App
