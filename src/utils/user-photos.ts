import type { UserPhoto, UserProfile, Post } from '../types'
import { normalizePhotoUrls } from './photos'

function derivePostsFromPhotos(user: UserProfile, photos: UserPhoto[]): Post[] {
  if (user.posts?.length) {
    return user.posts.filter((p) => p.photos.length > 0)
  }

  const byPost = new Map<string, UserPhoto[]>()
  const standalone: UserPhoto[] = []
  for (const ph of photos) {
    if (ph.postId) {
      const list = byPost.get(ph.postId) ?? []
      list.push(ph)
      byPost.set(ph.postId, list)
    } else {
      standalone.push(ph)
    }
  }

  const posts: Post[] = [...byPost.entries()].map(([postId, list]) => ({
    id: postId,
    profileId: user.id,
    photos: list,
    createdAt: 0,
  }))

  for (const ph of standalone) {
    posts.push({
      id: `legacy:${ph.id}`,
      profileId: user.id,
      photos: [ph],
      createdAt: 0,
    })
  }

  return posts
}

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
  const posts = derivePostsFromPhotos(user, photos)
  return { ...user, photos, photoUrls, posts }
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
  const posts = (user.posts ?? [])
    .map((post) => ({
      ...post,
      photos: post.photos.filter((p) => p.id !== photoId),
    }))
    .filter((post) => post.photos.length > 0)

  return withSyncedPhotos({ ...user, photos, posts })
}
