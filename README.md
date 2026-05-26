# Yabu

照片分享首页：三栏用户墙 + 右侧导航。支持本地存储或 Cloudflare R2。

## Supabase（用户 / 管理员）

项目已指向 [pmajmgryddjdgstpfcfn](https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn)。

**还需你完成一步（我无法代你登录 Dashboard）：**

1. [Settings → API](https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn/settings/api) 复制 **anon public**，粘贴到 `.env.local` 里替换 `PASTE_ANON_KEY_HERE`
2. [SQL Editor](https://supabase.com/dashboard/project/pmajmgryddjdgstpfcfn/sql/new) 运行 `supabase/setup-all.sql`，再运行 **`supabase/setup-storage.sql`**（照片文件存 Storage）
3. `npm run dev` 重启

或：`VITE_SUPABASE_ANON_KEY=eyJ... npm run setup:supabase`（可选加 `SUPABASE_DB_PASSWORD` 自动 psql 建表）

管理员与迁移说明见 **[docs/SUPABASE.md](docs/SUPABASE.md)**。

## 本地开发（仅前端）

```bash
npm install
npm run dev
```

打开 http://localhost:5173。照片默认存在浏览器 `localStorage`。

## Supabase + R2 一起用（推荐）

用户资料在 **Supabase**，**照片文件在 R2**：

`.env.local` 同时保留 Supabase 变量，并加上：

```
VITE_USE_R2=true
```

然后：

```bash
npm run dev:all
```

上传走 R2；`photos` 表里只存 `/api/photos/...` 链接。不必再跑 `setup-storage.sql`。

## 本地开发 + Cloudflare R2

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
