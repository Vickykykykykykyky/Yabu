type IconProps = { className?: string }

/** 与 favicon 一致：深色底 + 三色亮圆点 */
export function IconLogo({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#2a2a3d" />
      <circle cx="8.5" cy="10" r="3.2" fill="#FF4D6D" />
      <circle cx="15.5" cy="10" r="3.2" fill="#FFBE0B" />
      <circle cx="12" cy="15.8" r="3.2" fill="#06D6A0" />
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
