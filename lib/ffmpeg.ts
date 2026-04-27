import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { extname } from 'path'
import ffmpegPath from 'ffmpeg-static'

const MAX_FILE_SIZE = 1_073_741_824 // 1 GB

export async function convertToWav(buffer: ArrayBuffer, originalName: string): Promise<ArrayBuffer> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error('File exceeds 1 GB limit')
  }

  const ext = extname(originalName) || '.bin'
  const id = randomUUID()
  const inputPath = `/tmp/${id}-input${ext}`
  const outputPath = `/tmp/${id}-output.wav`

  await fs.writeFile(inputPath, Buffer.from(buffer))

  try {
    await runFfmpeg(inputPath, outputPath)
    const data = await fs.readFile(outputPath)
    const result = new ArrayBuffer(data.byteLength)
    new Uint8Array(result).set(data)
    return result
  } finally {
    await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)])
  }
}

function runFfmpeg(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg binary not found'))
      return
    }
    const proc = spawn(ffmpegPath, ['-i', inputPath, '-ar', '16000', '-ac', '1', '-f', 'wav', outputPath])

    const stderr: string[] = []
    proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk.toString()))

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-5).join('')}`))
      }
    })

    proc.on('error', (err) => reject(err))
  })
}
