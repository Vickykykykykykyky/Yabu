# Supabase：用户与管理员

## 当前项目存哪儿？

| 数据 | 未配置 Supabase | 配置 Supabase 后 |
|------|-----------------|------------------|
| 三栏用户、昵称、头像 | 浏览器 localStorage | `profiles` 表 |
| 照片文件 | localStorage 或 Cloudflare R2 | R2/本地 URL 存在 `photos` 表 |
| 消息、通知 | localStorage | 仍 localStorage（可后续迁表） |
| 登录账号 | 无 | Supabase Auth `auth.users` |

**现在默认仍未连库**，要在 `.env.local` 里填 URL 和 anon key，并在 Supabase 执行 SQL。

---

## 一、创建 Supabase 项目

1. 打开 https://supabase.com/dashboard → **New project**
2. 记下 **Project URL** 和 **anon public** key（Settings → API）

```bash
cp .env.example .env.local
# 填入 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
```

重启 `npm run dev`。

---

## 二、建表（执行 migration）

Dashboard → **SQL Editor** → 新建查询，粘贴并运行：

`supabase/migrations/20250326000000_initial_schema.sql`

再运行种子数据：

`supabase/seed.sql`

再运行（**照片文件存 Storage，避免写入失败**）：

`supabase/setup-storage.sql`

会得到三条用户：`user-1` 小蓝、`user-2` 小橙、`user-3` 小绿。

---

## 三、管理员怎么存？

管理员 = `profiles` 表里 **`role = 'admin'`**，并绑定一个真实登录账号。

### 步骤

1. **Authentication** → **Users** → **Add user**  
   输入管理员邮箱和密码（或邀请链接）。

2. 复制该用户的 **User UID**（形如 `a1b2c3d4-...`）。

3. 在 SQL Editor 执行（把 UUID 换成你的）：

```sql
-- 新建管理员资料
insert into public.profiles (id, display_name, avatar_url, role, auth_user_id)
values ('admin-1', '管理员', '', 'admin', '粘贴-auth-users-的-uuid')
on conflict (id) do update set
  role = 'admin',
  auth_user_id = excluded.auth_user_id;

-- 或把已有 user-1 提升为管理员
update public.profiles
set role = 'admin', auth_user_id = '粘贴-auth-users-的-uuid'
where id = 'user-1';
```

4. 该用户用邮箱密码登录后，可按 RLS 修改任意 `profiles`、上传照片（需前端接 Supabase Auth，尚未实现登录页）。

### 普通用户

- **仅展示用**（首页三栏）：只存在于 `profiles`，`role = 'member'`，无需 `auth_user_id`。
- **可登录用户**：在 Auth 建用户 → `profiles` 里 `auth_user_id` 指向其 UUID，`role = 'member'`。

---

## 四、把浏览器里已有数据迁进 Supabase

1. 先完成 migration + seed。
2. 若照片在 R2：URL 已在 `photos` 表需手动插入，或重新上传一次（开启 Supabase + R2 后会自动 `insert`）。
3. 若只有 localStorage：在控制台执行  
   `JSON.parse(localStorage.getItem('yabu-app-state'))`  
   按 `users` 数组在 SQL 里 `insert into profiles` / `photos`。

---

## 五、表结构简图

```text
auth.users (Supabase 登录，可选)
    ↑ auth_user_id
profiles (id, display_name, avatar_url, role: member|admin)
    ↑ profile_id
photos (url 指向 R2 或 /api/photos/...)
```

---

## 六、本地验证

配置 `.env.local` 后刷新站点；若连接成功，首页用户来自数据库而非写死的默认值。

SQL 检查：

```sql
select id, display_name, role, auth_user_id from public.profiles;
select profile_id, url from public.photos;
```
