type SupabaseErrShape = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

function asSupabaseErr(err: unknown): SupabaseErrShape | null {
  if (!err || typeof err !== 'object') return null
  return err as SupabaseErrShape
}

export function formatSupabaseError(err: unknown): string {
  const e = asSupabaseErr(err)
  if (e) {
    const msg = e.message ?? ''

    if (e.code === '23505' || /duplicate key|unique constraint/i.test(msg)) {
      return '该名字已被注册，请切换到「登录」'
    }

    if (e.code === 'PHOTO_DELETE_DENIED' || /照片未从数据库删除/i.test(msg)) {
      return (
        '数据库未开放删除权限。请在 Supabase → SQL Editor 运行项目里的 ' +
        '`supabase/photos-delete.sql`（或 `enable-registration.sql` 第 4 节）。'
      )
    }

    if (
      e.code === '42501' ||
      /permission denied|row-level security|RLS/i.test(msg)
    ) {
      return '数据库未开放注册权限。请按注册页下方步骤，在 Supabase SQL Editor 运行一次配置 SQL。'
    }

    if (e.code === 'PGRST116' || /multiple \(or no\) rows returned/i.test(msg)) {
      return '该名字已被注册，请切换到「登录」'
    }

    if (/bucket not found/i.test(msg)) {
      return (
        'Storage 桶「yabu-photos」尚未创建。请在 Supabase → SQL Editor 运行项目里的 ' +
        '`supabase/setup-storage.sql`（或重新运行 `setup-all.sql`，已附带桶创建）。'
      )
    }

    const parts = [e.message, e.details, e.hint, e.code].filter(Boolean)
    if (parts.length) return parts.join(' — ')
  }
  if (err instanceof Error) return err.message
  return '未知错误'
}

/** 登录/注册页统一错误文案 */
export function getAuthErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message
  }
  const formatted = formatSupabaseError(err)
  return formatted === '未知错误' ? '操作失败，请重试' : formatted
}
