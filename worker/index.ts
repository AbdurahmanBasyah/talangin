// Worker entry for Cloudflare Workers with static assets: /api/ocr runs the receipt reader, everything else is the built site in dist/.
import { onRequestPost } from '../functions/api/ocr'

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === '/api/ocr') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
      return onRequestPost({ request, env })
    }
    return env.ASSETS.fetch(request)
  },
}
