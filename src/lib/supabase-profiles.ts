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

function rowsToPosts(postRows: PostRow[], allPhotos: UserPhoto[]): Post[] {
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
  return postRows.map((r) => ({
    id: r.id,
    profileId: r.profile_id,
    title: r.title ?? undefined,
    photos: photosByPost.get(r.id) ?? [],
    createdAt: new Date(r.created_at).getTime(),
  }))
}

function rowToProfile(p: ProfileRow, photoRows: PhotoRow[] = [], postRows: PostRow[] = []): UserProfile {
  const photos = rowsToPhotos(photoRows)
  const photoUrls = photos.map((ph) => ph.url)
  const posts = rowsToPosts(postRows, photos)
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

  const { data: photos, error: photoError } = await supabase
    .from('photos')
    .select('id, profile_id, url, caption, original_url, thumbnail_url, width, height, post_id')
    .eq('profile_id', id)
    .order('created_at')

  if (photoError) throw photoError

  return rowToProfile(profile as ProfileRow, (photos ?? []) as PhotoRow[])
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
  const { error } = await supabase
    .from('photos')
    .update({ caption })
    .eq('id', photoId)

  if (error) throw error
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function deletePhotoInDb(photoId: string) {
  if (!UUID_RE.test(photoId)) return

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId)
    .select('id')

  if (error) throw error
  if (!data?.length) {
    const err = new Error('照片未从数据库删除（可能缺少删除权限）') as Error & {
      code?: string
    }
    err.code = 'PHOTO_DELETE_DENIED'
    throw err
  }
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
