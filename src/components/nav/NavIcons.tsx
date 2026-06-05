type IconProps = { className?: string }

/** 取景框相机：左上浅蓝流光 + 双重光斑 + 四角定格线 */
export function IconLogo({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden>
      <defs>
        <radialGradient id="bg-blue-leak" cx="85%" cy="15%" r="90%">
          <stop offset="0%" stopColor="#D0E8FF" stopOpacity="0.65" />
          <stop offset="40%" stopColor="#E6F2FF" stopOpacity="0.45" />
          <stop offset="75%" stopColor="#F2F8FF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill="#FFFFFF" />
      <rect width="200" height="200" fill="url(#bg-blue-leak)" />
      <circle cx="88" cy="100" r="38" fill="#A8E6CF" opacity="0.35" />
      <circle cx="112" cy="100" r="38" fill="#FFD3B6" opacity="0.38" />
      <g
        stroke="#718096"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.55"
      >
        <path d="M 65,76 L 65,68 Q 65,65 68,65 L 76,65" />
        <path d="M 135,76 L 135,68 Q 135,65 132,65 L 124,65" />
        <path d="M 65,124 L 65,132 Q 65,135 68,135 L 76,135" />
        <path d="M 135,124 L 135,132 Q 135,135 132,135 L 124,135" />
      </g>
      <circle cx="100" cy="100" r="1.5" fill="#718096" opacity="0.4" />
    </svg>
  )
}

export function IconHome({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconReels({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" />
    </svg>
  )
}

export function IconMessages({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 11.5l9.5-7 9.5 7V19a1 1 0 0 1-1 1h-4.5l-3.5 3-3.5-3H4a1 1 0 0 1-1-1v-7.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconExplore({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 6.5l1.8 5.2 5.2 1.8-5.2 1.8L12 20.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 6.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconHeart({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20.5s-7-4.35-7-9.5a4 4 0 0 1 7-2.5 4 4 0 0 1 7 2.5c0 5.15-7 9.5-7 9.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconLogout({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconCreate({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
