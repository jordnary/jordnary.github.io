import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode; onError: (error: unknown) => void }
type State = { failed: boolean }

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: unknown) { this.props.onError(error) }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}
