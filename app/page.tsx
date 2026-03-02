'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import React, { useCallback, useState } from 'react'

export default function Home() {
  const [format, setFormat] = useState('text')
  const [status, setStatus] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const acceptFile = useCallback((file: File) => {
    const name = file.name || ''
    return name.toLowerCase().endsWith('.wav')
  }, [])

  // When a file is provided (drop or input), just select it. Upload is started via Start button.
  const handleFile = useCallback(
    (file: File) => {
      if (!acceptFile(file)) {
        setStatus('Only .wav files are accepted')
        return
      }
      setSelectedFile(file)
      setStatus(`Selected: ${file.name}`)
    },
    [acceptFile]
  )

  const uploadFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        setStatus('No file selected')
        return
      }
      if (loading) return

      setLoading(true)
      setStatus('Uploading...')

      try {
        const form = new FormData()
        form.append('response_format', format)
        form.append('file', file, file.name)

        const res = await fetch('/api/stt', {
          method: 'POST',
          body: form,
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Server error: ${res.status} ${text}`)
        }

        const { job_id } = (await res.json()) as { job_id: string }

        setStatus('Processing (this may take several minutes)...')

        // Poll every 5 seconds until the job is done
        await new Promise<void>((resolve, reject) => {
          const poll = () => {
            fetch(`/api/stt/${job_id}`)
              .then(async (pollRes) => {
                const ct = pollRes.headers.get('content-type') ?? ''

                if (ct.includes('application/json')) {
                  const data = (await pollRes.json()) as { status: string; message?: string }

                  if (data.status === 'error') {
                    reject(new Error(data.message ?? 'Processing failed'))
                    return
                  }
                  if (data.status === 'not_found') {
                    reject(new Error('Job not found'))
                    return
                  }
                  // still processing — try again after 5 s
                  setTimeout(poll, 5000)
                } else {
                  // file response — trigger download
                  const blob = await pollRes.blob()

                  let filename = ''
                  const cd = pollRes.headers.get('content-disposition')
                  if (cd) {
                    const match =
                      /filename\*=UTF-8''(.+)$/.exec(cd) || /filename="?([^";]+)"?/.exec(cd)
                    if (match) filename = decodeURIComponent(match[1])
                  }
                  if (!filename) {
                    const base = file.name.replace(/\.[^/.]+$/, '')
                    filename = `${base}.${format === 'text' ? 'txt' : format}`
                  }

                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = filename
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)

                  resolve()
                }
              })
              .catch(reject)
          }
          poll()
        })

        setStatus('Download started')
      } catch (err: unknown) {
        setStatus(err instanceof Error ? err.message : String(err || 'Upload failed'))
      } finally {
        setLoading(false)
      }
    },
    [format, loading]
  )

  const onDrop: React.DragEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files && e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const onDragOver: React.DragEventHandler<HTMLDivElement> = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave: React.DragEventHandler<HTMLDivElement> = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const onFileInput: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      const f = e.target.files && e.target.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  return (
    <main className='flex min-h-screen flex-col gap-4 p-8'>
      <section className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <div>Output Format</div>
          <Select onValueChange={(value) => setFormat(value)} defaultValue={format}>
            <SelectTrigger className='w-24'>
              <SelectValue placeholder='Theme' />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value='text'>text</SelectItem>
                <SelectItem value='srt'>srt</SelectItem>
                <SelectItem value='json'>json</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className='flex items-center gap-2'>
          <span>{selectedFile ? selectedFile.name : 'No file selected'}</span>
          <Button
            className='cursor-pointer'
            onClick={() => uploadFile(selectedFile)}
            disabled={loading || !selectedFile}
          >
            {loading ? 'Processing...' : 'Start'}
          </Button>
        </div>
      </section>

      <section
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          'grid flex-1 place-items-center border-2 border-dashed p-4',
          dragOver && 'border-foreground/50'
        )}
      >
        <div className='flex flex-col items-start gap-4 md:flex-row md:items-center'>
          <p className='pl-2 whitespace-nowrap md:p-0'>Drop a .wav file here, or</p>
          <Input type='file' accept='audio/wav,.wav' onChange={onFileInput} disabled={loading} />
        </div>
      </section>

      <section>
        <strong>Status:</strong> {status ?? 'idle'}
      </section>
    </main>
  )
}
