import { getSupabase } from './supabase'
import type { Post, UserPhoto, UserProfile, UserRole } from '../types'

type ProfileRow = {
  id: string
  display_name: string
  avatar_url: string
  role: UserRole
}

type PhotoRow = {
  id: string
  profile_id: string
  url: string
  caption?: string | null
  original_url?: string | null
  thumbnail_url?: string | null
  width?: number | null
  height?: number | null
  post_id?: string | null
}

type PostRow = {
  id: string
  profile_id: string
  title?: string | null
  created_at: string
}

type NotificationRow = {
  id: string
  receiver_id: string
  sender_id: string
  type: string
  post_id?: string | null
  is_read: boolean
  created_at: string
}

function rowsToPhotos(rows: PhotoRow[]): UserPhoto[] {
  return rows.map((r) => {
    const photo: UserPhoto = { id: r.id, url: r.url }
    if (r.caption) photo.caption = r.caption
    if (r.original_url) photo.originalUrl = r.original_url
    if (r.thumbnail_url) photo.thumbnailUrl = r.thumbnail_url
    if (r.width != null) photo.width = r.width
    if (r.height != null) photo.height = r.height
    if (r.post_id) photo.postId = r.post_id
    return photo
  })
}

function rowsToPosts(postRows: PostRow[], allPhotos: UserPhoto[], profileId: string): Post[] {
  const photosByPost = new Map<string, UserPhoto[]>()
  const standalone: UserPhoto[] = []
  for (const ph of allPhotos) {
    if (ph.postId) {
      const list = photosByPost.get(ph.postId) ?? []
      list.push(ph)
      photosByPost.set(ph.postId, list)
    } else {
      standalone.push(ph)
    }
  }

  const posts: Post[] = postRows
    .map((r) => ({
      id: r.id,
      profileId: r.profile_id,
      title: r.title ?? undefined,
      photos: photosByPost.get(r.id) ?? [],
      createdAt: new Date(r.created_at).getTime(),
    }))
    .filter((p) => p.photos.length > 0)

  for (const ph of standalone) {
    posts.push({
      id: `legacy:${ph.id}`,
      profileId,
      photos: [ph],
      createdAt: 0,
    })
  }

  return posts.sort((a, b) => b.createdAt - a.createdAt)
}

function rowToProfile(p: ProfileRow, photoRows: PhotoRow[] = [], postRows: PostRow[] = []): UserProfile {
  const photos = rowsToPhotos(photoRows)
  const photoUrls = photos.map((ph) => ph.url)
  const posts = rowsToPosts(postRows, photos, p.id)
  return {
    id: p.id,
    displayName: p.display_name,
    avatarUrl: p.avatar_url ?? '',
    role: p.role,
    photos,
    photoUrls,
    posts,
    followerCount: 0,
  }
}

export async function findProfileByDisplayName(
  displayName: string,
): Promise<UserProfile | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .eq('display_name', displayName)
    .limit(1)

  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return rowToProfile(row as ProfileRow)
}

export async function fetchProfileById(id: string): Promise<UserProfile | null> {
  const supabase = getSupabase()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .eq('id', id)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile) return null

  let posts: PostRow[] = []
  try {
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .select('id, profile_id, title, created_at')
      .eq('profile_id', id)
      .order('created_at', { ascending: false })
    if (postError) throw postError
    posts = (postData ?? []) as PostRow[]
  } catch {
    posts = []
  }

  const { data: photos, error: photoError } = await supabase
    .from('photos')
    .select('id, profile_id, url, caption, original_url, thumbnail_url, width, height, post_id')
    .eq('profile_id', id)
    .order('created_at')

  if (photoError) throw photoError

  return rowToProfile(profile as ProfileRow, (photos ?? []) as PhotoRow[], posts)
}

type RegisterProfileJson = {
  id: string
  display_name: string
  avatar_url: string
  role: UserRole
}

export async function isDisplayNameTaken(displayName: string): Promise<boolean> {
  const profile = await findProfileByDisplayName(displayName)
  return profile !== null
}

