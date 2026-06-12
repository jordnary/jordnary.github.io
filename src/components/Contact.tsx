import { useCallback, useState } from 'react'
import { PageSection } from './PageSection'
import { Reveal } from './Reveal'
import { Toast } from './Toast'
import { ContactIcon, CopyIcon } from './icons'
import { contactLinks, contactProfile } from '../data/contact'

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
      title="保持简单直接的交流入口"
      description="如果你想聊学习、项目实践或个人网站搭建，可以从这里找到我。"
    >
      <Reveal className="contact-panel">
        <article className="contact-panel-copy">
          <div className="contact-status">
            <span className="contact-status-dot" aria-hidden="true" />
            <span className="contact-status-text">
              {contactProfile.availability}
            </span>
          </div>
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
      </Reveal>
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
