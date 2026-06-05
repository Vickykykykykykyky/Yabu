# Yabu 项目架构

## 概述

照片分享墙：用户注册/登录 → 上传照片（单张或成组） → 在首页三栏墙展示。

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端框架 | React 19 + TypeScript | |
| 构建工具 | Vite 6 | `vite.config.ts` |
| 样式 | Tailwind CSS 4 + 手写 CSS | |
| UI 组件 | Radix UI（Avatar、ScrollArea） | |
| 图标 | Lucide React | |
| 数据库 | Supabase（PostgreSQL） | `supabase/` 目录 |
| 文件存储 | Cloudflare R2（可选） | 通过 Worker 访问 |
| 后端 API | Cloudflare Workers | `worker/index.ts` |
| 部署 | Cloudflare Pages + Worker | `wrangler.toml` |

## 目录结构

```
yabu/
├── src/                    # 前端源码
│   ├── components/         # 通用组件（Avatar、UserColumn、PhotoViewer 等）
│   ├── hooks/              # React Hooks（useAppState、useAuth）
│   ├── lib/                # 后端对接层（Supabase、R2、Auth、localStorage）
│   ├── utils/              # 工具函数（图片处理、数据清洗）
│   ├── views/              # 页面级组件（HomeFeed、ProfileView、NotificationsView 等）
│   ├── types.ts            # 全局类型定义
│   ├── App.tsx             # 根组件 + 路由 + 状态分发
│   └── main.tsx            # 入口
├── worker/                 # Cloudflare Worker 后端
│   └── index.ts            # HTTP API（健康检查、照片 CRUD）
├── api/                    # 备用本地 API（非必需）
│   └── server.js
├── supabase/               # 数据库脚本（表创建、RLS 策略、函数）
│   ├── setup-all.sql       # 一键全量建表
│   ├── photos-delete.sql   # 删除照片 RLS
│   ├── photos-update.sql   # 更新照片 RLS
│   ├── enable-registration.sql  # 注册功能 SQL
│   └── migrations/         # 增量迁移
├── public/                 # 静态资源
├── docs/                   # 文档
├── dist/                   # 构建产物（gitignore）
├── scripts/                # Node 脚本
├── wrangler.toml           # Cloudflare 部署配置
├── .env.local              # 本地环境变量（不提交 Git）
└── vite.config.ts          # Vite 配置
```

## 数据流

### 用户注册/登录（自定义 Auth，非 Supabase Auth）

```
用户输入名字
  → lib/auth.ts: registerWithName() / loginWithName()
    → Supabase: register_profile RPC（调用储存过程，创建 profile）
    → session 存 localStorage（{ profileId, displayName }）
    → useAuth() hook 管理 session 状态
```

注意：不经过 Supabase Auth，`auth.uid()` 永远为 null。RLS 策略依赖 `anon` 角色而非 `authenticated`。

### 上传照片（单张）

```
UploadButton → pickImageFile → compressImageToBlob
  → lib/r2-api.ts: uploadUserPhoto() → POST /api/users/:userId/photos
  → Worker 存入 R2，返回 URL 和 key
  → hooks/useAppState.ts: addPhoto() → 存 Supabase + 更新本地状态
```

### 上传照片（成组，一个帖子多张图）

```
UploadPreview → onConfirm(title, items)
  → App.tsx handleUpload()
    → title 或 items.length > 1 → addPost() （成组上传）
    → 否则 → addPhoto() （单张上传）
  → useAppState.ts: addPost()
    → Supabase: insertPostInDb() → 创建帖子记录
    → 遍历每张照片 insertPhotoInDb() → 每张都带 postId
    → 更新本地状态
```

### 删除作品

```
ProfileView 点"删除"
  → onDeletePost(post) → handleDeletePost()
    → removePost(userId, postId, photoIds, photoUrls)
      → 遍历删 R2（deleteUserPhoto）
      → RPC delete_own_post（数据库内校验 profile_id + 批量删）
      → 更新本地状态（一次性移除所有照片 + 帖子）
```

### 通知红点

```
useAppState.ts:
  fetchUnreadNotificationCount(loggedInUserId) → Supabase COUNT
  依赖 Supabase Realtime 推送增量更新
  在通知页面加载后重新校准（refetchUnreadCount）
```

## 关键架构决策

### 1. 状态管理

不用 Redux/Zustand，用 React Context + `useState` + `useCallback`。全局状态集中在 `hooks/useAppState.ts` 一个 hook 里导出。

### 2. 离线模式

没配 Supabase 时完全跑在浏览器 `localStorage` 里：
- 用户数据存 `localStorage`
- 照片存 `localStorage`（data URL，有 5MB 限制）
- `isSupabaseEnabled()` 检测

### 3. 双存储后端

照片存储可切换：
- `VITE_USE_R2=true` → Cloudflare R2（通过 Worker API）
- 不设 → Supabase Storage

### 4. RLS 策略

因为是演示模式（无 Supabase Auth），所有数据库写操作通过 `security definer` 的 PostgreSQL 函数（RPC）代理，在函数内部校验 `profile_id` 归属，绕过 RLS 但保留权限检查。

已建的 RPC：
- `delete_own_photo(photo_id uuid, profile_id text)` — 删单张照片
- `delete_own_post(post_id uuid, profile_id text)` — 删作品下所有照片

### 5. 域名 + 部署

- 源码托管：GitHub（Vickykykykykykyky/Yabu）
- 自动构建：Cloudflare Pages 连接 GitHub，push 后自动部署
- 自定义域名：绑定在 Cloudflare Pages 上（腾讯云注册）
- 数据库：Supabase 项目 `pmajmgryddjdgstpfcfn`

## 环境变量（.env.local）

```env
VITE_SUPABASE_URL=https://pmajmgryddjdgstpfcfn.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_79EA0ZPrGuZRJpSf-raCIg_0nAWWINV
VITE_USE_R2=true
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite（端口 5173，热更新） |
| `npx wrangler dev --remote` | 启动 Worker + R2（端口 8787） |
| `npm run build` | TypeScript 检查 + Vite 构建到 `dist/` |
| `npm run dev:all` | 同时启动 Vite + Worker |
| `npx wrangler deploy` | 部署 Worker + 静态资源到 Cloudflare |

## 数据库表

| 表 | 用途 | 行级安全 |
|----|------|---------|
| `profiles` | 用户资料 | 启用 |
| `photos` | 照片（每行一张） | 启用 |
| `posts` | 帖子分组 | 启用 |
| `post_images` | 帖子内图片关联（已弃用，用 photos.post_id） | 启用 |
| `follows` | 关注关系 | 启用 |
| `likes` | 点赞 | 启用 |
| `favorites` | 收藏 | 启用 |
| `notifications` | 通知 | 启用 |
| `chat_rooms` | 聊天室 | 启用 |
| `messages` | 聊天消息 | 启用 |

## 本地开发流程

```
终端 1: npx wrangler dev --remote    （连真实 R2）
终端 2: npm run dev                   （Vite 热更新）
浏览器: http://localhost:5173/        （/api 自动代理到 wrangler）
```
