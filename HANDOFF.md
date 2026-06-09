# Yabu 项目框架总结（移植/交接用）

> **注意**：仓库内 `ARCHITECTURE.md` 部分过时（仍写「不用 Supabase Auth」）。**以本文为准**。

---

## 1. 产品是什么

**Yabu**（https://yabu.chat）是一个中文 UI 的**照片分享墙**：

- 用户注册/登录 → 上传照片（单张或成组帖子）→ 首页三栏展示各用户照片墙
- 附加功能：个人主页、点赞/收藏、通知、私信聊天、搜索/发现、Reels 占位页
- 无 React Router：用 **`window.location.hash`** 切换视图（`#home`、`#profile` 等）

---

## 2. 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + TypeScript + Vite 6 |
| 样式 | Tailwind CSS 4 + 大量手写 CSS（各 view/component 有独立 `.css`） |
| UI | shadcn/ui 风格（`src/components/ui/*`）+ Radix UI + Lucide 图标 |
| PWA | `vite-plugin-pwa`（Workbox 缓存静态资源 + 照片 API） |
| 数据库 | Supabase PostgreSQL（项目 `pmajmgryddjdgstpfcfn`） |
| 认证 | **Supabase Auth** + `profiles.auth_user_id` 绑定 |
| 文件存储 | 默认 Supabase Storage（`yabu-photos` 桶）；可选 Cloudflare R2 |
| 后端 API | Cloudflare Worker（`worker/index.ts`）— 仅 R2 照片 CRUD + SPA 静态托管 |
| 部署 | `npm run build` → `npx wrangler deploy`（Worker 托管 `dist/` + R2 binding） |

**没有** Redux/Zustand：状态集中在两个 hook — `useAuth`、`useAppState`。

---

## 3. 目录结构（关键文件）

```
Yabu/
├── src/
│   ├── App.tsx              # 根组件：auth gate + hash 路由 + AuthenticatedApp
│   ├── main.tsx             # React 入口
│   ├── types.ts             # UserProfile, Post, NavView 等全局类型
│   ├── hooks/
│   │   ├── useAuth.ts       # 登录态 boot（5s 超时）+ session 管理
│   │   └── useAppState.ts   # 用户/照片/点赞/通知/聊天等业务状态
│   ├── lib/
│   │   ├── auth.ts          # 所有认证逻辑（核心，~650 行）
│   │   ├── auth-session.ts  # localStorage session: { profileId, displayName, ... }
│   │   ├── auth-constants.ts# 内部邮箱域名 users.yabu.chat、初始密码 0506
│   │   ├── supabase.ts      # Supabase client 单例
│   │   ├── supabase-profiles.ts  # 所有 DB RPC/CRUD（~750 行）
│   │   ├── supabase-storage.ts   # Storage 上传头像/照片
│   │   ├── supabase-errors.ts    # 错误文案中文化
│   │   ├── local-users.ts        # 无 Supabase 时的 localStorage 用户
│   │   └── r2-api.ts             # R2 Worker API 封装
│   ├── views/               # 页面级组件（AuthPage, HomeFeed, ProfileView, MessagesView…）
│   └── components/          # UserColumn, PhotoViewer, NavSidebar, UploadPreview…
├── worker/index.ts          # Cloudflare Worker：/api/* + SPA fallback
├── supabase/                # SQL 脚本（见第 6 节）
├── wrangler.toml            # Worker 名 yabu，R2 bucket yabusunnyday
├── vite.config.ts           # Vite + PWA 配置
└── dist/                    # 构建产物（部署用）
```

---

## 4. 应用启动流程

```
main.tsx → App.tsx
  ├─ useAuth() booting?
  │    └─ 显示「加载中…」（最多 ~5.5s 后强制结束）
  ├─ needsProfileSetup? → OAuthProfileSetupPage（OAuth 后补用户名）
  ├─ !session? → AuthPage（登录/注册）
  ├─ mustChangePassword? → ChangePasswordPage
  └─ AuthenticatedApp(profileId) → useAppState(profileId) → 各 View
```

