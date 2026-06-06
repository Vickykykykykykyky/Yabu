import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { INITIAL_PASSWORD, validatePassword } from '@/lib/auth-constants'
import { getAuthErrorMessage } from '@/lib/supabase-errors'
import './ChangePasswordPage.css'

type Props = {
  displayName: string
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>
}

export function ChangePasswordPage({ displayName, onSubmit }: Props) {
  const [currentPassword, setCurrentPassword] = useState(INITIAL_PASSWORD)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      validatePassword(newPassword, '新密码')
      if (newPassword !== confirmPassword) {
        throw new Error('两次输入的新密码不一致')
      }
      if (newPassword === INITIAL_PASSWORD) {
        throw new Error('请设置与初始密码不同的新密码')
      }

      setLoading(true)
      await onSubmit(currentPassword, newPassword)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="change-password-page">
      <div className="change-password-page__card">
        <h1 className="change-password-page__title">设置新密码</h1>
        <p className="change-password-page__hint">
          {displayName}，你正在使用初始密码（{INITIAL_PASSWORD}），请先设置自己的新密码。
        </p>

        <form className="change-password-page__form" onSubmit={handleSubmit}>
          <label className="change-password-page__label" htmlFor="current-password">
            当前密码
          </label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
          />

          <label className="change-password-page__label" htmlFor="new-password">
            新密码
          </label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
            autoFocus
          />

          <label className="change-password-page__label" htmlFor="confirm-password">
            确认新密码
          </label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />

          {error && (
            <p className="change-password-page__error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="change-password-page__submit" disabled={loading || !newPassword}>
            {loading ? '保存中…' : '保存并进入'}
          </Button>
        </form>
      </div>
    </div>
  )
}
