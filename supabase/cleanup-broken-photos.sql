-- 清除数据库中被截断的 base64 图片记录
delete from public.photos where url like 'data:%';