**Hash 路由**（非 react-router）：

```typescript
// App.tsx
NavView = 'home' | 'reels' | 'messages' | 'search' | 'explore' |
          'notifications' | 'profile' | 'likes' | 'favorites'
// window.location.hash 同步 activeView
```

---

## 5. 认证架构（当前实现）

### 5.1 双模式

`isSupabaseEnabled()` 检测 `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` 是否配置：

- **有 Supabase**：走 Supabase Auth + PostgreSQL
- **无 Supabase**：纯 localStorage 演示模式（`local-users.ts`）

生产环境 **已配置 Supabase**（bundle 内嵌 `pmajmgryddjdgstpfcfn.supabase.co`）。

### 5.2 用户名登录的核心映射

用户名 **不直接** 作为 Supabase 登录名，而是：

```
display_name → profiles.id → auth email: {profileId}@users.yabu.chat
```

- 注册：`signUp(email=内部邮箱, password)` → RPC `register_profile_auth` → 写 `profiles.auth_user_id`
- 登录：`findProfileByDisplayName` → `signInWithPassword(内部邮箱, password)`
- 老用户迁移：`auth-passwords.sql` 批量创建 `auth.users`，初始密码 **`0506`**，`must_change_password=true`

### 5.3 Session 存储

两层 session：

1. **Supabase session**（`supabase-js` 自动 persist 到 localStorage）
2. **App session**（`yabu-auth-session` key）：`{ profileId, displayName, mustChangePassword?, authUserId? }`

Boot 时 `useAuth` → `syncAuthFromSupabaseSession()` → `fetchProfileRowByAuthUserId()`（轻量，不拉照片）。

### 5.4 支持的登录方式

| 方式 | 状态 | 依赖 |
|------|------|------|
| 用户名 + 密码 | ✅ 主要方式 | `auth-passwords.sql` |
| 邮箱 + 密码 | ✅ | `profiles.contact_email` |
| 邮箱 OTP 验证码 | ✅ 代码已有 | Supabase Email provider（SMTP 可选） |
| Google OAuth | ✅ 代码已有 | Dashboard 配 Google provider + Site URL |
| 微信 OAuth | 占位 | 需 Custom provider |

**SMTP / Google / 邮箱验证码 Dashboard 配置是可选的**，不影响用户名密码登录，也不影响启动页。

### 5.5 关键 auth 文件

- `src/lib/auth.ts` — 所有 signUp/signIn/OTP/OAuth/改密/绑邮箱
- `src/hooks/useAuth.ts` — React 层 boot + 暴露 login/register/logout
- `src/views/AuthPage.tsx` — 登录 UI
- `supabase/auth-passwords.sql` — 密码迁移 + `register_profile_auth` RPC

---

## 6. 数据库 / SQL 执行顺序

Supabase 项目：**`pmajmgryddjdgstpfcfn`**

| 顺序 | 文件 | 用途 |
|------|------|------|
| 1 | `supabase/setup-all.sql` | 一键建表（profiles, photos, posts, follows, likes, notifications, chat…） |
| 2 | `supabase/auth-passwords.sql` | 加 `contact_email`、密码 auth 用户、初始密码 0506 |
| 可选 | `supabase/repair-base.sql` | schema 修复（不覆盖 demo 名） |
| 可选 | `supabase/diagnose-schema.sql` | 检查表/行数 |
| 可选 | `supabase/auth-oauth-setup.md` | SMTP/Google 配置说明 |

### 主要表

| 表 | 用途 |
|----|------|
| `profiles` | 用户资料，`auth_user_id` 绑 Supabase Auth |
| `photos` | 每行一张照片，可有 `post_id`、`caption` |
| `posts` | 多图帖子分组 |
| `follows` | 关注 |
| `likes` / `favorites` | 点赞/收藏 |
| `notifications` | 通知 |
| `chat_rooms` / `messages` | 私信 |

### RLS 策略

