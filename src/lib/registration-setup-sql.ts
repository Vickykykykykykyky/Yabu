import sql from '../../supabase/enable-registration.sql?raw'

export const REGISTRATION_SETUP_SQL = sql

export const REGISTRATION_SQL_EDITOR_URL =
  'https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn/sql/new'

export function isRegistrationPermissionError(message: string): boolean {
  return /未开放注册权限|row-level security|violates row-level security|register_profile/i.test(
    message,
  )
}
