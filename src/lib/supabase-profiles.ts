import { getSupabase } from './supabase'
import type { UserProfile, UserRole } from '../types'

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

  const photosByProfile = new Map<string, string[]>()
  for (const row of (photos ?? []) as PhotoRow[]) {
    const list = photosByProfile.get(row.profile_id) ?? []
    list.push(row.url)
    photosByProfile.set(row.profile_id, list)
  }

  return ((profiles ?? []) as ProfileRow[]).map((p) => ({
    id: p.id,
    displayName: p.display_name,
    avatarUrl: p.avatar_url ?? '',
    role: p.role,
    photoUrls: photosByProfile.get(p.id) ?? [],
  }))
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

export async function insertPhotoInDb(profileId: string, url: string) {
  const supabase = getSupabase()
  const { error } = await supabase.from('photos').insert({
    profile_id: profileId,
    url,
  })
  if (error) throw error
}
