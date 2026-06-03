const navItems = [
  { href: '#home', label: 'Home' },
  { href: '#about', label: 'About' },
  { href: '#skills', label: 'Skills' },
  { href: '#projects', label: 'Projects' },
  { href: '#timeline', label: 'Timeline' },
  { href: '#contact', label: 'Contact' },
]

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/70 px-6 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-6xl items-center justify-between">
        <a className="text-lg font-semibold tracking-tight text-white" href="#home">
          Jordnary
        </a>
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </div>
        <a className="btn-secondary hidden md:inline-flex" href="#contact">
          Let&apos;s talk
        </a>
      </nav>
    </header>
  )
}
