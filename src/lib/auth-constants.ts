/** 内部 Auth 邮箱域名（用户名登录时映射到此邮箱） */
export const AUTH_EMAIL_DOMAIN = 'users.yabu.chat'

export const INITIAL_PASSWORD = '0506'

export const MIN_PASSWORD_LENGTH = 4

/** 验证码邮件由 Supabase Auth 发出；配置 SMTP 后可改发件人名称 */
export const OTP_EMAIL_SENDER_HINT =
  '验证码由 Supabase 邮件服务发送（不是 Yabu 服务器直接发信）。默认发件人为 Supabase 系统邮箱；可在 Supabase → Authentication → SMTP 自定义为「Yabu」和你的域名邮箱。'

export function profileAuthEmail(profileId: string): string {
  return `${profileId}@${AUTH_EMAIL_DOMAIN}`
}

export function isInternalAuthEmail(email: string): boolean {
  return email.endsWith(`@${AUTH_EMAIL_DOMAIN}`)
}

export function validatePassword(password: string, label = '密码'): string {
  const trimmed = password.trim()
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${label}至少需要 ${MIN_PASSWORD_LENGTH} 位`)
  }
  if (trimmed.length > 64) {
    throw new Error(`${label}不能超过 64 位`)
  }
  return trimmed
}
