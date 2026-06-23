import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getPageFromDocument } from './lib/routes.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App page={getPageFromDocument()} />
  </StrictMode>,
)
