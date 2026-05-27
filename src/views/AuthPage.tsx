import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getAuthErrorMessage } from '@/lib/supabase-errors'
import { isDisplayNameTaken } from '@/lib/supabase-profiles'
import { loadLocalUsers } from '@/lib/local-users'
import { isSupabaseEnabled } from '@/lib/supabase'
import { normalizeDisplayName } from '@/lib/auth'
import {
  isRegistrationPermissionError,
  REGISTRATION_SETUP_SQL,
  REGISTRATION_SQL_EDITOR_URL,
} from '@/lib/registration-setup-sql'
import './AuthPage.css'

type Mode = 'login' | 'register'

type Props = {
  onLogin: (name: string) => Promise<void>
  onRegister: (name: string) => Promise<void>
}

const DEMO_NAMES = ['小蓝', '小橙', '小绿', '小红', '小紫', '小黄']

export function AuthPage({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<Mode>('register')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [nameStatus, setNameStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle')
  const [copiedSql, setCopiedSql] = useState(false)
  const showSetupGuide = Boolean(error && isRegistrationPermissionError(error))

  const trimmed = normalizeDisplayName(name)

  useEffect(() => {
    if (mode !== 'register' || trimmed.length < 2) {
      setNameStatus('idle')
      return
    }

    if (DEMO_NAMES.includes(trimmed)) {
      setNameStatus('taken')
      return
    }

    if (!isSupabaseEnabled()) {
      const takenLocal =
        DEMO_NAMES.includes(trimmed) ||
        loadLocalUsers().some((u) => u.displayName === trimmed)
      setNameStatus(takenLocal ? 'taken' : 'ok')
      return
    }

    let cancelled = false
    setNameStatus('checking')

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const taken = await isDisplayNameTaken(trimmed)
          if (!cancelled) setNameStatus(taken ? 'taken' : 'ok')
        } catch {
          if (!cancelled) setNameStatus('idle')
        }
      })()
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mode, trimmed])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'register' && nameStatus === 'taken') {
      setError('该名字已被占用，请换一个或切换到「登录」')
      return
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        await onRegister(name)
      } else {
        await onLogin(name)
      }
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const switchToLogin = () => {
    setMode('login')
    setError(null)
    setNameStatus('idle')
  }

  const copySetupSql = async () => {
    try {
      await navigator.clipboard.writeText(REGISTRATION_SETUP_SQL)
      setCopiedSql(true)
      window.setTimeout(() => setCopiedSql(false), 2000)
    } catch {
      setCopiedSql(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <h1 className="auth-page__logo">Yabu</h1>
        <p className="auth-page__tagline">分享你的照片墙</p>

        <div className="auth-page__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-page__tab ${mode === 'login' ? 'auth-page__tab--active' : ''}`}
            onClick={switchToLogin}
          >
            登录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-page__tab ${mode === 'register' ? 'auth-page__tab--active' : ''}`}
            onClick={() => {
              setMode('register')
              setError(null)
            }}
          >
            注册
          </button>
        </div>

        <form className="auth-page__form" onSubmit={submit}>
          <label className="auth-page__label" htmlFor="auth-name">
            {mode === 'register' ? '注册用户名' : '你的名字'}
          </label>
          <Input
            id="auth-name"
            type="text"
            autoComplete="nickname"
            placeholder={mode === 'register' ? '起一个独一无二的名字' : '输入已注册的名字'}
            value={name}
            maxLength={24}
            disabled={loading}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-invalid={nameStatus === 'taken'}
          />

          {mode === 'register' ? (
            <p className="auth-page__hint">
              用户名全局唯一，注册成功后会生成专属 ID
            </p>
          ) : (
            <p className="auth-page__hint">输入注册时使用的名字即可登录</p>
          )}

          {mode === 'register' && trimmed.length >= 2 && (
            <p
              className={`auth-page__name-status auth-page__name-status--${nameStatus}`}
              role="status"
            >
              {nameStatus === 'checking' && '正在检查名字是否可用…'}
              {nameStatus === 'ok' && '这个名字可以注册'}
              {nameStatus === 'taken' &&
                (DEMO_NAMES.includes(trimmed)
                  ? '这是演示账号，请切换到「登录」'
                  : '该名字已被占用')}
            </p>
          )}

          {error && (
            <p className="auth-page__error" role="alert">
              {error}
              {error.includes('已被注册') && mode === 'register' && (
                <button type="button" className="auth-page__link" onClick={switchToLogin}>
                  去登录
                </button>
              )}
            </p>
          )}

          {showSetupGuide && (
            <div className="auth-page__setup">
              <p className="auth-page__setup-title">首次使用需配置数据库（只需一次）</p>
              <ol className="auth-page__setup-steps">
                <li>
                  <a
                    href={REGISTRATION_SQL_EDITOR_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开 Supabase SQL Editor
                  </a>
                </li>
                <li>点击下方「复制 SQL」</li>
                <li>粘贴到编辑器 → 点 Run</li>
                <li>回到此页刷新，再注册</li>
              </ol>
              <div className="auth-page__setup-actions">
                <button type="button" className="auth-page__setup-btn" onClick={copySetupSql}>
                  {copiedSql ? '已复制' : '复制 SQL'}
                </button>
                <a
                  className="auth-page__setup-btn auth-page__setup-btn--link"
                  href={REGISTRATION_SQL_EDITOR_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  去 Supabase
                </a>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="auth-page__submit"
            disabled={
              loading ||
              !name.trim() ||
              (mode === 'register' && (nameStatus === 'taken' || nameStatus === 'checking'))
            }
          >
            {loading ? '请稍候…' : mode === 'register' ? '注册并进入' : '登录'}
          </Button>
        </form>

        {mode === 'register' && (
          <p className="auth-page__demo-hint">
            演示账号（小蓝、小橙等）请用「登录」，不要重复注册。
          </p>
        )}
      </div>
    </div>
  )
}
