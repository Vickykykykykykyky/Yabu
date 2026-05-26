const MAX_EDGE = 1280
const MAX_EDGE_DB = 1024
const JPEG_QUALITY = 0.82
const JPEG_QUALITY_DB = 0.78

export async function compressImageFile(
  file: File,
  options?: { maxEdge?: number; quality?: number },
): Promise<string> {
  const maxEdge = options?.maxEdge ?? MAX_EDGE
  const quality = options?.quality ?? JPEG_QUALITY
  const bitmap = await loadImageSource(file)
  const { width, height } = fitSize(bitmap.width, bitmap.height, maxEdge)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法处理图片')
  }

  ctx.drawImage(bitmap, 0, 0, width, height)

  if ('close' in bitmap && typeof bitmap.close === 'function') {
    bitmap.close()
  }

  return canvas.toDataURL('image/jpeg', quality)
}

/** 上传用：体积更小，适合 Supabase / localStorage */
export async function compressImageToBlob(file: File): Promise<Blob> {
  const dataUrl = await compressImageFile(file, {
    maxEdge: MAX_EDGE_DB,
    quality: JPEG_QUALITY_DB,
  })
  const res = await fetch(dataUrl)
  return res.blob()
}

function fitSize(w: number, h: number, maxEdge: number) {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h }
  const scale = maxEdge / Math.max(w, h)
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  }
}

async function loadImageSource(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
