export type Job =
  | { status: 'processing' }
  | { status: 'done'; buffer: ArrayBuffer; contentType: string; filename: string }
  | { status: 'error'; message: string }

interface JobEntry {
  job: Job
  createdAt: number
}

const jobs = new Map<string, JobEntry>()

/** Remove jobs older than 1 hour to avoid unbounded memory growth. */
function cleanup() {
  const now = Date.now()
  for (const [id, entry] of jobs) {
    if (now - entry.createdAt > 60 * 60 * 1000) {
      jobs.delete(id)
    }
  }
}

export function createJob(id: string): void {
  cleanup()
  jobs.set(id, { job: { status: 'processing' }, createdAt: Date.now() })
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id)?.job
}

export function completeJob(
  id: string,
  buffer: ArrayBuffer,
  contentType: string,
  filename: string,
): void {
  const entry = jobs.get(id)
  if (entry) {
    entry.job = { status: 'done', buffer, contentType, filename }
  }
}

export function failJob(id: string, message: string): void {
  const entry = jobs.get(id)
  if (entry) {
    entry.job = { status: 'error', message }
  }
}
