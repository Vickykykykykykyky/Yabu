export type UserRole = 'member' | 'admin'

export type UserProfile = {
  id: string
  displayName: string
  avatarUrl: string
  photoUrls: string[]
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
