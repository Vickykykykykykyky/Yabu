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

export function normalizePhotoUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of urls) {
    if (!isValidPhotoUrl(url) || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}
