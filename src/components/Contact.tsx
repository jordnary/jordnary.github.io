import { useCallback, useState } from 'react'
import { motion } from 'motion/react'
import { PageSection } from './PageSection'
import { Toast } from './Toast'
import { contactLinks, contactProfile } from '../data/contact'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
  viewportOnce,
} from '../lib/animations'

export function Contact() {
  const [copyToastId, setCopyToastId] = useState(0)

  const handleToastClose = useCallback(() => {
    setCopyToastId(0)
  }, [])

  async function handleCopyEmail() {
    await copyToClipboard(contactProfile.email)
    setCopyToastId((currentId) => currentId + 1)
  }

  return (
    <PageSection
      id="contact"
      eyebrow="Contact"
      title="保持简单直接的联系入口"
      description="把最重要的联系方式放在清晰的位置，方便快速建立上下文。"
    >
      <motion.div
        className="contact-panel"
        initial={fadeUpHidden}
        transition={getRevealTransition()}
        viewport={viewportOnce}
        whileInView={fadeUpVisible}
      >
        <article className="contact-panel-copy">
          <p className="meta-label">
            {contactProfile.availability}
          </p>
          <h3 className="contact-panel-title">
            {contactProfile.title}
          </h3>
          <p className="contact-panel-description">
            {contactProfile.description}
          </p>

          <div className="contact-panel-note">
            <div>
              <span>Preferred channel</span>
              <strong>{contactProfile.email}</strong>
            </div>
            <button
              aria-label={`复制邮箱 ${contactProfile.email}`}
              className="contact-copy-button"
              onClick={handleCopyEmail}
              type="button"
            >
              <span className="contact-copy-icon" aria-hidden="true">
                <CopyIcon />
              </span>
              <span>复制邮箱</span>
            </button>
          </div>
        </article>

        <div className="contact-link-grid" aria-label="Contact links">
          {contactLinks.map((link) => (
            <a
              className="contact-link-card"
              href={link.href}
              key={link.title}
              rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              target={link.href.startsWith('http') ? '_blank' : undefined}
            >
              <div className="contact-link-header">
                <span className="contact-link-icon" aria-hidden="true">
                  <ContactIcon title={link.title} />
                </span>
                <span
                  aria-hidden="true"
                  className="contact-arrow"
                >
                  ↗
                </span>
              </div>
              <p className="meta-label contact-link-kicker">
                {link.title}
              </p>
              <p className="contact-link-label">
                {link.label}
              </p>
              <p className="contact-link-description">
                {link.description}
              </p>
            </a>
          ))}
        </div>
        <Toast
          message="已复制邮箱"
          onClose={handleToastClose}
          open={copyToastId > 0}
          resetKey={copyToastId}
        />
      </motion.div>
    </PageSection>
  )
}

async function copyToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return
    }
  } catch {
    // Fall through to the textarea fallback.
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function ContactIcon({ title }: { title: string }) {
  const iconProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  } as const

  switch (title) {
    case 'Email':
      return (
        <svg {...iconProps}>
          <rect height="14" rx="2.4" width="18" x="3" y="5" />
          <path d="m4.5 7.5 7.5 5.2 7.5-5.2" />
        </svg>
      )
    case 'GitHub':
      return (
        <svg {...iconProps}>
          <path d="M8.8 19.5c-3.2 1-3.2-1.6-4.5-2" />
          <path d="M15.2 22v-3.1a2.7 2.7 0 0 0-.8-2.1c2.7-.3 5.6-1.3 5.6-6a4.7 4.7 0 0 0-1.3-3.3 4.4 4.4 0 0 0-.1-3.3s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.6 3.9 5.6 4.2 5.6 4.2a4.4 4.4 0 0 0-.1 3.3A4.7 4.7 0 0 0 4.2 11c0 4.6 2.9 5.7 5.6 6a2.7 2.7 0 0 0-.8 2.1V22" />
        </svg>
      )
    default:
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 12h16.8" />
          <path d="M12 3a13.5 13.5 0 0 1 0 18" />
          <path d="M12 3a13.5 13.5 0 0 0 0 18" />
        </svg>
      )
  }
}

function CopyIcon() {
  const iconProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  } as const

  return (
    <svg {...iconProps}>
      <rect height="13" rx="2" width="13" x="8" y="8" />
      <path d="M5 16V5.8C5 5.4 5.4 5 5.8 5H16" />
    </svg>
  )
}
