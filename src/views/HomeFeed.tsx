import { UserColumn } from '../components/UserColumn'
import type { UserProfile } from '../types'
import './HomeFeed.css'

const USERS_PER_ROW = 3

type Props = {
  users: UserProfile[]
  currentUserId: string
}

function chunkUsers(users: UserProfile[]): UserProfile[][] {
  const rows: UserProfile[][] = []
  for (let i = 0; i < users.length; i += USERS_PER_ROW) {
    const row = users.slice(i, i + USERS_PER_ROW)
    if (row.length > 0) rows.push(row)
  }
  return rows
}

export function HomeFeed({ users, currentUserId }: Props) {
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
            />
          ))}
        </section>
      ))}
    </div>
  )
}
