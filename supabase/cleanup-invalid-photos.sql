-- 删除无效测试数据（base64 全 A 等），在 SQL Editor 执行一次即可
delete from public.photos
where url like 'data:image/%'
  and (
    url like '%AAAAAAAAAAAAAAAA%'
    or length(url) < 500
  );
