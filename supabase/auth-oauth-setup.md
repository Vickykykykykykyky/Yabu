# Supabase 认证扩展配置

## 验证码是谁发的？

**不是 Yabu 网站自己发邮件**，而是 **Supabase Auth** 代发：

| 配置情况 | 发件人 appearance |
|---------|------------------|
| 默认（未配 SMTP） | Supabase 系统邮箱，如 `noreply@mail.app.supabase.io` |
| 已配 SMTP | 你在 Dashboard 里设的名称，如 `Yabu <noreply@yabu.chat>` |

配置路径：**Supabase Dashboard → Project Settings → Authentication → SMTP Settings**

邮件模板可在 **Authentication → Email Templates** 修改（Magic Link / OTP 模板）。

---

## 1) 邮箱验证码（注册 + 登录）

**Dashboard → Authentication → Providers → Email**

- 启用 Email provider
- 建议关闭 **Confirm email**（验证码本身已验证邮箱）
- 配置 SMTP（否则用 Supabase 内置邮件，有每日配额）

**注册**：注册页 →「邮箱验证码」→ 填用户名 + 邮箱 → 收码 → 自动创建账号并绑定邮箱。

**登录**：登录页 → 邮箱 → 验证码 → 向已注册邮箱发码。

---

## 2) Google OAuth

**Dashboard → Authentication → Providers → Google**

- 启用并填入 Google Cloud Client ID / Secret
- Redirect URI：`https://<project-ref>.supabase.co/auth/v1/callback`

**Dashboard → Authentication → URL Configuration**

- Site URL：`https://yabu.chat`
- Redirect URLs：`https://yabu.chat/`

---

## 3) 微信 OAuth（可选）

添加 Custom OAuth Provider，环境变量 `VITE_WECHAT_OAUTH_PROVIDER`。
