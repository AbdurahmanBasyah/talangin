// Cloudflare Pages Function: POST /api/ocr  { image: "data:image/jpeg;base64,..." }  ->  { text: "<receipt JSON from Gemini>" }
// The Gemini key stays on the server as the GEMINI_API_KEY secret, so visitors never log in to anything.

interface Env { GEMINI_API_KEY?: string; GEMINI_MODEL?: string }

const PROMPT = 'This is a photo of a receipt. Return ONLY valid JSON, no prose and no code fences, in this shape: {"items":[{"name":string,"qty":number,"price":number}],"subtotal":number,"tax":number,"service":number,"discount":number,"total":number}. "price" is the line total for that item in whole rupiah as an integer without separators. Use 0 for fields that are not on the receipt.'

// Short reason from Gemini (for example a quota message), so a failure can be diagnosed from the screen.
const why = async (res: Response) => {
  try { return String(((await res.json()) as { error?: { message?: string } }).error?.message || '').slice(0, 240) } catch { return '' }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  // Only accept calls made by this site's own pages.
  const origin = request.headers.get('Origin')
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Not allowed.' }, 403)
  if (!env.GEMINI_API_KEY) return json({ error: 'Receipt reading is not set up yet. You can type the items instead.' }, 500)

  let image = ''
  try { image = String(((await request.json()) as { image?: string }).image || '') } catch { /* handled below */ }
  const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (!m || m[2].length > 2_000_000) return json({ error: 'Send one JPEG, PNG or WebP image under about 1.5 MB.' }, 400)

  // GEMINI_MODEL can be one model or a comma-separated list; they are tried in order (at most three).
  const models = (env.GEMINI_MODEL || 'gemini-3.5-flash,gemini-3.5-flash-lite,gemini-2.5-flash').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)
  const body = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })

  let last: Response | null = null
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body,
    })
    if (res.ok) {
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''
      return json({ text, model })
    }
    last = res
    // Overloaded, rate limited or failing on Google's side: try the next model. A bad key or bad request will not improve.
    if (![429, 500, 503, 504].includes(res.status)) break
  }
  const busy = last !== null && [429, 503].includes(last.status)
  return json(
    { error: busy ? 'Receipt reading is busy right now. Try again in a minute, or type the items.' : 'Receipt reading failed. You can type the items instead.', detail: last ? await why(last) : '' },
    busy ? 503 : 502,
  )
}