/** 注册新用户：优先 RPC，回退直连 insert */
export async function registerProfileInDb(displayName: string): Promise<UserProfile> {
  const supabase = getSupabase()

  const { data: rpcData, error: rpcError } = await supabase.rpc('register_profile', {
    p_display_name: displayName,
  })

  if (!rpcError && rpcData) {
    const row = rpcData as RegisterProfileJson
    return rowToProfile({
      id: row.id,
      display_name: row.display_name,
      avatar_url: row.avatar_url ?? '',
      role: row.role ?? 'member',
    })
  }

  const rpcCode =
    rpcError && typeof rpcError === 'object' && 'code' in rpcError
      ? String((rpcError as { code?: string }).code)
      : ''

  if (rpcCode !== 'PGRST202' && rpcCode !== '42883') {
    throw rpcError
  }

  const id = `user-${crypto.randomUUID().slice(0, 8)}`
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id,
      display_name: displayName,
      avatar_url: '',
      role: 'member',
    })
    .select('id, display_name, avatar_url, role')
    .single()

  if (error) throw error
  return rowToProfile(data as ProfileRow)
}

export async function toggleLikeInDb(postId: string, profileId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('likes').delete().eq('id', existing.id)
    if (error) throw error
    await supabase.from('notifications')
      .delete()
      .eq('sender_id', profileId)
      .eq('post_id', postId)
      .eq('type', 'like')
      .eq('is_read', false)
    return false
  } else {
    const { error } = await supabase.from('likes').insert({ post_id: postId, profile_id: profileId })
    if (error) throw error
    const { data: post } = await supabase.from('posts').select('profile_id').eq('id', postId).maybeSingle()
    if (post && post.profile_id !== profileId) {
      const { data: existingNotif } = await supabase.from('notifications')
        .select('id')
        .eq('receiver_id', post.profile_id)
        .eq('sender_id', profileId)
        .eq('post_id', postId)
        .eq('type', 'like')
        .eq('is_read', false)
        .maybeSingle()
      if (existingNotif) {
        await supabase.from('notifications').update({ created_at: new Date().toISOString() }).eq('id', existingNotif.id)
      } else {
        await supabase.from('notifications').insert({
          receiver_id: post.profile_id,
          sender_id: profileId,
          type: 'like',
          post_id: postId,
        })
      }
    }
    return true
  }
}

export async function toggleFavoriteInDb(postId: string, profileId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('post_id', postId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('favorites').delete().eq('id', existing.id)
    if (error) throw error
    await supabase.from('notifications')
      .delete()
      .eq('sender_id', profileId)
      .eq('post_id', postId)
      .eq('type', 'collection')
      .eq('is_read', false)
    return false
  } else {
    const { error } = await supabase.from('favorites').insert({ post_id: postId, profile_id: profileId })
    if (error) throw error
    const { data: post } = await supabase.from('posts').select('profile_id').eq('id', postId).maybeSingle()
    if (post && post.profile_id !== profileId) {
      const { data: existingNotif } = await supabase.from('notifications')
        .select('id')
        .eq('receiver_id', post.profile_id)
        .eq('sender_id', profileId)
        .eq('post_id', postId)
        .eq('type', 'collection')
        .eq('is_read', false)
        .maybeSingle()
      if (existingNotif) {
        await supabase.from('notifications').update({ created_at: new Date().toISOString() }).eq('id', existingNotif.id)
      } else {
        await supabase.from('notifications').insert({
          receiver_id: post.profile_id,
          sender_id: profileId,
          type: 'collection',
          post_id: postId,
        })
      }
    }
    return true
  }
}

export async function fetchLikesCounts(postIds: string[]): Promise<Record<string, number>> {
  if (postIds.length === 0) return {}
  const supabase = getSupabase()
  const { data } = await supabase
    .from('likes')
    .select('post_id')
    .in('post_id', postIds)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.post_id] = (counts[row.post_id] ?? 0) + 1
  }
  return counts
}

export async function fetchLikedPostIds(profileId: string): Promise<string[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('likes')
    .select('post_id')
    .eq('profile_id', profileId)
  return (data ?? []).map((r) => r.post_id)
}

