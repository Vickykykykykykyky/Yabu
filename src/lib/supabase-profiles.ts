import { getSupabase } from './supabase'
import type { UserPhoto, UserProfile, UserRole } from '../types'

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
}

function rowsToPhotos(rows: PhotoRow[]): UserPhoto[] {
  return rows.map((r) => ({ id: r.id, url: r.url }))
}

function rowToProfile(p: ProfileRow, photoRows: PhotoRow[] = []): UserProfile {
  const photos = rowsToPhotos(photoRows)
  const photoUrls = photos.map((ph) => ph.url)
  return {
    id: p.id,
    displayName: p.display_name,
    avatarUrl: p.avatar_url ?? '',
    role: p.role,
    photos,
    photoUrls,
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
    .select('id, profile_id, url')
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

  const { data: photos, error: photoError } = await supabase
    .from('photos')
    .select('id, profile_id, url')
    .order('created_at')

  if (photoError) throw photoError

  const photosByProfile = new Map<string, PhotoRow[]>()
  for (const row of (photos ?? []) as PhotoRow[]) {
    const list = photosByProfile.get(row.profile_id) ?? []
    list.push(row)
    photosByProfile.set(row.profile_id, list)
  }

  return ((profiles ?? []) as ProfileRow[]).map((p) =>
    rowToProfile(p, photosByProfile.get(p.id) ?? []),
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
): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('photos')
    .insert({
      profile_id: profileId,
      url,
    })
    .select('id')
    .single()

  if (error) throw error
  return (data as { id: string }).id
}

export async function deletePhotoInDb(photoId: string) {
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
