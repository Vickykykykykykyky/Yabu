#!/usr/bin/env node
/**
 * 一键：写入 .env.local、在远程 Supabase 执行 migration + seed
 *
 * 用法（任选其一提供密钥）：
 *   VITE_SUPABASE_ANON_KEY=eyJ... node scripts/setup-supabase.mjs
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/setup-supabase.mjs
 *
 * 数据库密码（仅执行 SQL 时需要，Dashboard → Settings → Database）：
 *   SUPABASE_DB_PASSWORD=... node scripts/setup-supabase.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const PROJECT_REF = 'pmajmgryddjdgstpfcfn'
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.local')

const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  readEnvLocal('VITE_SUPABASE_ANON_KEY')

const dbPassword = process.env.SUPABASE_DB_PASSWORD

function readEnvLocal(key) {
  if (!existsSync(envPath)) return ''
  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`))
  return line ? line.slice(key.length + 1).trim() : ''
}

function writeEnvLocal() {
  if (!anonKey || anonKey.includes('你的')) {
    console.error('缺少 anon key。请设置环境变量 VITE_SUPABASE_ANON_KEY')
    console.error('或在 Dashboard → Settings → API 复制 anon public key')
    process.exit(1)
  }

  const lines = [
    '# 由 scripts/setup-supabase.mjs 生成',
    `VITE_SUPABASE_URL=${SUPABASE_URL}`,
    `VITE_SUPABASE_ANON_KEY=${anonKey}`,
    '',
  ]
  if (process.env.VITE_USE_R2 === 'true') {
    lines.splice(3, 0, 'VITE_USE_R2=true')
  }
  writeFileSync(envPath, lines.join('\n'))
  console.log('已写入', envPath)
}

async function runSqlViaRest() {
  // Supabase 不提供 REST 执行任意 SQL；需 db password + psql 或 CLI
  if (!dbPassword) {
    console.log('\n未设置 SUPABASE_DB_PASSWORD，跳过远程建表。')
    console.log('请在 Dashboard → SQL Editor 依次运行：')
    console.log('  supabase/migrations/20250326000000_initial_schema.sql')
    console.log('  supabase/migrations/20250326000001_anon_dev_writes.sql')
    console.log('  supabase/seed.sql')
    return false
  }

  const files = [
    'supabase/migrations/20250326000000_initial_schema.sql',
    'supabase/migrations/20250326000001_anon_dev_writes.sql',
    'supabase/seed.sql',
  ]

  const host = `db.${PROJECT_REF}.supabase.co`
  const conn = `postgresql://postgres:${encodeURIComponent(dbPassword)}@${host}:5432/postgres`

  for (const rel of files) {
    const path = join(root, rel)
    console.log('执行', rel, '...')
    try {
      execSync(`psql "${conn}" -v ON_ERROR_STOP=1 -f "${path}"`, {
        stdio: 'inherit',
        env: { ...process.env, PGSSLMODE: 'require' },
      })
    } catch {
      console.error('psql 失败。请确认已安装 psql 且数据库密码正确。')
      return false
    }
  }
  return true
}

async function verifyConnection() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,display_name&limit=5`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`REST ${res.status}: ${body}`)
  }
  const rows = await res.json()
  console.log('连接成功，profiles 行数:', rows.length, rows)
  return rows
}

async function main() {
  writeEnvLocal()
  await runSqlViaRest()
  try {
    await verifyConnection()
  } catch (err) {
    console.warn('验证失败（可能尚未建表）:', err.message)
  }
  console.log('\n下一步: npm run dev')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
