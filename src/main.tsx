import { Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n' // Initialize i18n

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
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f5f7f2', color: '#18321f', fontFamily: 'system-ui, sans-serif' }}>
          <section style={{ width: 'min(100%, 520px)', padding: '32px', border: '1px solid #d6e2d3', borderRadius: '12px', background: '#fff', textAlign: 'center', boxShadow: '0 12px 32px rgba(24, 50, 31, 0.08)' }}>
            <h1 style={{ margin: '0 0 12px', fontSize: '24px' }}>O AgriLink encontrou um problema</h1>
            <p style={{ margin: '0 0 24px', lineHeight: 1.5, color: '#526257' }}>A tela não pôde ser carregada. Recarregue a página para tentar novamente.</p>
            <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: '8px', padding: '12px 20px', background: '#1f7a3a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              Recarregar página
            </button>
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

// Reveal root (was hidden by inline critical CSS to prevent FOUC)
try {
  rootElement.classList.remove('initial-hidden')
} catch (e) {
  // ignore
}

createRoot(rootElement).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
)
