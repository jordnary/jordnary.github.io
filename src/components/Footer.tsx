import { SmartLink } from './SmartLink'

const footerNavItems = [
  { href: '#about', label: '关于' },
  { href: '#skills', label: '技能' },
  { href: '#projects', label: '项目' },
  { href: '#timeline', label: '路径' },
  { href: '#contact', label: '联系' },
] as const

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer-shell">
      <div className="site-container footer-content">
        <div className="footer-brand">
          <SmartLink className="footer-brand-link" href="#home">
            Jordnary
          </SmartLink>
          <p className="footer-description">
            记录计算机基础、AI 学习、Web 实践与个人成长。
          </p>
        </div>

        <nav aria-label="Footer navigation" className="footer-nav">
          {footerNavItems.map((item) => (
            <SmartLink className="footer-link" href={item.href} key={item.href}>
              {item.label}
            </SmartLink>
          ))}
        </nav>

        <div className="footer-meta">
          <SmartLink
            aria-label="Visit Jordnary on GitHub"
            className="footer-github-link"
            href="https://github.com/jordnary"
          >
            <GitHubIcon />
            <span>GitHub</span>
          </SmartLink>
          <p className="footer-copyright">
            © {currentYear} Jordnary. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M8.8 19.5c-3.2 1-3.2-1.6-4.5-2" />
      <path d="M15.2 22v-3.1a2.7 2.7 0 0 0-.8-2.1c2.7-.3 5.6-1.3 5.6-6a4.7 4.7 0 0 0-1.3-3.3 4.4 4.4 0 0 0-.1-3.3s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.6 3.9 5.6 4.2 5.6 4.2a4.4 4.4 0 0 0-.1 3.3A4.7 4.7 0 0 0 4.2 11c0 4.6 2.9 5.7 5.6 6a2.7 2.7 0 0 0-.8 2.1V22" />
    </svg>
  )
}
