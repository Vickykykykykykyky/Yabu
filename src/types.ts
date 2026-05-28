export type UserRole = 'member' | 'admin'

export type UserPhoto = {
  id: string
  url: string
  caption?: string
  originalUrl?: string
  thumbnailUrl?: string
  width?: number
  height?: number
  postId?: string
}

export type Post = {
  id: string
  profileId: string
  title?: string
  photos: UserPhoto[]
  createdAt: number
}

export type UserProfile = {
  id: string
  displayName: string
  avatarUrl: string
  /** @deprecated 请用 photos；保留便于本地缓存兼容 */
  photoUrls: string[]
  photos: UserPhoto[]
  posts: Post[]
  followerCount?: number
  role?: UserRole
}

export type NavView =
  | 'home'
  | 'reels'
  | 'messages'
  | 'search'
  | 'explore'
  | 'notifications'
  | 'profile'

export type Message = {
  id: string
  fromUserId: string
  text: string
  createdAt: number
}

export type Notification = {
  id: string
  text: string
  createdAt: number
  read: boolean
}

export type AppState = {
  users: UserProfile[]
  activeUserId: string
  messages: Message[]
  notifications: Notification[]
}
