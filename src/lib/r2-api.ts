const useR2 = import.meta.env.VITE_USE_R2 === 'true'

export function isR2Enabled() {
  return useR2
}

export async function checkR2Health(): Promise<boolean> {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return data.ok === true
  } catch {
    return false
  }
}

export type PhotoMeta = {
  key: string
  url: string
}

export async function listUserPhotos(userId: string): Promise<PhotoMeta[]> {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/photos`)
  if (!res.ok) {
    throw new Error(`加载照片失败 (${res.status})`)
  }
  const data = (await res.json()) as { photos: PhotoMeta[] }
  return data.photos ?? []
}

export async function uploadUserPhoto(userId: string, file: Blob): Promise<PhotoMeta> {
  const form = new FormData()
  form.append('file', file, 'photo.jpg')

  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/photos`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `上传失败 (${res.status})`)
  }

  return (await res.json()) as PhotoMeta
}
