const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.8,
  viewBox: '0 0 24 24',
} as const

export function FocusIcon({ icon }: { icon: string }) {
  const props = {
    ...iconProps,
    'aria-hidden': true,
    className: 'h-4 w-4',
  } as const

  switch (icon) {
    case 'message':
      return (
        <svg {...props}>
          <path d="M5 6.5h14" />
          <path d="M5 11h10" />
          <path d="M5 15.5h7" />
          <path d="M19 4a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H9l-5 3v-3H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16Z" />
        </svg>
      )
    case 'structure':
      return (
        <svg {...props}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
          <path d="M8 4v16" />
          <path d="M16 4v16" />
        </svg>
      )
    case 'responsive':
      return (
        <svg {...props}>
          <rect height="11" rx="2" width="16" x="3" y="4" />
          <path d="M8 20h6" />
          <path d="M11 15v5" />
          <rect height="7" rx="1.5" width="4" x="17" y="13" />
        </svg>
      )
    case 'iteration':
      return (
        <svg {...props}>
          <path d="M17 3v5h-5" />
          <path d="M7 21v-5h5" />
          <path d="M17 8a7 7 0 0 0-11.4 2.2" />
          <path d="M7 16a7 7 0 0 0 11.4-2.2" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      )
  }
}

export function SkillIcon({ title }: { title: string }) {
  switch (title) {
    case 'Computer Science':
      return (
        <svg {...iconProps}>
          <path d="M5 4.8h10.5a3.5 3.5 0 0 1 3.5 3.5v10.9H8.5A3.5 3.5 0 0 0 5 22z" />
          <path d="M5 4.8A3.5 3.5 0 0 0 2 8.2v11A3.5 3.5 0 0 1 5.5 17H19" />
          <path d="M8.5 9h6" />
          <path d="M8.5 12h4.5" />
        </svg>
      )
    case 'AI & Machine Learning':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="m4.2 7.5 2.6 1.5" />
          <path d="m17.2 15 2.6 1.5" />
          <path d="m19.8 7.5-2.6 1.5" />
          <path d="m6.8 15-2.6 1.5" />
        </svg>
      )
    case 'Web Development':
      return (
        <svg {...iconProps}>
          <path d="m8.5 8-4 4 4 4" />
          <path d="m15.5 8 4 4-4 4" />
          <path d="m13 6-2 12" />
        </svg>
      )
    case 'Tools & Workflow':
      return (
        <svg {...iconProps}>
          <circle cx="6" cy="7" r="2.2" />
          <circle cx="18" cy="7" r="2.2" />
          <circle cx="12" cy="17" r="2.2" />
          <path d="M8.2 8.7 10.8 15" />
          <path d="M15.8 8.7 13.2 15" />
          <path d="M8.4 7h7.2" />
        </svg>
      )
    case 'Learning':
      return (
        <svg {...iconProps}>
          <path d="M7 5.5h7.2a3.8 3.8 0 0 1 3.8 3.8v8.2H9.8A2.8 2.8 0 0 0 7 20.3z" />
          <path d="M7 5.5a2.8 2.8 0 0 0-2 2.7v8.7a2.8 2.8 0 0 1 2-1h2.8" />
          <path d="M10.5 10h4.4" />
          <path d="M10.5 13h3.2" />
        </svg>
      )
    default:
      return (
        <svg {...iconProps}>
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      )
  }
}

export function ContactIcon({ title }: { title: string }) {
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

export function CopyIcon() {
  return (
    <svg {...iconProps}>
      <rect height="13" rx="2" width="13" x="8" y="8" />
      <path d="M5 16V5.8C5 5.4 5.4 5 5.8 5H16" />
    </svg>
  )
}