写操作多通过 **`security definer` RPC** 代理（如 `delete_own_photo`、`delete_own_post`、`register_profile_auth`），在函数内校验 `profile_id` 归属。

---

## 7. 数据流（业务）

### 加载用户/照片

```
AuthenticatedApp → useAppState(profileId)
  → fetchAllProfiles()     # supabase-profiles.ts，JOIN photos + posts
  → Realtime subscription  # 通知未读数
```

### 上传

```
UploadButton → compressImageToBlob
  → VITE_USE_R2=true:  POST /api/users/:id/photos → R2 → insertPhotoInDb
  → 否则: uploadPhotoToSupabase() → Storage → insertPhotoInDb
  → 多图: insertPostInDb + 多张 insertPhotoInDb
```

### 删除

```
removePost / removePhoto → deletePostInDb / deletePhotoInDb (RPC)
  → 若 R2：deleteUserPhoto() 删对象存储
```

---

## 8. 环境变量

```env
# .env.local（构建时 bake 进 bundle，改后需 rebuild）
VITE_SUPABASE_URL=https://pmajmgryddjdgstpfcfn.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...

# 可选：照片走 R2 而非 Supabase Storage
VITE_USE_R2=true
```

`wrangler.toml` 也有 `SUPABASE_URL` / `SUPABASE_ANON_KEY`（Worker 侧，当前 Worker 主要服务 R2 API，不直接查 Supabase）。

---

## 9. 部署

```bash
npm run build          # tsc + vite build → dist/
npx wrangler deploy    # 部署 Worker + dist/ 静态资源到 yabu.chat
```

- Worker 名：`yabu`
- R2 bucket：`yabusunnyday`（binding `PHOTOS`）
- PWA Service Worker 会缓存 JS/CSS — **更新后用户可能需要清站点数据**

本地开发：

```bash
npm run dev            # Vite :5173
npm run dev:all        # Vite + 本地 API（R2 模式）
npx wrangler dev --remote  # Worker + 真实 R2
```

---

## 10. 当前已知问题 / 进行中

1. **「加载中…」卡住**
   - 根因：boot 时 Supabase `getSession()` 或旧版 `fetchProfileByAuthUserId`（拉全量照片）挂起
   - 已修：`fetchProfileRowByAuthUserId` + 5s 超时 + failsafe
   - 已部署 bundle `index-D4wjVtt2.js`，但 PWA 缓存可能导致用户仍看到旧版

2. **`ARCHITECTURE.md` 过时**
   - 仍写「不用 Supabase Auth」— 需更新

3. **`profiles` 若为空**
   - `auth-passwords.sql` 不会创建用户 → 需在 AuthPage 注册，或先写入 profiles 再跑 SQL

4. **邮箱/SMTP/Google 未配**
   - 只影响对应登录方式，**不是**启动卡住的原因

---

## 11. 给下一个大模型的建议切入点

| 任务 | 先看 |
|------|------|
| 修登录/boot | `useAuth.ts` → `auth.ts` → `supabase-profiles.ts`（`fetchProfileRowByAuthUserId`） |
| 改 UI/布局 | `App.tsx`、`views/*`、`components/UserColumn.tsx`、`PhotoViewer.tsx` |
| 改数据库 | `supabase/setup-all.sql`、`auth-passwords.sql`、`supabase-profiles.ts` |
| 改上传/存储 | `useAppState.ts`、`supabase-storage.ts`、`r2-api.ts`、`worker/index.ts` |
| 改认证流程 | `auth.ts`、`AuthPage.tsx`、`auth-passwords.sql` |
| 部署 | `wrangler.toml`、`npm run build && npx wrangler deploy` |

---

## 12. 一句话架构

**React SPA（hash 路由）+ Supabase（Auth + Postgres + Storage）+ 可选 Cloudflare R2，全部由一个 Cloudflare Worker 托管静态资源和 R2 API；业务状态在两个 hook 里，DB 操作集中在 `supabase-profiles.ts`，认证集中在 `auth.ts`。**
