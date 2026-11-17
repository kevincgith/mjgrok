import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

const root = document.getElementById('root')
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    const scope = new URL(base, window.location.href).href
    navigator.serviceWorker.register(new URL('sw.js', scope).href, { scope }).catch((err) => {
      console.error('Service worker registration failed', err)
    })
  })
}
