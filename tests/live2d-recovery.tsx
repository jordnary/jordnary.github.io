import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Live2DCompanion } from '../src/components/Live2DCompanion'
import '../src/index.css'

sessionStorage.setItem('site-live2d-collapsed-desktop', 'false')
sessionStorage.setItem('site-live2d-collapsed-mobile', 'false')
localStorage.setItem('site-live2d-chat-enabled', 'true')

export function Fixture() {
  const [mounted, setMounted] = useState(false)
  const [suspended, setSuspended] = useState(false)
  return <>
    <button onClick={() => setMounted((value) => !value)}>Toggle mount</button>
    <button onClick={() => setSuspended((value) => !value)}>Toggle suspension</button>
    {mounted && <Live2DCompanion suspended={suspended} />}
  </>
}
createRoot(document.querySelector('#fixture')!).render(<Fixture />)
