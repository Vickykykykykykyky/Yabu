import { UserColumn } from '../components/UserColumn'
import type { UserProfile } from '../types'
import './HomeFeed.css'

type Props = {
  users: UserProfile[]
  currentUserId: string
  onViewPhoto?: (photos: string[], captions: (string | undefined)[], index: number) => void
  onSelectUser?: (id: string) => void
  onToggleLike?: (postId: string) => Promise<boolean | null>
  onToggleFavorite?: (postId: string) => Promise<boolean | null>
}

function chunkUsers(users: UserProfile[]): UserProfile[][] {
  const multi = users.filter((u) =>
    u.posts?.some((p) => p.photos.length >= 3),
  )
  const others = users.filter(
    (u) => !u.posts?.some((p) => p.photos.length >= 3),
  )

  const rows: UserProfile[][] = []
  let mIdx = 0
  let oIdx = 0
  let lastWasSingle = false

  const nextSize = () => {
    const remaining = others.length - oIdx
    return Math.min(3, remaining)
  }

  while (oIdx < others.length || mIdx < multi.length) {
    if (oIdx < others.length) {
      const size = nextSize()
      rows.push(others.slice(oIdx, oIdx + size))
      oIdx += size
      lastWasSingle = size === 1
    }

    if (mIdx < multi.length && !lastWasSingle) {
      rows.push([multi[mIdx++]])
      lastWasSingle = true
    } else if (mIdx < multi.length && oIdx >= others.length) {
      rows.push([multi[mIdx++]])
    }
  }

  return rows
}

export function HomeFeed({ users, currentUserId, onViewPhoto, onSelectUser, onToggleLike, onToggleFavorite }: Props) {
  const rows = chunkUsers(users)

  return (
    <div className="home-feed">
      {rows.map((rowUsers, rowIndex) => (
        <section
          key={rowIndex}
          className="home-feed__row"
          aria-label={rows.length > 1 ? `用户照片墙 第 ${rowIndex + 1} 行` : '用户照片墙'}
        >
          {rowUsers.map((user) => (
            <UserColumn
              key={user.id}
              user={user}
              isMine={user.id === currentUserId}
              isFullWidth={rowUsers.length === 1}
              onViewPhoto={onViewPhoto}
              onSelectUser={onSelectUser}
              onToggleLike={onToggleLike}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
