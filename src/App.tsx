import { About } from './components/About'
import { Contact } from './components/Contact'
import { CursorGlow } from './components/CursorGlow'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Navbar } from './components/Navbar'
import { Projects } from './components/Projects'
import { Skills } from './components/Skills'
import { Timeline } from './components/Timeline'

function App() {
  return (
    <div className="app-shell">
      <div className="ambient-bg" />
      <div className="grid-bg" />
      <CursorGlow />

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
