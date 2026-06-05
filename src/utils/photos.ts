/** 可用于 <img src> 的照片地址 */
export function isValidPhotoUrl(url: string): boolean {
  const t = url?.trim()
  if (!t) return false

  if (t.startsWith('https://') || t.startsWith('http://') || t.startsWith('/api/photos/')) {
    return true
  }

  if (!t.startsWith('data:image/')) return false

  const base64 = t.split(',')[1]
  if (!base64 || base64.length < 200) return false

  // 过滤明显无效的测试数据（如全 A 的 base64）
  if (/^A{200,}/.test(base64)) return false

  return true
}

/**
 * 将 R2 公网直链转为同源 /api/photos/ 代理。
 * 移动端（尤其安卓）直连 pub-*.r2.dev 常因网络/Referrer 导致加载失败。
 */
export function resolvePhotoUrl(url: string): string {
  const t = url?.trim()
  if (!t) return url
  if (t.startsWith('/api/photos/') || t.startsWith('data:')) return t

  try {
    const parsed = new URL(t, typeof window !== 'undefined' ? window.location.origin : undefined)
    if (parsed.hostname.endsWith('.r2.dev')) {
      // 本地 dev 的 api/server 不提供 /api/photos GET，仍用 R2 直链
      if (import.meta.env.DEV) return t

      const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
      if (key) return `/api/photos/${key}`
    }
  } catch {
    // 非 URL 字符串，原样返回
  }

  return t
}

export function normalizePhotoUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of urls) {
    const resolved = resolvePhotoUrl(url)
    if (!isValidPhotoUrl(resolved) || seen.has(resolved)) continue
    seen.add(resolved)
    out.push(resolved)
  }
  return out
}
