import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { validatePassword } from '@/lib/auth-constants'
import { getAuthErrorMessage } from '@/lib/supabase-errors'
import './AccountSettings.css'

type Props = {
  onLinkEmail: (email: string, password: string) => Promise<void>
  onWeChatLogin?: () => Promise<void>
}

export function AccountSettings({ onLinkEmail, onWeChatLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    setLoading(true)
    try {
      validatePassword(password)
      await onLinkEmail(email, password)
      setMessage('邮箱已绑定，之后可用邮箱登录')
      setPassword('')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleWeChat = async () => {
    if (!onWeChatLogin) return
    setMessage(null)
    setError(null)
    setLoading(true)
    try {
      await onWeChatLogin()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="account-settings">
      <h2 className="account-settings__title">账号绑定</h2>
      <p className="account-settings__hint">绑定后可使用邮箱或微信登录同一账号</p>

      <form className="account-settings__form" onSubmit={handleLinkEmail}>
        <label className="account-settings__label" htmlFor="link-email">
          绑定邮箱
        </label>
        <Input
          id="link-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          disabled={loading}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="account-settings__label" htmlFor="link-password">
          登录密码
        </label>
        <Input
          id="link-password"
          type="password"
          autoComplete="new-password"
          placeholder="用于邮箱登录的密码"
          value={password}
          disabled={loading}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={loading || !email.includes('@') || password.length < 4}>
          绑定邮箱
        </Button>
      </form>

      {onWeChatLogin && (
        <Button
          type="button"
          variant="outline"
          className="account-settings__wechat"
          disabled={loading}
          onClick={handleWeChat}
        >
          绑定微信
        </Button>
      )}

      {message && <p className="account-settings__message">{message}</p>}
      {error && (
        <p className="account-settings__error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
