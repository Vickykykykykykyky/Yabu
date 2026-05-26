interface Env {
  PHOTOS: R2Bucket
  ALLOWED_ORIGIN?: string
}

const corsHeaders = (origin: string | null, env: Env) => {
  const allowed = env.ALLOWED_ORIGIN ?? '*'
  const value =
    allowed === '*' ? '*' : origin && allowed.split(',').includes(origin) ? origin : allowed

  return {
    'Access-Control-Allow-Origin': value,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

function photoPrefix(userId: string) {
  return `photos/${userId}/`
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    try {
      if (url.pathname === '/api/health') {
        return json({ ok: true, storage: 'r2' }, 200, cors)
      }

      const listMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/photos$/)
      if (listMatch && request.method === 'GET') {
        const userId = decodeURIComponent(listMatch[1])
        const prefix = photoPrefix(userId)
        const listed = await env.PHOTOS.list({ prefix })

        const photos = listed.objects.map((obj) => ({
          key: obj.key,
          url: `/api/photos/${encodeURIComponent(obj.key)}`,
          uploaded: obj.uploaded?.toISOString(),
        }))

        return json({ photos }, 200, cors)
      }

      const uploadMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/photos$/)
      if (uploadMatch && request.method === 'POST') {
        const userId = decodeURIComponent(uploadMatch[1])
        const contentType = request.headers.get('Content-Type') ?? ''

        let body: ArrayBuffer
        let mime = 'image/jpeg'

        if (contentType.includes('multipart/form-data')) {
          const form = await request.formData()
          const file = form.get('file')
          if (!(file instanceof File)) {
            return json({ error: '缺少 file 字段' }, 400, cors)
          }
          body = await file.arrayBuffer()
          mime = file.type || mime
        } else {
          body = await request.arrayBuffer()
          mime = contentType || mime
        }

        if (body.byteLength === 0) {
          return json({ error: '空文件' }, 400, cors)
        }

        const key = `${photoPrefix(userId)}${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`
        await env.PHOTOS.put(key, body, {
          httpMetadata: { contentType: mime },
        })

        return json(
          {
            key,
            url: `/api/photos/${encodeURIComponent(key)}`,
          },
          201,
          cors,
        )
      }

      const getMatch = url.pathname.match(/^\/api\/photos\/(.+)$/)
      if (getMatch && request.method === 'GET') {
        const key = decodeURIComponent(getMatch[1])
        const object = await env.PHOTOS.get(key)
        if (!object) {
          return new Response('Not Found', { status: 404, headers: cors })
        }

        const headers = new Headers(cors)
        headers.set(
          'Content-Type',
          object.httpMetadata?.contentType ?? 'image/jpeg',
        )
        headers.set('Cache-Control', 'public, max-age=31536000, immutable')

        return new Response(object.body, { headers })
      }

      return json({ error: 'Not Found' }, 404, cors)
    } catch (err) {
      console.error(err)
      return json(
        { error: err instanceof Error ? err.message : '服务器错误' },
        500,
        cors,
      )
    }
  },
} satisfies ExportedHandler<Env>
