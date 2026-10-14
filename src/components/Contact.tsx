import { useCallback, useState } from 'react'
import { Toast } from './Toast'
import { SectionBackdrop } from './SectionBackdrop'
import { ContactAirmail } from './ContactAirmail'
import { CopyIcon } from './icons'
import { ArtisticLabel } from './ArtisticLabel'
import { SmartLink } from './SmartLink'
import { contactLinks, contactProfile } from '../data/contact'
import './Contact.css'

const otherContactLinks = contactLinks.filter((link) => !link.href.startsWith('mailto:'))
const airmailStamp = `${import.meta.env.BASE_URL}images/contact/airmail-insignia.webp`

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
    <section className="correspondence site-container section-surface" id="contact" aria-labelledby="contact-title">
      <SectionBackdrop tone="lilac" edge="none" />
      <div className="correspondence-masthead">
        <p><span aria-hidden="true" /> CONTACT / KEEP IN TOUCH</p>
        <span className="correspondence-edition" aria-hidden="true">A SPACE FOR CONNECTION</span>
      </div>

      <div className="correspondence-hero section-surface">
        <header className="correspondence-intro">
          <p className="correspondence-preface">
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
          <div className="correspondence-seal"><span>LET’S</span><strong>talk</strong></div>
          <span className="correspondence-art-caption">Some things begin with a hello.</span>
        </div>
      </div>

      <div className="correspondence-bottom section-surface">
        <SectionBackdrop decoration="halftone-right" />
        <div className="correspondence-connect">
          <div className="correspondence-connect-heading">
            <span>CORRESPONDENCE / 联系</span><span aria-hidden="true">A PLACE FOR YOUR IDEAS</span>
          </div>
          <div className="correspondence-email">
            <div className="correspondence-email-top">
              <div className="correspondence-email-heading">
                <span className="correspondence-to" aria-hidden="true">To.</span>
                <div><span>收件地址 / EMAIL</span><p>把你的想法，寄到这里。</p></div>
              </div>
              <div className="correspondence-mail-postage" aria-hidden="true">
                <svg className="correspondence-mail-postmark" viewBox="0 0 136 70" fill="none" focusable="false">
                  <circle cx="35" cy="35" r="29" /><circle cx="35" cy="35" r="23" />
                  <path d="M55 22q12-6 24 0t24 0 24 0M55 35q12-6 24 0t24 0 24 0M55 48q12-6 24 0t24 0 24 0" />
                </svg>
                <img className="correspondence-mail-mark" src={airmailStamp} alt="" width="240" height="204" decoding="async" />
              </div>
            </div>
            <a className="correspondence-address" href={`mailto:${contactProfile.email}`} aria-label={`发送邮件至 ${contactProfile.email}`}>
              {contactProfile.email}
            </a>
            <div className="correspondence-email-actions">
              <a className="correspondence-send-button" href={`mailto:${contactProfile.email}`}>
                <span>写封邮件</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="m4 11 16-7-7 16-2-7-7-2Zm7 2 9-9" /></svg>
              </a>
              <button
                aria-label={`复制邮箱 ${contactProfile.email}`}
                className="contact-copy-button"
                data-copied={copyToastId > 0 && copySucceeded}
                onClick={handleCopyEmail}
                type="button"
              >
                {copyToastId > 0 && copySucceeded ? <span className="correspondence-copy-check" aria-hidden="true">✓</span> : <CopyIcon />}
                <span>{copyToastId > 0 && copySucceeded ? '已复制' : '复制邮箱'}</span>
              </button>
              <span className="correspondence-email-signoff" aria-hidden="true">a little hello, a new beginning.</span>
            </div>
          </div>

          <div className="correspondence-elsewhere">
            <nav className="correspondence-links" aria-label="更多联系入口">
              {otherContactLinks.map((link, index) => (
                <SmartLink
                  className="correspondence-link"
                  href={link.href}
                  key={link.title}
                  data-external={link.href.startsWith('http')}
                  aria-label={`${link.title}：${link.label}${link.href.startsWith('http') ? '（新窗口打开）' : ''}`}
                >
                  <span className="correspondence-link-kicker"><span>{String(index + 1).padStart(2, '0')}</span> / {link.href.startsWith('http') ? 'OPEN SOURCE' : 'BACK TO THE START'}</span>
                  <span className="correspondence-link-body">
                    <span className="correspondence-link-content"><span className="correspondence-link-title"><ArtisticLabel>{link.title}</ArtisticLabel></span><span className="correspondence-link-description">{link.description}</span></span>
                    <span className="correspondence-link-arrow" aria-hidden="true">{link.href.startsWith('http') ? '↗' : '→'}</span>
                  </span>
                </SmartLink>
              ))}
            </nav>
          </div>
        </div>
        <div className="correspondence-colophon"><span>学习 · 创作 · 交换灵感</span><span>Looking forward to our next conversation.</span></div>
      </div>
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
