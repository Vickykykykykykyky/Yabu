import { useState } from 'react'
import type { Message, UserProfile } from '../types'
import './MediaViews.css'

type Props = {
  users: UserProfile[]
  activeUser: UserProfile
  messages: Message[]
  onSendMessage: (text: string, fromUserId: string) => void
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MessagesView({
  users,
  activeUser,
  messages,
  onSendMessage,
}: Props) {
  const [draft, setDraft] = useState('')
  const peers = users.filter((u) => u.id !== activeUser.id)

  return (
    <div className="messages-view">
      <aside className="messages-view__peers">
        <h2>对话</h2>
        <ul>
          {peers.map((u) => (
            <li key={u.id}>
              <span className="messages-view__peer-name">{u.displayName}</span>
              <span className="messages-view__peer-id">{u.id}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="messages-view__thread">
        <ul className="messages-view__list">
          {messages.length === 0 ? (
            <li className="messages-view__empty">暂无消息，发一条试试吧</li>
          ) : (
            messages.map((m) => {
              const from = users.find((u) => u.id === m.fromUserId)
              const isMe = m.fromUserId === activeUser.id
              return (
                <li
                  key={m.id}
                  className={`messages-view__bubble ${isMe ? 'messages-view__bubble--me' : ''}`}
                >
                  <strong>{isMe ? '我' : (from?.displayName ?? m.fromUserId)}</strong>
                  <p>{m.text}</p>
                  <time>{formatTime(m.createdAt)}</time>
                </li>
              )
            })
          )}
        </ul>

        <form
          className="messages-view__form"
          onSubmit={(e) => {
            e.preventDefault()
            onSendMessage(draft, activeUser.id)
            setDraft('')
          }}
        >
          <input
            type="text"
            placeholder="输入消息…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit">发送</button>
        </form>
      </div>
    </div>
  )
}
