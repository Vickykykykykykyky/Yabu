import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, UserProfile } from '../types'
import {
  fetchChatRooms,
  fetchMessages,
  findOrCreateChatRoom,
  insertMessage,
  markMessagesRead,
} from '../lib/supabase-profiles'
import { getSupabase, isSupabaseEnabled } from '../lib/supabase'
import { uploadPhotoToSupabase } from '../lib/supabase-storage'
import { uploadUserPhoto, isR2Enabled } from '../lib/r2-api'
import { pickImageFile } from '../utils/file'
import { compressImageToBlob } from '../utils/image'
import './MessagesView.css'

type RoomInfo = {
  id: string
  peerId: string
  lastMessageAt: number
  unreadCount: number
  lastMessageContent?: string
}

type Props = {
  users: UserProfile[]
  currentUserId: string
}

function formatChatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (isToday) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return '昨天'
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function getInitials(name: string): string {
  return name.slice(0, 2)
}

export function MessagesView({ users, currentUserId }: Props) {
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)

  const listBottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const roomsLoadedRef = useRef(false)
  const activeRoomIdRef = useRef(activeRoomId)

  const peerMap = new Map(users.map((u) => [u.id, u]))
  const activePeer = selectedPeerId
    ? peerMap.get(selectedPeerId) ?? null
    : null

  const scrollToBottom = useCallback(() => {
    const el = listBottomRef.current
    if (el) {
      el.scrollIntoView({ behavior: 'auto' })
    }
  }, [])

  // Keep ref in sync
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId
  }, [activeRoomId])

  // Load rooms
  useEffect(() => {
    if (!isSupabaseEnabled() || roomsLoadedRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchChatRooms(currentUserId)
        if (cancelled) return
        setRooms(data)
      } catch {
        // Rooms may not exist yet
      } finally {
        if (!cancelled) {
          setLoadingRooms(false)
          roomsLoadedRef.current = true
        }
      }
    })()
    return () => { cancelled = true }
  }, [currentUserId])

  // Realtime: listen for new messages
  useEffect(() => {
    if (!isSupabaseEnabled()) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`chat-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Record<string, unknown>
          const newMsg: ChatMessage = {
            id: msg.id as string,
            roomId: msg.room_id as string,
            senderId: msg.sender_id as string,
            content: (msg.content as string) ?? '',
            imageUrl: (msg.image_url as string) || undefined,
            isRead: (msg.is_read as boolean) ?? false,
            createdAt: new Date(msg.created_at as string).getTime(),
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

          setRooms((prev) => {
            const currentRoomId = activeRoomIdRef.current
            return prev.map((r) => {
              if (r.id !== newMsg.roomId) return r
              const unread =
                newMsg.senderId !== currentUserId && r.id !== currentRoomId
                  ? r.unreadCount + 1
                  : r.unreadCount
              return {
                ...r,
                lastMessageAt: newMsg.createdAt,
                lastMessageContent: newMsg.imageUrl ? '[图片]' : newMsg.content,
                unreadCount: unread,
              }
            })
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  // Load messages when active room changes
  useEffect(() => {
    if (!activeRoomId || !isSupabaseEnabled()) return
    let cancelled = false
    ;(async () => {
      setLoadingMessages(true)
      try {
        const rows = await fetchMessages(activeRoomId)
        if (cancelled) return
        setMessages(
          rows.map((r) => ({
            id: r.id,
            roomId: r.room_id,
            senderId: r.sender_id,
            content: r.content ?? '',
            imageUrl: r.image_url ?? undefined,
            isRead: r.is_read,
            createdAt: new Date(r.created_at).getTime(),
          })),
        )
        markMessagesRead(activeRoomId, currentUserId).catch(() => {})
        setRooms((prev) =>
          prev.map((r) =>
            r.id === activeRoomId ? { ...r, unreadCount: 0 } : r,
          ),
        )
      } catch {
        // Room or messages may not exist
      } finally {
        if (!cancelled) setLoadingMessages(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeRoomId, currentUserId])

  // Scroll to bottom on message changes
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [draft])

  const handleSelectRoom = useCallback(
    async (peerId: string) => {
      setSelectedPeerId(peerId)
      if (!isSupabaseEnabled()) return
      try {
        const roomId = await findOrCreateChatRoom(currentUserId, peerId)
        setActiveRoomId(roomId)
        setMessages([])
        setRooms((prev) => {
          const exists = prev.find((r) => r.peerId === peerId)
          if (exists) return prev
          return [
            {
              id: roomId,
              peerId,
              lastMessageAt: Date.now(),
              unreadCount: 0,
            },
            ...prev,
          ]
        })
      } catch (err) {
        console.error('Failed to find/create room:', err)
      }
    },
    [currentUserId],
  )

  const sendTextMessage = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || !activeRoomId || sending) return

    if (!isSupabaseEnabled()) {
      const localMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        roomId: activeRoomId,
        senderId: currentUserId,
        content: trimmed,
        isRead: false,
        createdAt: Date.now(),
      }
      setMessages((prev) => [...prev, localMsg])
      setDraft('')
      return
    }

    setSending(true)
    try {
      await insertMessage(activeRoomId, currentUserId, trimmed)
      setDraft('')
      roomsLoadedRef.current = true
      const data = await fetchChatRooms(currentUserId)
      setRooms(data)
    } catch (err) {
      console.error('Send message failed:', err)
    } finally {
      setSending(false)
    }
  }, [draft, activeRoomId, sending, currentUserId])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendTextMessage()
      }
    },
    [sendTextMessage],
  )

  const handleImageUpload = useCallback(async () => {
    if (!activeRoomId || uploading) return
    const file = await pickImageFile()
    if (!file) return

    setUploading(true)
    try {
      let url = ''
      if (isSupabaseEnabled()) {
        const blob = await compressImageToBlob(file)
        if (isR2Enabled()) {
          const meta = await uploadUserPhoto(currentUserId, blob)
          url = meta.url
        } else {
          url = await uploadPhotoToSupabase(currentUserId, blob)
        }
      } else {
        const dataUrl = await compressImageToBlob(file)
        url = URL.createObjectURL(dataUrl)
      }

      if (isSupabaseEnabled() && url) {
        await insertMessage(activeRoomId, currentUserId, '[图片]', url)
      } else if (url) {
        const localMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId: activeRoomId,
          senderId: currentUserId,
          content: '[图片]',
          imageUrl: url,
          isRead: false,
          createdAt: Date.now(),
        }
        setMessages((prev) => [...prev, localMsg])
      }
    } catch (err) {
      console.error('Image upload failed:', err)
    } finally {
      setUploading(false)
    }
  }, [activeRoomId, uploading, currentUserId])

  return (
    <div className="messages-view">
      <aside className={`messages-view__sidebar ${!showSidebar ? 'messages-view__sidebar--hidden' : ''}`}>
        {loadingRooms && isSupabaseEnabled() ? (
          <p className="messages-view__sidebar-empty">加载中…</p>
        ) : rooms.length === 0 && users.length <= 1 ? (
          <p className="messages-view__sidebar-empty">
            暂无其他用户，无法开始对话
          </p>
        ) : (
          <div className="messages-view__room-list">
            {rooms.map((room) => {
              const peer = peerMap.get(room.peerId)
              return (
                <button
                  key={room.id}
                  className={`messages-view__room ${
                    activeRoomId === room.id ? 'messages-view__room--active' : ''
                  }`}
                  onClick={() => handleSelectRoom(room.peerId)}
                >
                  <div className="messages-view__room-avatar">
                    {peer?.avatarUrl ? (
                      <img src={peer.avatarUrl} alt="" />
                    ) : (
                      <span>{peer ? getInitials(peer.displayName) : '?'}</span>
                    )}
                  </div>
                  <div className="messages-view__room-body">
                    <div className="messages-view__room-top">
                      <span className="messages-view__room-name">
                        {peer?.displayName ?? room.peerId}
                      </span>
                      <span className="messages-view__room-time">
                        {formatChatTime(room.lastMessageAt)}
                      </span>
                    </div>
                    <div className="messages-view__room-bottom">
                      <span className="messages-view__room-last">
                        {room.lastMessageContent || '开始聊天吧'}
                      </span>
                      {room.unreadCount > 0 && (
                        <span className="messages-view__room-badge">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Other users not yet in a room */}
            {users
              .filter(
                (u) =>
                  u.id !== currentUserId &&
                  !rooms.some((r) => r.peerId === u.id),
              )
              .map((u) => (
                <button
                  key={u.id}
                  className="messages-view__room"
                  onClick={() => handleSelectRoom(u.id)}
                >
                  <div className="messages-view__room-avatar">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" />
                    ) : (
                      <span>{getInitials(u.displayName)}</span>
                    )}
                  </div>
                  <div className="messages-view__room-body">
                    <div className="messages-view__room-top">
                      <span className="messages-view__room-name">
                        {u.displayName}
                      </span>
                      <span className="messages-view__room-time" />
                    </div>
                    <span className="messages-view__room-last">
                      开始新对话
                    </span>
                  </div>
                </button>
              ))}
          </div>
        )}
      </aside>

      <div className={`messages-view__chat ${!showSidebar ? 'messages-view__chat--visible' : ''}`}>
        {!activePeer ? (
          <div className="messages-view__chat-empty">
            <p>选择一个对话开始聊天</p>
          </div>
        ) : (
          <>
            <header className="messages-view__chat-header">
              <button
                className="messages-view__chat-back"
                onClick={() => { setShowSidebar(true); setActiveRoomId(null) }}
                aria-label="返回对话列表"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15,18 9,12 15,6" />
                </svg>
              </button>
              <div className="messages-view__chat-header-avatar">
                {activePeer.avatarUrl ? (
                  <img src={activePeer.avatarUrl} alt="" />
                ) : (
                  <span>{getInitials(activePeer.displayName)}</span>
                )}
              </div>
              <span className="messages-view__chat-header-name">
                {activePeer.displayName}
              </span>
            </header>

            <div className="messages-view__chat-list">
              {loadingMessages ? (
                <div className="messages-view__chat-loading">加载中…</div>
              ) : messages.length === 0 ? (
                <div className="messages-view__chat-empty-list">
                  <p>暂无消息，发送第一条吧</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderId === currentUserId
                  return (
                    <div
                      key={m.id}
                      className={`messages-view__bubble-row ${
                        isMe ? 'messages-view__bubble-row--me' : ''
                      }`}
                    >
                      <div
                        className={`messages-view__bubble ${
                          isMe ? 'messages-view__bubble--me' : ''
                        }`}
                      >
                        {m.imageUrl && (
                          <img
                            className="messages-view__bubble-image"
                            src={m.imageUrl}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        {m.content &&
                          !(m.imageUrl && m.content === '[图片]') && (
                            <p className="messages-view__bubble-text">
                              {m.content}
                            </p>
                          )}
                      </div>
                      <time className="messages-view__bubble-time">
                        {formatChatTime(m.createdAt)}
                      </time>
                    </div>
                  )
                })
              )}
              <div ref={listBottomRef} />
            </div>

            <div className="messages-view__input-area">
              <button
                className="messages-view__input-img-btn"
                title="发送图片"
                onClick={handleImageUpload}
                disabled={uploading}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21,15 16,10 5,21" />
                </svg>
              </button>
              <textarea
                ref={textareaRef}
                className="messages-view__input"
                placeholder="输入消息…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sending}
              />
              <button
                className="messages-view__send-btn"
                onClick={sendTextMessage}
                disabled={!draft.trim() || sending}
              >
                {sending ? '…' : '发送'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
