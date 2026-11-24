import { Component, type ReactNode } from 'react'

/** Mostra o erro em vez de tela escura (ajuda no playtest). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <h2>Algo quebrou</h2>
        <pre>{this.state.error.message}</pre>
        <button className="btn primary" onClick={() => this.setState({ error: null })}>
          Tentar continuar
        </button>
        <button className="btn ghost" onClick={() => location.reload()}>
          Recarregar
        </button>
      </div>
    )
  }
}
