import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type {} from './lib/pageStartup'
// Establish Tailwind's layer order before any component styles are loaded.
import './index.css'
import { NotFoundPage } from './pages/NotFoundPage'

// A missing URL stays in the address bar. Ordinary links leave this standalone
// document, so neither the route matcher nor browser history needs a fake route.
if (!window.__siteStartup?.failed) createRoot(document.getElementById('site-scroll')!).render(
  <StrictMode><NotFoundPage /></StrictMode>,
)
