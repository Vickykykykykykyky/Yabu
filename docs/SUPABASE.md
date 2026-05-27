# Supabase：用户与管理员

## 当前项目存哪儿？

| 数据 | 未配置 Supabase | 配置 Supabase 后 |
|------|-----------------|------------------|
| 三栏用户、昵称、头像 | 浏览器 localStorage | `profiles` 表 |
| 照片文件 | localStorage | **Supabase Storage**（`yabu-photos` 桶）或可选 R2，URL 在 `photos` 表 |
| 多图帖子（新） | localStorage | `posts` + `post_images` 表 |
| 关注/粉丝（新） | 无 | `follows` 表（粉丝数实时统计） |
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

## 二、建表（执行 SQL）

Dashboard → **SQL Editor** → 新建查询，粘贴并运行（推荐一键全量）：

`supabase/setup-all.sql`

它会创建（含策略与 Storage 桶）：`profiles`、`photos`、`posts`、`post_images`、`follows`，并 seed 6 个用户。

如果你只想在已有库上补齐多图帖子与关注表，可运行：

`supabase/setup-posts.sql`

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
    ↑ profile_id                ↑ follower_id / followee_id
photos (legacy 单图作品)        follows (关注关系，用于粉丝数)

profiles ↑ profile_id
posts (一条帖子，可含多图)
    ↑ post_id
post_images (多张图片 + sort_order + created_at)
```

---

## 六、正式上线（切到 Supabase Auth）建议

当前项目的“只输入名字”属于演示模式，数据库无法识别“当前请求用户是谁”，因此 `setup-all.sql` / `setup-posts.sql` 里默认包含了 **anon 可写** 的 dev 策略（`*_anon_dev`）。

如果要上线（真正做到“只能改自己/删自己的作品/只能用自己的账号关注别人”）：

1. 启用 Supabase Auth（邮箱/手机/匿名等均可）。
2. `profiles.auth_user_id` 绑定到 `auth.users.id`。
3. 删除/禁用所有 `*_anon_dev` 策略。
4. 启用 `*_own`（authenticated）策略块（`setup-all.sql` 和 `setup-posts.sql` 都有模板）。

多图帖子从旧表迁移到新表的说明见：`docs/POSTS_MIGRATION.md`。

---

## 七、注册（名字唯一）

1. 前端打开 **注册** 页，输入未被占用的名字（2–24 字）。
2. 若连接 Supabase，会调用 `register_profile` RPC 写入 `profiles` 并返回 `id`。
3. 演示种子用户（小蓝、小橙…）只能 **登录**，不能重复注册。

若注册报权限或函数不存在，在 SQL Editor 依次运行：

- `supabase/auth-register.sql`
- `supabase/register-profile.sql`

---

## 八、本地验证

配置 `.env.local` 后刷新站点；若连接成功，首页用户来自数据库而非写死的默认值。

SQL 检查：

```sql
select id, display_name, role, auth_user_id from public.profiles;
select profile_id, url from public.photos;
```
