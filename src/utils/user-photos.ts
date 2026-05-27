import type { UserPhoto, UserProfile } from '../types'
import { normalizePhotoUrls } from './photos'

export function photosFromUrls(
  urls: string[],
  profileId: string,
): UserPhoto[] {
  return normalizePhotoUrls(urls).map((url, index) => ({
    id: `${profileId}-legacy-${index}`,
    url,
  }))
}

export function withSyncedPhotos(user: UserProfile): UserProfile {
  const photos =
    user.photos?.length > 0
      ? user.photos
      : photosFromUrls(user.photoUrls ?? [], user.id)
  const photoUrls = normalizePhotoUrls(photos.map((p) => p.url))
  return { ...user, photos, photoUrls }
}

export function appendPhoto(
  user: UserProfile,
  photo: UserPhoto,
): UserProfile {
  const photos = [...user.photos, photo]
  return withSyncedPhotos({ ...user, photos })
}

export function removePhotoById(
  user: UserProfile,
  photoId: string,
): UserProfile {
  const photos = user.photos.filter((p) => p.id !== photoId)
  return withSyncedPhotos({ ...user, photos })
}
