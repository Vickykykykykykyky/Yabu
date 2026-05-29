import { UserColumn } from '../components/UserColumn'
import type { UserProfile } from '../types'
import './HomeFeed.css'

type Props = {
  users: UserProfile[]
  currentUserId: string
  onViewPhoto?: (photos: string[], captions: (string | undefined)[], index: number) => void
  onSelectUser?: (id: string) => void
}

function chunkUsers(users: UserProfile[]): UserProfile[][] {
  const multi = users.filter((u) =>
    u.posts?.some((p) => p.photos.length >= 3),
  )
  const others = users.filter(
    (u) => !u.posts?.some((p) => p.photos.length >= 3),
  )

  const shuffled = [...others]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const rows: UserProfile[][] = []
  let mIdx = 0
  let oIdx = 0
  let lastWasSingle = false

  const nextSize = () => {
    const remaining = shuffled.length - oIdx
    const min = lastWasSingle && remaining >= 2 ? 2 : 1
    const max = Math.min(3, remaining)
    if (min > max) return max
    return min + Math.floor(Math.random() * (max - min + 1))
  }

  while (oIdx < shuffled.length || mIdx < multi.length) {
    if (oIdx < shuffled.length) {
      const size = nextSize()
      rows.push(shuffled.slice(oIdx, oIdx + size))
      oIdx += size
      lastWasSingle = size === 1
    }

    if (mIdx < multi.length && !lastWasSingle) {
      rows.push([multi[mIdx++]])
      lastWasSingle = true
    } else if (mIdx < multi.length && oIdx >= shuffled.length) {
      rows.push([multi[mIdx++]])
    }
  }

  return rows
}

export function HomeFeed({ users, currentUserId, onViewPhoto, onSelectUser }: Props) {
  const rows = chunkUsers(users)

  return (
    <div className="home-feed">
      {rows.map((rowUsers, rowIndex) => (
        <section
          key={rowIndex}
          className="home-feed__row"
          aria-label={rows.length > 1 ? `用户照片墙 第 ${rowIndex + 1} 行` : '用户照片墙'}
        >
          {rowUsers.map((user, userIndex) => (
            <UserColumn
              key={user.id}
              user={user}
              isMine={user.id === currentUserId}
              isFullWidth={rowUsers.length === 1}
              onViewPhoto={onViewPhoto}
              onSelectUser={onSelectUser}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
