import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type ToastProps = {
  duration?: number
  message: string
  onClose: () => void
  open: boolean
  resetKey?: number | string
}

export function Toast({
  duration = 2000,
  message,
  onClose,
  open,
  resetKey,
}: ToastProps) {
  useToastTimer({ duration, onClose, open, resetKey })

  if (!open) {
    return null
  }

  return createPortal(
    <div
      aria-live="polite"
      className="toast"
      role="status"
      style={{ animationDuration: `${duration}ms` }}
    >
      {message}
    </div>,
    document.body,
  )
}

function useToastTimer({
  duration,
  onClose,
  open,
  resetKey,
}: Pick<ToastProps, 'duration' | 'onClose' | 'open' | 'resetKey'>) {
  useEffect(() => {
    if (!open) {
      return
    }

    const timeout = window.setTimeout(onClose, duration)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [duration, onClose, open, resetKey])
}
