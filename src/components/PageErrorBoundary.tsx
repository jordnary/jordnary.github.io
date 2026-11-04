import { Component, type ReactNode } from 'react'
import { isPagePreloadError } from '../lib/page-loaders'
import { reopenPage } from '../lib/page-loading'
import { PageLoadFeedback } from './PageLoadFeedback'

type Props = { href: string; children: ReactNode; onError: () => void }
type State = { href: string; failed: boolean; preload: boolean }

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { href: this.props.href, failed: false, preload: false }

  static getDerivedStateFromProps(props: Props, state: State) {
    return props.href === state.href ? null : { href: props.href, failed: false, preload: false }
  }

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, preload: isPagePreloadError(error) }
  }

  componentDidCatch() { this.props.onError() }

  componentDidUpdate(_props: Props, previous: State) {
    if (previous.failed && !this.state.failed) document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
  }

  render() {
    if (this.state.failed) return <PageLoadFeedback state={{ href: this.props.href, status: 'error', reason: this.state.preload ? 'load' : 'render' }}
      onRetry={() => {
        if (this.state.preload) reopenPage(this.props.href)
        else this.setState({ failed: false })
      }} />
    return this.props.children
  }
}
