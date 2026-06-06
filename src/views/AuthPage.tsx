import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { INITIAL_PASSWORD, OTP_EMAIL_SENDER_HINT, validatePassword } from '@/lib/auth-constants'
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
type LoginMethod = 'name' | 'email'
type RegisterMethod = 'email' | 'name'
type EmailLoginMode = 'password' | 'otp'

type Props = {
  onLogin: (name: string, password: string) => Promise<void>
  onLoginByEmail: (email: string, password: string) => Promise<void>
  onSendEmailOtp?: (email: string) => Promise<void>
  onVerifyEmailOtp?: (email: string, token: string) => Promise<void>
  onSendEmailRegisterOtp?: (email: string, displayName: string) => Promise<void>
  onVerifyEmailRegisterOtp?: (email: string, token: string, displayName: string) => Promise<void>
  onRegister: (name: string, password: string) => Promise<void>
  onWeChatLogin?: () => Promise<void>
  onGoogleLogin?: () => Promise<void>
}

export function AuthPage({
  onLogin,
  onLoginByEmail,
  onSendEmailOtp,
  onVerifyEmailOtp,
  onSendEmailRegisterOtp,
  onVerifyEmailRegisterOtp,
  onRegister,
  onWeChatLogin,
  onGoogleLogin,
}: Props) {
  const supabaseAuth = isSupabaseEnabled()
  const [mode, setMode] = useState<Mode>('login')
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('name')
  const [registerMethod, setRegisterMethod] = useState<RegisterMethod>(supabaseAuth ? 'email' : 'name')
  const [emailLoginMode, setEmailLoginMode] = useState<EmailLoginMode>('otp')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [nameStatus, setNameStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle')
  const [copiedSql, setCopiedSql] = useState(false)
  const showSetupGuide = Boolean(error && isRegistrationPermissionError(error))

  const trimmed = normalizeDisplayName(name)
  const usingEmailOtp =
    supabaseAuth &&
    ((mode === 'login' && loginMethod === 'email' && emailLoginMode === 'otp') ||
      (mode === 'register' && registerMethod === 'email'))

  useEffect(() => {
    if (otpCooldown <= 0) return
    const timer = window.setTimeout(() => setOtpCooldown((n) => n - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [otpCooldown])

  useEffect(() => {
    if (mode !== 'register' || trimmed.length < 2) {
      setNameStatus('idle')
      return
    }

    if (!supabaseAuth) {
      const takenLocal = loadLocalUsers().some((u) => u.displayName === trimmed)
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
  }, [mode, trimmed, supabaseAuth])

  const resetOtp = () => {
    setOtpSent(false)
    setOtpCode('')
  }

  const sendOtp = async () => {
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'register' && registerMethod === 'email') {
        if (!onSendEmailRegisterOtp) {
          throw new Error('邮箱验证码注册需要连接 Supabase')
        }
        if (nameStatus === 'taken') {
          throw new Error('该名字已被占用')
        }
        await onSendEmailRegisterOtp(email, name)
      } else {
        if (!onSendEmailOtp) {
          throw new Error('邮箱验证码登录需要连接 Supabase')
        }
        await onSendEmailOtp(email)
      }
      setOtpSent(true)
      setOtpCooldown(60)
      setInfo(`验证码已发送，请查收邮件（含垃圾箱）。${OTP_EMAIL_SENDER_HINT}`)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (mode === 'register' && nameStatus === 'taken') {
      setError('该名字已被占用，请换一个或切换到「登录」')
      return
    }

    if (usingEmailOtp) {
      if (!otpSent) {
        await sendOtp()
        return
      }

      setLoading(true)
      try {
        if (mode === 'register') {
          if (!onVerifyEmailRegisterOtp) {
            throw new Error('邮箱验证码注册需要连接 Supabase')
          }
          await onVerifyEmailRegisterOtp(email, otpCode, name)
        } else if (!onVerifyEmailOtp) {
          throw new Error('邮箱验证码登录需要连接 Supabase')
        } else {
          await onVerifyEmailOtp(email, otpCode)
        }
      } catch (err) {
        setError(getAuthErrorMessage(err))
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      validatePassword(password)
      if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('两次输入的密码不一致')
        }
      }
    } catch (err) {
      setError(getAuthErrorMessage(err))
      return
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        await onRegister(name, password)
      } else if (loginMethod === 'email') {
        await onLoginByEmail(email, password)
      } else {
        await onLogin(name, password)
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
    setInfo(null)
    resetOtp()
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

  const handleOAuth = async (fn?: () => Promise<void>) => {
    if (!fn) return
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      await fn()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const showNameField = mode === 'register' || loginMethod === 'name' || usingEmailOtp
  const showEmailField =
    usingEmailOtp || (mode === 'login' && loginMethod === 'email')
  const showPasswordFields = !usingEmailOtp

  const canSubmit =
    !loading &&
    (usingEmailOtp
      ? trimmed.length >= 2 &&
        nameStatus !== 'taken' &&
        nameStatus !== 'checking' &&
        email.trim().includes('@') &&
        (otpSent ? otpCode.trim().length >= 6 : true)
      : mode === 'register'
        ? name.trim().length >= 2 &&
          password.length >= 4 &&
          nameStatus !== 'taken' &&
          nameStatus !== 'checking' &&
          confirmPassword.length >= 4
        : loginMethod === 'name'
          ? name.trim().length >= 2 && password.length >= 4
          : email.trim().includes('@') && password.length >= 4)

  const submitLabel = usingEmailOtp
    ? otpSent
      ? mode === 'register'
        ? '验证并注册'
        : '验证并登录'
      : otpCooldown > 0
        ? `${otpCooldown}s 后可重发`
        : '发送验证码'
    : mode === 'register'
      ? '注册并进入'
      : '登录'

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
              setInfo(null)
              resetOtp()
            }}
          >
            注册
          </button>
        </div>

        {mode === 'login' && (
          <div className="auth-page__method-tabs" role="tablist" aria-label="登录方式">
            <button
              type="button"
              className={`auth-page__method-tab ${loginMethod === 'name' ? 'auth-page__method-tab--active' : ''}`}
              onClick={() => {
                setLoginMethod('name')
                resetOtp()
              }}
            >
              用户名
            </button>
            <button
              type="button"
              className={`auth-page__method-tab ${loginMethod === 'email' ? 'auth-page__method-tab--active' : ''}`}
              onClick={() => {
                setLoginMethod('email')
                resetOtp()
              }}
            >
              邮箱
            </button>
          </div>
        )}

        {mode === 'register' && supabaseAuth && (
          <div className="auth-page__method-tabs" role="tablist" aria-label="注册方式">
            <button
              type="button"
              className={`auth-page__method-tab ${registerMethod === 'email' ? 'auth-page__method-tab--active' : ''}`}
              onClick={() => {
                setRegisterMethod('email')
                resetOtp()
              }}
            >
              邮箱验证码
            </button>
            <button
              type="button"
              className={`auth-page__method-tab ${registerMethod === 'name' ? 'auth-page__method-tab--active' : ''}`}
              onClick={() => {
                setRegisterMethod('name')
                resetOtp()
              }}
            >
              用户名密码
            </button>
          </div>
        )}

        {mode === 'login' && loginMethod === 'email' && supabaseAuth && (
          <div className="auth-page__method-tabs auth-page__method-tabs--sub" role="tablist" aria-label="邮箱登录方式">
            <button
              type="button"
              className={`auth-page__method-tab ${emailLoginMode === 'otp' ? 'auth-page__method-tab--active' : ''}`}
              onClick={() => {
                setEmailLoginMode('otp')
                resetOtp()
              }}
            >
              验证码
            </button>
            <button
              type="button"
              className={`auth-page__method-tab ${emailLoginMode === 'password' ? 'auth-page__method-tab--active' : ''}`}
              onClick={() => {
                setEmailLoginMode('password')
                resetOtp()
              }}
            >
              密码
            </button>
          </div>
        )}

        <form className="auth-page__form" onSubmit={submit}>
          {showNameField && (
            <>
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
                autoFocus={!showEmailField || mode === 'register'}
                aria-invalid={nameStatus === 'taken'}
              />
            </>
          )}

          {showEmailField && (
            <>
              <label className="auth-page__label" htmlFor="auth-email">
                邮箱
              </label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={loading}
                onChange={(e) => {
                  setEmail(e.target.value)
                  resetOtp()
                }}
                autoFocus={mode === 'login' && loginMethod === 'email'}
              />
            </>
          )}

          {usingEmailOtp && otpSent && (
            <>
              <label className="auth-page__label" htmlFor="auth-otp">
                验证码
              </label>
              <Input
                id="auth-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 位数字"
                value={otpCode}
                maxLength={8}
                disabled={loading}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </>
          )}

          {showPasswordFields && (
            <>
              <label className="auth-page__label" htmlFor="auth-password">
                密码
              </label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                placeholder={mode === 'register' ? '设置登录密码' : '输入密码'}
                value={password}
                disabled={loading}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}

          {mode === 'register' && registerMethod === 'name' && (
            <>
              <label className="auth-page__label" htmlFor="auth-password-confirm">
                确认密码
              </label>
              <Input
                id="auth-password-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="再次输入密码"
                value={confirmPassword}
                disabled={loading}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </>
          )}

          {mode === 'register' && registerMethod === 'name' ? (
            <p className="auth-page__hint">注册时需自行设置密码，至少 4 位</p>
          ) : mode === 'register' && registerMethod === 'email' ? (
            <p className="auth-page__hint">
              填写用户名和邮箱，验证后自动绑定邮箱，无需再设密码。{OTP_EMAIL_SENDER_HINT}
            </p>
          ) : loginMethod === 'name' ? (
            <p className="auth-page__hint">
              使用注册时的用户名登录；若账号由管理员导入，初始密码可能为 {INITIAL_PASSWORD}，首次登录需修改
            </p>
          ) : usingEmailOtp ? (
            <p className="auth-page__hint">
              向已注册邮箱发送验证码。{OTP_EMAIL_SENDER_HINT}
            </p>
          ) : (
            <p className="auth-page__hint">使用已绑定的邮箱和密码登录</p>
          )}

          {info && <p className="auth-page__info">{info}</p>}

          {mode === 'register' && trimmed.length >= 2 && (
            <p
              className={`auth-page__name-status auth-page__name-status--${nameStatus}`}
              role="status"
            >
              {nameStatus === 'checking' && '正在检查名字是否可用…'}
              {nameStatus === 'ok' && '这个名字可以注册'}
              {nameStatus === 'taken' && '该名字已被占用'}
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
                  <a href={REGISTRATION_SQL_EDITOR_URL} target="_blank" rel="noreferrer">
                    打开 Supabase SQL Editor
                  </a>
                </li>
                <li>运行 `supabase/auth-passwords.sql`</li>
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
            disabled={!canSubmit || (usingEmailOtp && !otpSent && otpCooldown > 0)}
          >
            {loading ? '请稍候…' : submitLabel}
          </Button>

          {usingEmailOtp && otpSent && (
            <button
              type="button"
              className="auth-page__resend"
              disabled={loading || otpCooldown > 0}
              onClick={() => {
                setOtpCode('')
                void sendOtp()
              }}
            >
              {otpCooldown > 0 ? `${otpCooldown}s 后可重新发送` : '重新发送验证码'}
            </button>
          )}
        </form>

        {supabaseAuth && (onGoogleLogin || onWeChatLogin) && (
          <div className="auth-page__oauth">
            <div className="auth-page__oauth-divider">或</div>
            <div className="auth-page__oauth-buttons">
              {onGoogleLogin && (
                <Button
                  type="button"
                  variant="outline"
                  className="auth-page__oauth-btn"
                  disabled={loading}
                  onClick={() => handleOAuth(onGoogleLogin)}
                >
                  Google 登录
                </Button>
              )}
              {onWeChatLogin && (
                <Button
                  type="button"
                  variant="outline"
                  className="auth-page__oauth-btn"
                  disabled={loading}
                  onClick={() => handleOAuth(onWeChatLogin)}
                >
                  微信登录
                </Button>
              )}
            </div>
          </div>
        )}

        {mode === 'register' && registerMethod === 'name' && (
          <p className="auth-page__demo-hint">
            已有账号请用「登录」，不要重复注册。
          </p>
        )}
      </div>
    </div>
  )
}
