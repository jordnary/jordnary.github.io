import type { ReactNode } from 'react'
import { motion, type MotionProps } from 'motion/react'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
  viewportOnce,
} from '../lib/animations'

type RevealTag = 'article' | 'aside' | 'div' | 'dl' | 'h1' | 'p'

type RevealProps = {
  ariaLabel?: string
  as?: RevealTag
  baseDelay?: number
  children: ReactNode
  className?: string
  immediate?: boolean
  index?: number
  whileHover?: MotionProps['whileHover']
}

export function Reveal({
  ariaLabel,
  as = 'div',
  baseDelay = 0,
  children,
  className,
  immediate = false,
  index = 0,
  whileHover,
}: RevealProps) {
  const revealProps = {
    'aria-label': ariaLabel,
    className,
    initial: fadeUpHidden,
    transition: getRevealTransition(index, baseDelay),
    whileHover,
    ...(immediate
      ? { animate: fadeUpVisible }
      : { viewport: viewportOnce, whileInView: fadeUpVisible }),
  }

  switch (as) {
    case 'article':
      return <motion.article {...revealProps}>{children}</motion.article>
    case 'aside':
      return <motion.aside {...revealProps}>{children}</motion.aside>
    case 'dl':
      return <motion.dl {...revealProps}>{children}</motion.dl>
    case 'h1':
      return <motion.h1 {...revealProps}>{children}</motion.h1>
    case 'p':
      return <motion.p {...revealProps}>{children}</motion.p>
    case 'div':
      return <motion.div {...revealProps}>{children}</motion.div>
  }
}
