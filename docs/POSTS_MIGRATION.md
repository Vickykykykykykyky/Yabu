# 多图帖子迁移指南（`photos` → `posts` + `post_images`）

本项目早期用 `public.photos(profile_id, url, created_at)` 来存“用户的所有图片”。为了支持“一个帖子多张图 + 排序 + 后续扩展（文字、地点、点赞、评论）”，推荐迁移到：

- `public.posts(profile_id, created_at)`
- `public.post_images(post_id, url, sort_order, created_at)`

## 1) 现状：`photos` 表的定位

当前 `photos` 仍可保留，作为 **legacy 单图作品表**：

- 老数据不动，页面继续能显示。
- 新功能逐步切到 `posts/post_images`。

当你确认所有读写都切完，再考虑把 `photos` 迁走或下线。

## 2) 推荐的双轨过渡方式

### A. 读：同时读新旧表

按用户展示作品时：

1. 先查 `posts` → `post_images`（按 `posts.created_at desc`，同帖按 `sort_order asc, created_at asc`）。
2. 再查 `photos`（作为“无帖归属”的 legacy 数据）。

前端渲染时把 `photos` 视为“每张图都是一个单图帖子”即可。

### B. 写：新上传走新表

新上传时：

1. `insert into posts(profile_id)` 得到 `post_id`
2. 多张图分别 `insert into post_images(post_id, url, sort_order)`

删除时只删 `post_images`（若该 `post_id` 下已无图片，可选择同时删 `posts`）。

## 3) 一次性迁移 SQL（把旧 photos 变成单图帖子）

如果你想把历史 `photos` 一次性转成新结构（每张图一个帖子），可以用下面的思路：

> 注意：这是“数据迁移脚本”的草案，建议先在副本/测试库执行，并确认行数后再跑生产。

```sql
-- 1) 为每条 photos 创建对应 posts
with inserted_posts as (
  insert into public.posts (profile_id, created_at)
  select profile_id, created_at
  from public.photos
  returning id, profile_id, created_at
)
-- 2) 把 url 写入 post_images（每个帖子 1 张图）
insert into public.post_images (post_id, url, sort_order, created_at)
select p.id, ph.url, 0, ph.created_at
from inserted_posts p
join public.photos ph
  on ph.profile_id = p.profile_id and ph.created_at = p.created_at;
```

如果你担心 `created_at` 精度导致 join 不稳定，更稳妥的办法是：先给 `photos` 加一个临时迁移标识列，或者按 `photos.id` 显式映射。

## 4) 粉丝数（`follows`）

不要在 `profiles` 冗余存 `follower_count`。粉丝数应来自：

```sql
select count(*) from public.follows where followee_id = $1;
```

如果后续有性能压力，再考虑用物化视图或缓存字段 + 触发器维护。

