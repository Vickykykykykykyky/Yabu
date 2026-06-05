-- 清理无效/孤立照片记录（在 SQL Editor 运行一次）
-- 1) 删除截断的 base64 占位图
delete from public.photos where url like 'data:%';

-- 2) 删除没有对应 post 的空帖子（可选）
delete from public.posts p
where not exists (
  select 1 from public.photos ph where ph.post_id = p.id
);

-- 3) 刷新 API schema cache
notify pgrst, 'reload schema';