export async function fetchFavoritedPostIds(profileId: string): Promise<string[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('favorites')
    .select('post_id')
    .eq('profile_id', profileId)
  return (data ?? []).map((r) => r.post_id)
}

export async function fetchUnreadNotificationCount(profileId: string): Promise<number> {
  const supabase = getSupabase()
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', profileId)
    .eq('is_read', false)
  if (error) return 0
  return count ?? 0
}

export async function fetchNotifications(profileId: string): Promise<NotificationRow[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('notifications')
    .select('id, receiver_id, sender_id, type, post_id, is_read, created_at')
    .eq('receiver_id', profileId)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as NotificationRow[]
}


/** @deprecated 使用 registerProfileInDb */
export async function createProfileInDb(displayName: string): Promise<UserProfile> {
  return registerProfileInDb(displayName)
}

export async function fetchAllProfiles(): Promise<UserProfile[]> {
  const supabase = getSupabase()

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, role')
    .order('id')

  if (profileError) throw profileError

  let posts: PostRow[] = []
  try {
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .select('id, profile_id, title, created_at')
      .order('created_at', { ascending: false })
    if (postError) throw postError
    posts = (postData ?? []) as PostRow[]
  } catch {
    posts = []
  }

  const { data: photos, error: photoError } = await supabase
    .from('photos')
    .select('id, profile_id, url, caption, original_url, thumbnail_url, width, height, post_id')
    .order('created_at')

  if (photoError) throw photoError

  const photosByProfile = new Map<string, PhotoRow[]>()
  for (const row of (photos ?? []) as PhotoRow[]) {
    const list = photosByProfile.get(row.profile_id) ?? []
    list.push(row)
    photosByProfile.set(row.profile_id, list)
  }

  const postsByProfile = new Map<string, PostRow[]>()
  for (const row of posts) {
    const list = postsByProfile.get(row.profile_id) ?? []
    list.push(row)
    postsByProfile.set(row.profile_id, list)
  }

  return ((profiles ?? []) as ProfileRow[]).map((p) =>
    rowToProfile(p, photosByProfile.get(p.id) ?? [], postsByProfile.get(p.id) ?? []),
  )
}

export async function updateProfileInDb(
  id: string,
  patch: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl'>>,
) {
  const supabase = getSupabase()
  const row: Record<string, string> = {}
  if (patch.displayName !== undefined) row.display_name = patch.displayName
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl

  const { error } = await supabase.from('profiles').update(row).eq('id', id)
  if (error) throw error
}

export async function insertPhotoInDb(
  profileId: string,
  url: string,
  caption?: string,
  extra?: {
    originalUrl?: string
    thumbnailUrl?: string
    width?: number
    height?: number
    postId?: string
  },
): Promise<string> {
  const supabase = getSupabase()
  const record: Record<string, string | number> = { profile_id: profileId, url }
  if (caption) record.caption = caption
  if (extra?.originalUrl) record.original_url = extra.originalUrl
  if (extra?.thumbnailUrl) record.thumbnail_url = extra.thumbnailUrl
  if (extra?.width != null) record.width = extra.width
  if (extra?.height != null) record.height = extra.height
  if (extra?.postId) record.post_id = extra.postId
  const { data, error } = await supabase
    .from('photos')
    .insert(record)
    .select('id')
    .single()

  if (error) throw error
  return (data as { id: string }).id
}

