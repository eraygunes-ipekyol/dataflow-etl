import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// FOUC önleme: React mount olmadan önce temayı uygula
;(function initTheme() {
  const stored = localStorage.getItem('theme') as 'dark' | 'light' | 'system' | null
  const theme = stored ?? 'dark'
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
