import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const PLACEHOLDER_KEYS = new Set(['', 'PASTE_ANON_KEY_HERE', '你的anon公钥'])

export function isSupabaseEnabled() {
  return Boolean(
    url &&
      anonKey &&
      !PLACEHOLDER_KEYS.has(anonKey) &&
      !url.includes('你的项目'),
  )
}

let client: SupabaseClient | null = null

export function getSupabase() {
  if (!url || !anonKey) {
    throw new Error('未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  }
  if (!client) {
    client = createClient(url, anonKey)
  }
  return client
}
