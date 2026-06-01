-- 根据每张图的 profile_id 和 id 拼接 R2 URL
update public.photos
set url = 'https://pub-5d73bb1685ae49158796d22d2c9a9f6b.r2.dev/' || profile_id || '/' || id || '.jpg'
where url like '%supabase.co/storage/v1/object/%';

-- 验证：应全部显示 r2.dev
select id, url from public.photos limit 3;
