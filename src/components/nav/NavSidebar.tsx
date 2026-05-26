import { useEffect, useRef, useState } from 'react'
import type { NavView, UserProfile } from '../../types'
import {
  IconCreate,
  IconExplore,
  IconHeart,
  IconHome,
  IconLogo,
  IconMessages,
  IconReels,
  IconSearch,
} from './NavIcons'
import './NavSidebar.css'

type Props = {
  activeView: NavView
  onNavigate: (view: NavView) => void
  onCreate: () => void
  activeUser: UserProfile
  unreadCount: number
  onMarkNotificationsRead: () => void
}

const NAV_ITEMS: { id: NavView; label: string; Icon: typeof IconHome }[] = [
  { id: 'home', label: '首页', Icon: IconHome },
  { id: 'reels', label: '短视频', Icon: IconReels },
  { id: 'messages', label: '消息', Icon: IconMessages },
  { id: 'search', label: '搜索', Icon: IconSearch },
  { id: 'explore', label: '发现', Icon: IconExplore },
  { id: 'notifications', label: '通知', Icon: IconHeart },
]

function getInitials(name: string) {
  return name.slice(0, 2) || '?'
}

export function NavSidebar({
  activeView,
  onNavigate,
  onCreate,
  activeUser,
  unreadCount,
  onMarkNotificationsRead,
}: Props) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const railRef = useRef<HTMLElement>(null)
  const expanded = hovered || pinned

  useEffect(() => {
    if (!pinned) return
    const close = (e: PointerEvent) => {
      if (!railRef.current?.contains(e.target as Node)) setPinned(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [pinned])

  return (
    <aside
      ref={railRef}
      className={`nav-sidebar ${expanded ? 'nav-sidebar--expanded' : ''} ${pinned ? 'nav-sidebar--pinned' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="主导航"
    >
      <button
        type="button"
        className="nav-sidebar__logo"
        onClick={() => onNavigate('home')}
        aria-label="Yabu 首页"
      >
        <IconLogo className="nav-sidebar__icon" />
        <span className="nav-sidebar__label">Yabu</span>
      </button>

      <nav className="nav-sidebar__nav">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-sidebar__item ${activeView === id ? 'nav-sidebar__item--active' : ''}`}
            onClick={() => {
              onNavigate(id)
              if (id === 'notifications') onMarkNotificationsRead()
            }}
            aria-current={activeView === id ? 'page' : undefined}
            title={!expanded ? label : undefined}
          >
            <span className="nav-sidebar__icon-wrap">
              <Icon className="nav-sidebar__icon" />
              {id === 'notifications' && unreadCount > 0 && (
                <span className="nav-sidebar__badge" aria-label={`${unreadCount} 条未读`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span className="nav-sidebar__label">{label}</span>
          </button>
        ))}

        <button
          type="button"
          className="nav-sidebar__item"
          onClick={onCreate}
          aria-label="创建"
          title={!expanded ? '创建' : undefined}
        >
          <span className="nav-sidebar__icon-wrap">
            <IconCreate className="nav-sidebar__icon" />
          </span>
          <span className="nav-sidebar__label">创建</span>
        </button>
      </nav>

      <button
        type="button"
        className={`nav-sidebar__item nav-sidebar__item--profile ${activeView === 'profile' ? 'nav-sidebar__item--active' : ''}`}
        onClick={() => onNavigate('profile')}
        aria-current={activeView === 'profile' ? 'page' : undefined}
        title={!expanded ? '个人主页' : undefined}
      >
        <span className="nav-sidebar__avatar">
          {activeUser.avatarUrl ? (
            <img src={activeUser.avatarUrl} alt="" />
          ) : (
            <span>{getInitials(activeUser.displayName)}</span>
          )}
        </span>
        <span className="nav-sidebar__label">个人主页</span>
      </button>
    </aside>
  )
}
