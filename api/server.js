import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '.env') })

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET = process.env.R2_BUCKET
const PUBLIC_BASE = process.env.R2_PUBLIC_URL || `https://pub-${ACCOUNT_ID}.r2.dev`
const PORT = process.env.PORT || 8787

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
})

function parseJSON(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { resolve(null) }
    })
  })
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let boundary
    const ct = req.headers['content-type'] || ''
    const m = ct.match(/boundary=(.+)/)
    if (m) boundary = m[1]
    if (!boundary) return reject(new Error('No boundary'))

    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => {
      const buf = Buffer.concat(chunks)
      const str = buf.toString('binary')
      const parts = str.split(`--${boundary}`)
      const result = { fields: {}, file: null, filename: '', contentType: '' }

      for (const part of parts) {
        if (part === '--\r\n' || part === '--' || part.trim() === '') continue
        const headerEnd = part.indexOf('\r\n\r\n')
        if (headerEnd === -1) continue
        const header = part.slice(0, headerEnd)
        const body = part.slice(headerEnd + 4)
        const bodyEnd = body.lastIndexOf('\r\n')
        const content = bodyEnd > 0 ? body.slice(0, bodyEnd) : body

        const nameMatch = header.match(/name="([^"]+)"/)
        const filenameMatch = header.match(/filename="([^"]+)"/)
        const ctMatch = header.match(/Content-Type:\s*(.+)/i)

        if (filenameMatch) {
          result.filename = filenameMatch[1]
          result.contentType = ctMatch?.[1]?.trim() || 'application/octet-stream'
          result.file = Buffer.from(content, 'binary')
        } else if (nameMatch) {
          result.fields[nameMatch[1]] = content.trim()
        }
      }
      resolve(result)
    })
  })
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

async function handleList(userId) {
  const prefix = `${userId}/`
  const cmd = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  const result = await s3.send(cmd)
  const photos = (result.Contents || []).map((obj) => ({
    key: obj.Key,
    url: `${PUBLIC_BASE}/${obj.Key}`,
  }))
  return { photos }
}

async function handleUpload(userId, file, filename, contentType) {
  const key = `${userId}/${Date.now()}-${filename || 'photo.jpg'}`
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
  })
  await s3.send(cmd)
  return {
    key,
    url: `${PUBLIC_BASE}/${key}`,
  }
}

function keyFromDeletePayload(userId, payload) {
  const rawKey = typeof payload?.key === 'string' ? payload.key.trim() : ''
  if (rawKey && rawKey.startsWith(`${userId}/`)) return rawKey

  const rawUrl = typeof payload?.url === 'string' ? payload.url.trim() : ''
  if (!rawUrl) return ''

  try {
    const parsed = new URL(rawUrl)
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
    return key.startsWith(`${userId}/`) ? key : ''
  } catch {
    return ''
  }
}

async function handleDelete(userId, payload) {
  const key = keyFromDeletePayload(userId, payload)
  if (!key) {
    return { ok: false, error: 'Invalid photo key' }
  }

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  return { ok: true, key }
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJSON(res, 200, { ok: true })
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname

  try {
    if (req.method === 'GET' && path === '/api/health') {
      return sendJSON(res, 200, { ok: true })
    }

    const userMatch = path.match(/^\/api\/users\/([^/]+)\/photos$/)
    if (userMatch) {
      const userId = decodeURIComponent(userMatch[1])

      if (req.method === 'GET') {
        const data = await handleList(userId)
        return sendJSON(res, 200, data)
      }

      if (req.method === 'POST') {
        const parsed = await parseMultipart(req)
        if (!parsed.file) {
          return sendJSON(res, 400, { error: 'No file' })
        }
        const data = await handleUpload(userId, parsed.file, parsed.filename, parsed.contentType)
        return sendJSON(res, 201, data)
      }

      if (req.method === 'DELETE') {
        const payload = await parseJSON(req)
        const data = await handleDelete(userId, payload)
        return sendJSON(res, data.ok ? 200 : 400, data)
      }
    }

    sendJSON(res, 404, { error: 'Not found' })
  } catch (err) {
    console.error(err)
    sendJSON(res, 500, { error: err.message })
  }
}).listen(PORT, () => {
  console.log(`R2 API running on http://localhost:${PORT}`)
})
