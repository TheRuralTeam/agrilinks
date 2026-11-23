import { Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n' // Initialize i18n
import { R, T } from './lib/brand'

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erro ao renderizar a aplicação:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: T.canvas, color: T.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
          <section style={{ width: 'min(100%, 520px)', padding: 32, border: 'none', borderRadius: R.md, background: T.white, textAlign: 'center', boxShadow: '0 12px 32px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: '0 0 12px', color: T.g600, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em' }}>AGRILINK</p>
            <h1 style={{ margin: '0 0 12px', fontSize: 24 }}>A tela não pôde ser carregada</h1>
            <p style={{ margin: '0 0 24px', lineHeight: 1.5, color: T.muted }}>Ocorreu um erro inesperado. Tente novamente ou volte à página inicial.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
              <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: R.md, padding: '12px 20px', background: 'rgba(44,134,59,0.10)', color: T.g700, fontWeight: 700, cursor: 'pointer', font: 'inherit' }}>
                Tentar novamente
              </button>
              <button type="button" onClick={() => window.location.assign('/')} style={{ border: 0, borderRadius: R.md, padding: '12px 20px', background: T.g600, color: T.white, fontWeight: 700, cursor: 'pointer', font: 'inherit' }}>
                Ir para a página inicial
              </button>
            </div>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

if ('serviceWorker' in navigator) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        registration.update().catch(() => undefined)
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}


const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Elemento raiz da aplicação não encontrado')
}

// No hiding of content — theme applied early via inline script in index.html

createRoot(rootElement).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
)
