'use client'

import React, { useCallback, useState } from 'react'

export default function Home() {
  const [format, setFormat] = useState('srt')
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
      setStatus('Uploading and processing (this may take several minutes)...')

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

        const blob = await res.blob()

        // determine filename from response header or fallback to original name with new extension
        let filename = ''
        const cd = res.headers.get('content-disposition')
        if (cd) {
          const match = /filename\*=UTF-8''(.+)$/.exec(cd) || /filename="?([^";]+)"?/.exec(cd)
          if (match) filename = decodeURIComponent(match[1])
        }
        if (!filename) {
          const base = file.name.replace(/\.[^/.]+$/, '')
          filename = `${base}.${format === 'json' ? 'json' : 'srt'}`
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)

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
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Local STT (drag .wav here)</h1>

      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8 }}>Output format:</label>
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value='srt'>srt (default)</option>
          <option value='json'>json</option>
        </select>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        style={{
          border: '2px dashed #888',
          padding: 40,
          textAlign: 'center',
          background: dragOver ? '#f0f8ff' : 'transparent',
        }}
      >
        <p>Drop a .wav file here, or</p>
        <input type='file' accept='audio/wav,.wav' onChange={onFileInput} disabled={loading} />
        <p style={{ marginTop: 8, color: '#666' }}>Only .wav files are accepted.</p>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          className='cursor-pointer rounded border px-2'
          onClick={() => uploadFile(selectedFile)}
          disabled={loading || !selectedFile}
        >
          {loading ? 'Processing...' : 'Start'}
        </button>
        <span style={{ marginLeft: 12 }}>
          {selectedFile ? selectedFile.name : 'No file selected'}
        </span>
      </div>

      <div style={{ marginTop: 16 }}>
        <strong>Status:</strong> {status ?? 'idle'}
      </div>

      <div style={{ marginTop: 12, color: '#444' }}>
        <small>
          Note: STT can take many minutes; the server proxy keeps requests open for at least 10
          minutes.
        </small>
      </div>
    </main>
  )
}
