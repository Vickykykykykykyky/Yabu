import type { UserProfile } from '../types'
import './MediaViews.css'

type Props = {
  users: UserProfile[]
  onSelectUser: (id: string) => void
}

export function ExploreView({ users, onSelectUser }: Props) {
  const items = users.flatMap((u) =>
    u.photoUrls.map((url, i) => ({ url, user: u, key: `${u.id}-${i}` })),
  )

  if (items.length === 0) {
    return (
      <div className="media-view media-view--empty">
        <p>发现页暂无内容</p>
        <span>上传照片后会出现在这里</span>
      </div>
    )
  }

  return (
    <div className="explore-view">
      {items.map(({ url, user, key }) => (
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
  )
}