export async function updatePhotoCaptionInDb(
  photoId: string,
  caption: string,
): Promise<void> {
  if (!UUID_RE.test(photoId)) return

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('photos')
    .update({ caption })
    .eq('id', photoId)
    .select('id')

  if (error) throw error
  if (!data?.length) throw new Error('更新失败：照片不存在或无权限')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 通过 security definer RPC 删除照片，在数据库内部校验 profile_id 归属
export async function deletePhotoInDb(photoId: string, profileId: string) {
  // 非 UUID 格式的 photoId（如本地临时 ID）跳过数据库删除
  if (!UUID_RE.test(photoId)) return

  const supabase = getSupabase()
  // 调用 delete_own_photo RPC，传入 photo_id 和 profile_id 供函数校验
  const { error } = await supabase
    .rpc('delete_own_photo', { p_photo_id: photoId, p_profile_id: profileId })

  if (error) throw error
}

// 通过 security definer RPC 批量删除作品下所有照片，校验 profile_id 归属
export async function deletePostInDb(postId: string, profileId: string) {
  const supabase = getSupabase()
  const { error } = await supabase
    .rpc('delete_own_post', { p_post_id: postId, p_profile_id: profileId })
  if (error) throw error
}

export async function insertPostInDb(
  profileId: string,
  title?: string,
): Promise<string> {
  const supabase = getSupabase()
  const record: Record<string, string> = { profile_id: profileId }
  if (title && title.trim()) record.title = title.trim()

  const { data, error } = await supabase
    .from('posts')
    .insert(record)
    .select('id')
    .single()

  if (error) throw error
  return (data as { id: string }).id
}

// ========== Chat ==========

type ChatRoomRow = {
  id: string
  user1_id: string
  user2_id: string
  last_message_at: string
  created_at: string
}

type ChatMessageRow = {
  id: string
  room_id: string
  sender_id: string
  content: string
  image_url: string | null
  is_read: boolean
  created_at: string
}

export async function findOrCreateChatRoom(
  user1Id: string,
  user2Id: string,
): Promise<string> {
  const supabase = getSupabase()
  const [a, b] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id]

  const { data: existing } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('user1_id', a)
    .eq('user2_id', b)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('chat_rooms')
    .insert({ user1_id: a, user2_id: b })
    .select('id')
    .single()

  if (error) throw error
  return created.id
}

export async function fetchChatRooms(userId: string): Promise<
  { id: string; peerId: string; lastMessageAt: number; unreadCount: number; lastMessage?: string }[]
> {
  const supabase = getSupabase()
  const { data: rooms, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false })

  if (error || !rooms) return []

  const roomIds = (rooms as ChatRoomRow[]).map((r) => r.id)

  const [{ data: lastMsgs }, { data: unread }] = await Promise.all([
    supabase
      .from('messages')
      .select('room_id, content')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('room_id')
      .in('room_id', roomIds)
      .eq('is_read', false)
      .neq('sender_id', userId),
  ])

  const lastMsgMap = new Map<string, string>()
  for (const m of lastMsgs ?? []) {
    if (!lastMsgMap.has(m.room_id)) lastMsgMap.set(m.room_id, m.content)
  }

  const unreadMap = new Map<string, number>()
  for (const m of unread ?? []) {
    unreadMap.set(m.room_id, (unreadMap.get(m.room_id) ?? 0) + 1)
  }

  return (rooms as ChatRoomRow[]).map((r) => {
    const peerId = r.user1_id === userId ? r.user2_id : r.user1_id
    return {
      id: r.id,
      peerId,
      lastMessageAt: new Date(r.last_message_at).getTime(),
      unreadCount: unreadMap.get(r.id) ?? 0,
      lastMessage: lastMsgMap.get(r.id),
    }
  })
}

export async function fetchMessages(
  roomId: string,
): Promise<ChatMessageRow[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
  return (data ?? []) as ChatMessageRow[]
}

export async function insertMessage(
  roomId: string,
  senderId: string,
  content: string,
  imageUrl?: string,
): Promise<ChatMessageRow> {
  const supabase = getSupabase()

  const record: Record<string, string> = {
    room_id: roomId,
    sender_id: senderId,
    content,
  }
  if (imageUrl) record.image_url = imageUrl

  const { data, error } = await supabase
    .from('messages')
    .insert(record)
    .select('*')
    .single()

  if (error) throw error

  await supabase
    .from('chat_rooms')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', roomId)

  return data as unknown as ChatMessageRow
}

export async function markMessagesRead(
  roomId: string,
  userId: string,
): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('room_id', roomId)
    .neq('sender_id', userId)
    .eq('is_read', false)
}

export async function fetchTotalUnreadCount(userId: string): Promise<number> {
  const supabase = getSupabase()
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)
    .neq('sender_id', userId)
  if (error) return 0
  return count ?? 0
}
