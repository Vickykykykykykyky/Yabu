import { useState } from 'react'
import type { UserProfile } from '../types'
import './MediaViews.css'

type Props = {
  users: UserProfile[]
  onSelectUser: (id: string) => void
}

export function SearchView({ users, onSelectUser }: Props) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matchedUsers = users.filter(
    (u) =>
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q),
  )

  const matchedPhotos = users.flatMap((u) =>
    u.photoUrls
      .map((url, i) => ({ url, user: u, key: `${u.id}-${i}` }))
      .filter(() => !q || u.displayName.toLowerCase().includes(q)),
  )

  return (
    <div className="search-view">
      <input
        type="search"
        className="search-view__input"
        placeholder="搜索用户、ID…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <section>
        <h2 className="search-view__heading">用户</h2>
        <ul className="search-view__users">
          {matchedUsers.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => onSelectUser(u.id)}>
                <strong>{u.displayName}</strong>
                <span>{u.id}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="search-view__heading">照片</h2>
        <div className="explore-view">
          {matchedPhotos.map(({ url, user, key }) => (
            <button
              key={key}
              type="button"
              className="explore-view__tile"
              onClick={() => onSelectUser(user.id)}
            >
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
        {matchedPhotos.length === 0 && q && (
          <p className="search-view__none">未找到相关照片</p>
        )}
      </section>
    </div>
  )
}
