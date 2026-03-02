import { randomUUID } from 'crypto'
import { completeJob, createJob, failJob } from '@/lib/stt-store'

export async function POST(req: Request) {
  const apiEndpoint = process.env.STT_API_ENDPOINT

  if (!apiEndpoint) {
    return new Response('STT_API_ENDPOINT not configured', { status: 500 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const response_format = String(form.get('response_format') ?? 'text')

  if (!file) {
    return new Response('No file provided', { status: 400 })
  }

  const jobId = randomUUID()
  createJob(jobId)

  const originalName = file.name ?? 'upload.wav'
  const base = String(originalName).replace(/\.[^/.]+$/, '')
  const outFilename = `${base}.${response_format === 'text' ? 'txt' : response_format}`

  // Read file into memory now so it can be used after the response is sent
  const fileBuffer = await file.arrayBuffer()

  // Fire-and-forget: run the upstream STT call in the background
  ;(async () => {
    try {
      const outForm = new FormData()
      outForm.append('response_format', response_format)
      outForm.append('file', new Blob([fileBuffer], { type: file.type }), originalName)

      const controller = new AbortController()
      // keep at least 11 minutes to be safe
      const timeout = setTimeout(() => controller.abort(), 11 * 60 * 1000)

      const upstream = await fetch(apiEndpoint, {
        method: 'POST',
        body: outForm,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const ct = upstream.headers.get('content-type') ?? 'application/octet-stream'
      const buffer = await upstream.arrayBuffer()
      completeJob(jobId, buffer, ct, outFilename)
    } catch (err: unknown) {
      console.error('Error in STT background job:', err)
      const e = err as { name?: string; message?: string }
      failJob(
        jobId,
        e?.name === 'AbortError' ? 'Upstream request timed out' : (e?.message ?? 'Processing failed'),
      )
    }
  })()

  return Response.json({ job_id: jobId, status: 'processing' })
}
