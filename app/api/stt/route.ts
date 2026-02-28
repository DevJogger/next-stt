export async function POST(req: Request) {
  const apiEndpoint = process.env.STT_API_ENDPOINT

  if (!apiEndpoint) {
    return new Response('STT_API_ENDPOINT not configured', { status: 500 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const response_format = String(form.get('response_format') ?? 'text')

    if (!file) {
      return new Response('No file provided', { status: 400 })
    }

    const outForm = new FormData()
    outForm.append('response_format', response_format)
    // append file (File from formData can be forwarded)
    outForm.append('file', file, file.name ?? 'upload.wav')

    const controller = new AbortController()
    // keep at least 11 minutes to be safe
    const timeout = setTimeout(() => controller.abort(), 11 * 60 * 1000)

    const upstream = await fetch(apiEndpoint, {
      method: 'POST',
      body: outForm,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const headers = new Headers()
    const ct = upstream.headers.get('content-type')
    if (ct) headers.set('Content-Type', ct)

    // prefer original uploaded filename (change extension to chosen response_format)
    const originalName = file?.name ?? 'upload.wav'
    const base = String(originalName).replace(/\.[^/.]+$/, '')
    const outFilename = `${base}.${response_format === 'text' ? 'txt' : response_format}`
    const cd = `attachment; filename="${outFilename}"`
    headers.set('Content-Disposition', cd)

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (err: unknown) {
    console.error('Error in STT proxy:', err)
    const e = err as { name?: string }
    if (e?.name === 'AbortError') {
      return new Response('Upstream request timed out', { status: 504 })
    }
    return new Response('Proxy error', { status: 500 })
  }
}
