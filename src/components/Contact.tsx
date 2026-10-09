import { useCallback, useState } from 'react'
import { Toast } from './Toast'
import { ContactAirmail } from './ContactAirmail'
import { ContactIcon, CopyIcon } from './icons'
import { contactLinks, contactProfile } from '../data/contact'
import './Contact.css'

const otherContactLinks = contactLinks.filter((link) => !link.href.startsWith('mailto:'))

export function Contact() {
  const [copyToastId, setCopyToastId] = useState(0)
  const [copySucceeded, setCopySucceeded] = useState(false)

  const handleToastClose = useCallback(() => {
    setCopyToastId(0)
  }, [])

  async function handleCopyEmail() {
    setCopySucceeded(await copyToClipboard(contactProfile.email))
    setCopyToastId((currentId) => currentId + 1)
  }

  return (
    <section className="correspondence site-container" id="contact" aria-labelledby="contact-title">
      <div className="correspondence-masthead">
        <p><span aria-hidden="true" /> CONTACT / KEEP IN TOUCH</p>
        <span className="correspondence-edition" aria-hidden="true">A SPACE FOR CONNECTION</span>
      </div>

      <div className="correspondence-hero">
        <header className="correspondence-intro">
          <p className="correspondence-preface">
            <span className="correspondence-note-star" aria-hidden="true">✳</span>
            <span>好的交流，往往始于一句你好。</span>
            <span className="correspondence-note-rule" aria-hidden="true" />
          </p>
          <h1 id="contact-title">
            <span>让想法，</span>
            <span>在此<em>相遇<svg viewBox="0 0 180 18" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M3 12Q72 2 176 7M105 16l62-3" /></svg></em>。</span>
          </h1>
          <div className="correspondence-note">
            <span className="correspondence-note-label" aria-hidden="true">P.S.</span>
            <p className="correspondence-description">{contactProfile.description}</p>
            <p className="correspondence-availability">
              <span aria-hidden="true" />{contactProfile.availability}
            </p>
          </div>
        </header>

        <ContactAirmail />

        <div className="correspondence-art" aria-hidden="true">
          <svg className="correspondence-orbits" viewBox="0 0 520 430" fill="none" focusable="false">
            <ellipse cx="260" cy="220" rx="231" ry="145" transform="rotate(-32 260 220)" />
            <ellipse cx="260" cy="220" rx="201" ry="174" transform="rotate(-32 260 220)" />
            <path className="correspondence-flight" d="M22 352C105 393 78 256 39 286S117 427 254 359 343 256 490 309" />
            <path className="correspondence-cross" d="M80 96v20m-10-10h20M446 196v16m-8-8h16" />
            <circle cx="389" cy="61" r="4" /><circle cx="140" cy="382" r="3" />
          </svg>
          <div className="correspondence-envelope"><span /></div>
          <div className="correspondence-postcard">
            <div className="correspondence-postcard-top">
              <span>A NOTE TO YOU</span>
              <div className="correspondence-stamp">
                <svg viewBox="0 0 48 48" fill="none" focusable="false"><path d="M24 6c0 12-6 18-18 18 12 0 18 6 18 18 0-12 6-18 18-18-12 0-18-6-18-18Z" /><circle cx="24" cy="24" r="19" /></svg>
              </div>
            </div>
            <p className="correspondence-hello"><span>Say</span><em>hello.</em></p>
            <div className="correspondence-postcard-bottom"><span>让好奇心有回音。</span><span>↗</span></div>
            <svg className="correspondence-postmark" viewBox="0 0 114 48" fill="none" focusable="false"><path d="M2 9q14-12 28 0t28 0 28 0 28 0M2 23q14-12 28 0t28 0 28 0 28 0M2 37q14-12 28 0t28 0 28 0 28 0" /></svg>
          </div>
          <div className="correspondence-seal"><span>LET’S</span><strong>talk</strong><span>✳</span></div>
          <span className="correspondence-art-caption">Some things begin with a hello.</span>
        </div>
      </div>

      <div className="correspondence-email">
        <div className="correspondence-email-heading"><span>01 / EMAIL</span><p>把你的想法，寄到这里。</p></div>
        <a className="correspondence-address" href={`mailto:${contactProfile.email}`} aria-label={`发送邮件至 ${contactProfile.email}`}>
          <span>{contactProfile.email}</span><span className="correspondence-email-arrow" aria-hidden="true">↗</span>
        </a>
        <button
          aria-label={`复制邮箱 ${contactProfile.email}`}
          className="contact-copy-button"
          onClick={handleCopyEmail}
          type="button"
        >
          <CopyIcon /><span>{copyToastId > 0 && copySucceeded ? '已复制' : '复制邮箱'}</span>
        </button>
      </div>

      <div className="correspondence-elsewhere">
        <div className="correspondence-elsewhere-heading"><span>ELSEWHERE</span><p>也可以，在这些地方遇见。</p></div>
        <nav className="correspondence-links" aria-label="更多联系入口">
          {otherContactLinks.map((link, index) => (
            <a
              className="correspondence-link"
              href={link.href}
              key={link.title}
              aria-label={`${link.title}：${link.label}${link.href.startsWith('http') ? '（新窗口打开）' : ''}`}
              rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              target={link.href.startsWith('http') ? '_blank' : undefined}
            >
              <span className="correspondence-link-number" aria-hidden="true">{String(index + 2).padStart(2, '0')}</span>
              <span className="correspondence-link-content"><span className="correspondence-link-title"><ContactIcon title={link.title} />{link.title}</span><span className="correspondence-link-description">{link.description}</span></span>
              <span className="correspondence-link-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
      </div>
      <div className="correspondence-colophon"><span>学习 · 创作 · 交换灵感</span><span>Looking forward to our next conversation.</span></div>
      <Toast
        message={copySucceeded ? '已复制邮箱' : '复制失败，请手动选择邮箱复制'}
        onClose={handleToastClose}
        open={copyToastId > 0}
        resetKey={copyToastId}
      />
    </section>
  )
}

async function copyToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Fall through to the textarea fallback.
  }

  const previousFocus = document.activeElement
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.setAttribute('aria-hidden', 'true')
  textarea.tabIndex = -1
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus({ preventScroll: true })
    }
  }
}
