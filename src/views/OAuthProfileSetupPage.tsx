import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getAuthErrorMessage } from '@/lib/supabase-errors'
import { isDisplayNameTaken } from '@/lib/supabase-profiles'
import { normalizeDisplayName } from '@/lib/auth'
import './OAuthProfileSetupPage.css'

type Props = {
  onSubmit: (displayName: string) => Promise<void>
  onLogout: () => void | Promise<void>
}

export function OAuthProfileSetupPage({ onSubmit, onLogout }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const trimmed = normalizeDisplayName(name)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (trimmed.length < 2) {
      setError('名字至少需要 2 个字符')
      return
    }

    setLoading(true)
    try {
      if (await isDisplayNameTaken(trimmed)) {
        throw new Error('该名字已被占用，请换一个')
      }
      await onSubmit(trimmed)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="oauth-setup-page">
      <div className="oauth-setup-page__card">
        <h1 className="oauth-setup-page__title">完成账号设置</h1>
        <p className="oauth-setup-page__hint">
          你已通过 Google / 第三方登录，请起一个 Yabu 用户名完成注册。
        </p>

        <form className="oauth-setup-page__form" onSubmit={handleSubmit}>
          <label className="oauth-setup-page__label" htmlFor="oauth-name">
            用户名
          </label>
          <Input
            id="oauth-name"
            type="text"
            maxLength={24}
            placeholder="起一个独一无二的名字"
            value={name}
            disabled={loading}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          {error && (
            <p className="oauth-setup-page__error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="oauth-setup-page__submit" disabled={loading || trimmed.length < 2}>
            {loading ? '保存中…' : '进入 Yabu'}
          </Button>
        </form>

        <button type="button" className="oauth-setup-page__logout" onClick={() => void onLogout()}>
          取消并退出
        </button>
      </div>
    </div>
  )
}
