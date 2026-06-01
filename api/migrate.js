import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '.env') })

const SUPABASE_URL = 'https://pmajmgryddjdgstpfcfn.supabase.co'
const SUPABASE_KEY = 'sb_publishable_79EA0ZPrGuZRJpSf-raCIg_0nAWWINV'

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET = process.env.R2_BUCKET
const PUBLIC_BASE = process.env.R2_PUBLIC_URL || `https://pub-${ACCOUNT_ID}.r2.dev`

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
})

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`)
  const arrayBuffer = await res.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: res.headers.get('content-type') || 'image/jpeg',
  }
}

async function uploadR2(key, buffer, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))
  return `${PUBLIC_BASE}/${key}`
}

async function main() {
  console.log('开始迁移...')

  const { data: rows, error } = await supabase
    .from('photos')
    .select('id, url, profile_id')

  if (error) throw error
  console.log(`找到 ${rows.length} 张照片`)

  let migrated = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    // 跳过已经是 R2 的（包含 r2.dev）
    if (row.url.includes('r2.dev')) {
      skipped++
      continue
    }

    // 跳过 data: URL 和无效的
    if (row.url.startsWith('data:') || !row.url.startsWith('http')) {
      console.log(`  跳过: ${row.id} (非 HTTP URL)`)
      skipped++
      continue
    }

    try {
      console.log(`  下载: ${row.url.slice(0, 80)}...`)
      const { buffer, contentType } = await download(row.url)
      const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
      const key = `${row.profile_id}/${row.id}.${ext}`
      const newUrl = await uploadR2(key, buffer, contentType)

      const { error: updateErr } = await supabase
        .from('photos')
        .update({ url: newUrl })
        .eq('id', row.id)

      if (updateErr) {
        console.log(`  DB更新失败: ${row.id} - ${updateErr.message}`)
        failed++
      } else {
        console.log(`  ✅ ${newUrl}`)
        migrated++
      }
    } catch (err) {
      console.log(`  ❌ 失败: ${row.id} - ${err.message}`)
      failed++
    }
  }

  console.log(`\n迁移完成: ${migrated} 成功, ${skipped} 跳过, ${failed} 失败`)
}

main().catch(console.error)
