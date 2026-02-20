import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles/theme.css'
import './ui/styles/global.css'
import './ui/styles/components.css'
import { App } from './ui/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
