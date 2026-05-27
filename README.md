# Yabu

照片分享首页：三栏用户墙 + 右侧导航。默认 **Supabase Database + Supabase Storage**，可选 Cloudflare R2。

## Supabase（推荐：用户资料 + 照片存 Storage）

项目已指向 [pmajmgryddjdgstpfcfn](https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn)。

1. [Settings → API](https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn/settings/api) 复制 **Publishable / anon** 到 `.env.local`（`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`）
2. [SQL Editor](https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn/sql/new) 运行 **`supabase/setup-all.sql`** 一次即可（内含表、`yabu-photos` 桶与策略，包含多图帖子 `posts/post_images` 与关注 `follows`）。若你之前已跑过旧版 SQL，可只补跑 **`supabase/setup-posts.sql`**（补齐帖子/关注表）或 **`supabase/setup-storage.sql`**（仅补桶与策略）。
3. **不要**在 `.env.local` 开启 `VITE_USE_R2`（或注释掉该行）
4. `npm run dev` 重启，点 **+** 上传；图片在 Dashboard **Storage → yabu-photos**，公开 URL 会写入 `photos` 表，页面用 `<img src="...">` 显示。

或：`VITE_SUPABASE_ANON_KEY=... npm run setup:supabase`（仍需在网页里跑一次 `setup-storage.sql`）

管理员与迁移说明见 **[docs/SUPABASE.md](docs/SUPABASE.md)**（含多图帖子迁移指南 `docs/POSTS_MIGRATION.md`）。

## 本地开发（仅前端 → Supabase Storage）

```bash
npm install
npm run dev
```

打开 http://localhost:5173。未配置 Supabase 时照片在浏览器 `localStorage`；配置后走数据库 + Storage。

## 可选：Supabase + Cloudflare R2

用户资料仍在 **Supabase**，图片文件放 **R2**：`.env.local` 加 `VITE_USE_R2=true`，`npm run dev:all`。需先在 Cloudflare 开通 R2（否则 API 报错 `10042`）。不必跑 `setup-storage.sql`。

### 1. 登录 Cloudflare

```bash
npx wrangler login
```

### 2. 创建 R2 存储桶（只需一次）

```bash
npx wrangler r2 bucket create yabu-photos
npx wrangler r2 bucket create yabu-photos-preview
```

`preview` 桶用于本地 `wrangler dev` 模拟。

### 3. 开启 R2 模式

```bash
cp .env.example .env.local
```

确认 `.env.local` 中有：

```
VITE_USE_R2=true
```

### 4. 同时启动 API 与前端

**终端 A** — Worker + R2（端口 8787）：

```bash
npm run dev:api
```

**终端 B** — Vite 前端（会把 `/api` 代理到 Worker）：

```bash
npm run dev
```

或一条命令：

```bash
npm run dev:all
```

### 5. 验证

浏览器访问 http://localhost:5173/api/health ，应返回 `{"ok":true,"storage":"r2"}`。

上传照片会进入本地模拟 R2（数据在 `.wrangler/` 目录，已 gitignore）。

## API 说明（Worker）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/users/:userId/photos` | 列出用户照片 |
| POST | `/api/users/:userId/photos` | 上传（`multipart/form-data` 字段 `file`） |
| GET | `/api/photos/:key` | 读取图片 |

## 部署

- **前端静态站**：`npm run build` → Cloudflare Pages，`dist` 目录
- **API + R2**：`npx wrangler deploy`（需先在 Dashboard 绑定 R2 bucket `PHOTOS`）

生产环境需在 Pages 项目里把 `/api/*` 路由到该 Worker，或使用同一域名的 Worker 路由。

## 技术栈

- React 19 + TypeScript + Vite 6
- Cloudflare Workers + R2 + Wrangler
