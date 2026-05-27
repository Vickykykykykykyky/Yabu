#!/usr/bin/env node
/**
 * 在远程 Supabase Postgres 上执行 SQL 文件
 *
 * 用法：
 *   SUPABASE_DB_PASSWORD=你的密码 npm run setup:db
 *
 * 或粘贴 Dashboard → Connect 里的 Session pooler 连接串：
 *   DATABASE_URL='postgresql://...' npm run setup:db
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lookup } from 'node:dns/promises'
import pg from 'pg'

const PROJECT_REF = 'pmajmgryddjdgstpfcfn'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SQL_FILES = [
  'supabase/enable-registration.sql',
  'supabase/setup-posts.sql',
]

const POOLER_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
]

function buildCandidates(password) {
  if (process.env.DATABASE_URL) return [{ label: 'DATABASE_URL', url: process.env.DATABASE_URL }]

  const enc = encodeURIComponent(password)
  const list = [
    {
      label: 'direct',
      url: `postgresql://postgres:${enc}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
    },
  ]
  for (const region of POOLER_REGIONS) {
    list.push({
      label: `pooler-session-${region}`,
      url: `postgresql://postgres.${PROJECT_REF}:${enc}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
    })
    list.push({
      label: `pooler-tx-${region}`,
      url: `postgresql://postgres.${PROJECT_REF}:${enc}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
    })
  }
  return list
}

async function warnIfProxyDns() {
  const host = `db.${PROJECT_REF}.supabase.co`
  try {
    const { address } = await lookup(host, { family: 4 })
    if (address.startsWith('198.18.')) {
      console.warn(
        '\n⚠ 检测到代理/VPN（Clash 等）劫持了数据库域名：',
        `${host} → ${address}`,
        '\n这会导致「Connection terminated unexpectedly」。',
        '\n请任选其一：',
        '  1) 暂时关闭系统代理 / TUN，再运行本命令',
        '  2) 在 Clash 规则里把 *.supabase.co 设为 DIRECT',
        '  3) 改用浏览器打开 SQL Editor 粘贴 supabase/enable-registration.sql（推荐）',
        '\n  https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new\n',
      )
      return true
    }
  } catch {
    // ignore
  }
  return false
}

async function connectWithFallback(password) {
  const candidates = buildCandidates(password)
  let lastErr = null

  for (const { label, url } of candidates) {
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12_000,
    })
    try {
      await client.connect()
      await client.query('select 1')
      console.log('已连接（', label, '）')
      return client
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      if (!/Tenant|ENOTFOUND/i.test(msg)) {
        console.log('  尝试', label, '… 失败:', msg)
      }
      try {
        await client.end()
      } catch {
        // ignore
      }
    }
  }

  throw lastErr ?? new Error('无法连接数据库')
}

function printConnectHelp() {
  console.error(
    '\n无法自动猜到你的数据库区域（pooler 地址因项目而异）。',
    '\n请从 Supabase 复制**完整连接串**再运行：',
    '\n  1. 打开 https://supabase.com/dashboard/project/' +
      PROJECT_REF +
      '/settings/database',
    '\n  2. 点 Connect → 选 Session pooler（或 Direct connection）',
    '\n  3. 复制 URI，把 [YOUR-PASSWORD] 换成数据库密码',
    '\n  4. 运行：',
    "\n     DATABASE_URL='postgresql://...' npm run setup:db",
    '\n\n更简单：在 SQL Editor 粘贴 supabase/enable-registration.sql 并 Run（无需终端）。',
    '\n  https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new',
  )
}

async function runFile(client, relPath) {
  const path = join(root, relPath)
  const sql = readFileSync(path, 'utf8')
  console.log(`\n▶ 执行 ${relPath} …`)
  await client.query(sql)
  console.log(`✓ ${relPath}`)
}

async function verify(client) {
  const { rows: fn } = await client.query(`
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'register_profile'
  `)
  console.log(fn.length ? '✓ register_profile 函数已存在' : '✗ register_profile 未创建')

  const { rows: policies } = await client.query(`
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_anon'
  `)
  console.log(
    policies.length ? '✓ profiles_insert_anon 策略已存在' : '✗ profiles 插入策略缺失',
  )
}

async function main() {
  const password = process.env.SUPABASE_DB_PASSWORD
  if (!password && !process.env.DATABASE_URL) {
    console.error(
      '缺少连接信息。请设置：\n' +
        '  SUPABASE_DB_PASSWORD=你的密码 npm run setup:db\n\n' +
        '或从 Dashboard → Connect 复制 Session pooler 连接串：\n' +
        "  DATABASE_URL='postgresql://...' npm run setup:db",
    )
    process.exit(1)
  }

  await warnIfProxyDns()

  const client = await connectWithFallback(password ?? '')
  console.log('项目', PROJECT_REF)

  try {
    for (const file of SQL_FILES) {
      await runFile(client, file)
    }
    await verify(client)
    console.log('\n完成。请刷新网站后再试注册。')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('\n失败:', msg)
  if (/Tenant|ENOTFOUND|tenant\/user/i.test(msg)) {
    printConnectHelp()
  } else if (/terminated unexpectedly|ECONNRESET|TLS/i.test(msg)) {
    console.error(
      '\n若你使用 Clash / VPN：请先关闭代理，或在 Supabase 网页 SQL Editor 运行 supabase/enable-registration.sql',
    )
  }
  process.exit(1)
})
