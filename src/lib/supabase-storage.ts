import { getSupabase } from './supabase'

export const PHOTOS_BUCKET = 'yabu-photos'

export async function uploadPhotoToSupabase(
  profileId: string,
  blob: Blob,
): Promise<string> {
  const supabase = getSupabase()
  const path = `${profileId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`

  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadAvatarToSupabase(
  profileId: string,
  blob: Blob,
): Promise<string> {
  const supabase = getSupabase()
  const path = `avatars/${profileId}.jpg`

  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: '3600',
    upsert: true,
  })

  if (error) throw error

  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
