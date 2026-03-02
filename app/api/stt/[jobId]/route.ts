import { getJob } from '@/lib/stt-store'

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const job = getJob(jobId)

  if (!job) {
    return Response.json({ status: 'not_found' }, { status: 404 })
  }

  if (job.status === 'processing') {
    return Response.json({ status: 'processing' })
  }

  if (job.status === 'error') {
    return Response.json({ status: 'error', message: job.message }, { status: 500 })
  }

  // done — stream the file back
  const headers = new Headers()
  headers.set('Content-Type', job.contentType)
  headers.set('Content-Disposition', `attachment; filename="${job.filename}"`)
  return new Response(new Blob([job.buffer], { type: job.contentType }), { status: 200, headers })
}
