import type { UserProfile } from '../types'
import './MediaViews.css'

type Props = { users: UserProfile[] }

export function ReelsView({ users }: Props) {
  const items = users.flatMap((u) =>
    u.photoUrls.map((url, i) => ({
      url,
      user: u,
      key: `${u.id}-${i}`,
    })),
  )

  if (items.length === 0) {
    return (
      <div className="media-view media-view--empty">
        <p>还没有短视频内容</p>
        <span>点击侧栏「创建」上传照片</span>
      </div>
    )
  }

  return (
    <div className="reels-view">
      {items.map(({ url, user, key }) => (
        <article key={key} className="reels-view__card">
          <img src={url} alt="" />
          <footer className="reels-view__footer">
            <span>{user.displayName}</span>
            <span>{user.id}</span>
          </footer>
        </article>
      ))}
    </div>
  )
}
