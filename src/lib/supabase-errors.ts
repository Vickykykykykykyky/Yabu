export function formatSupabaseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; details?: string; hint?: string; code?: string }
    const parts = [e.message, e.details, e.hint, e.code].filter(Boolean)
    if (parts.length) return parts.join(' — ')
  }
  if (err instanceof Error) return err.message
  return '未知错误'
}
