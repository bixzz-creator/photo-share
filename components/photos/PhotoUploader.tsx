'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type FileRejection, useDropzone } from 'react-dropzone'
import { AlertCircle, CheckCircle2, RotateCcw, Trash2, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  DROPZONE_ACCEPT,
  MAX_FILES_PER_UPLOAD,
  MAX_FILE_SIZE,
} from '@/lib/constants'
import { cn, formatBytes } from '@/lib/utils'

type ItemStatus = 'pending' | 'uploading' | 'success' | 'error'

interface QueueItem {
  id: string
  file: File
  preview: string | null
  status: ItemStatus
  progress: number
  error?: string
}

interface PhotoUploaderProps {
  eventId: string
  onUploaded?: (count: number) => void
}

const REJECTION_MESSAGES: Record<string, string> = {
  'file-invalid-type': 'Only JPEG, PNG, WEBP and GIF images are allowed',
  'file-too-large': `Larger than the ${formatBytes(MAX_FILE_SIZE, 0)} limit`,
  'too-many-files': `You can add at most ${MAX_FILES_PER_UPLOAD} files at a time`,
}

function previewUrl(file: File): string | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  return URL.createObjectURL(file)
}

/** Reads intrinsic dimensions so they can be stored alongside the photo. */
function readDimensions(
  file: File
): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const url = previewUrl(file)
    if (!url || typeof Image === 'undefined') return resolve(undefined)

    const image = new Image()
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
      URL.revokeObjectURL(url)
    }
    image.onerror = () => {
      resolve(undefined)
      URL.revokeObjectURL(url)
    }
    image.src = url
  })
}

export function PhotoUploader({ eventId, onUploaded }: PhotoUploaderProps) {
  const router = useRouter()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [rejections, setRejections] = useState<FileRejection[]>([])
  const [uploading, setUploading] = useState(false)
  const previewsRef = useRef<string[]>([])

  useEffect(
    () => () => {
      previewsRef.current.forEach((url) => URL.revokeObjectURL(url))
    },
    []
  )

  const onDrop = useCallback((accepted: File[], fileRejections: FileRejection[]) => {
    setRejections(fileRejections)

    setQueue((current) => {
      const room = MAX_FILES_PER_UPLOAD - current.length
      const additions = accepted.slice(0, Math.max(0, room)).map((file, index) => {
        const preview = previewUrl(file)
        if (preview) previewsRef.current.push(preview)
        return {
          id: `${Date.now()}-${index}-${file.name}`,
          file,
          preview,
          status: 'pending' as ItemStatus,
          progress: 0,
        }
      })
      return [...current, ...additions]
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: DROPZONE_ACCEPT,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES_PER_UPLOAD,
    multiple: true,
  })

  function patchItem(id: string, changes: Partial<QueueItem>) {
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item))
    )
  }

  /** One request per file so each row can report its own progress. */
  function uploadItem(item: QueueItem): Promise<boolean> {
    return new Promise((resolve) => {
      readDimensions(item.file).then((dimensions) => {
        const formData = new FormData()
        formData.append('eventId', eventId)
        formData.append('files', item.file)
        if (dimensions) {
          formData.append('dimensions', JSON.stringify({ [item.file.name]: dimensions }))
        }

        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/photos')

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            patchItem(item.id, {
              status: 'uploading',
              progress: Math.round((event.loaded / event.total) * 100),
            })
          }
        }

        xhr.onload = () => {
          let payload: {
            results?: { success?: boolean; error?: string }[]
            error?: string
          } = {}
          try {
            payload = JSON.parse(xhr.responseText)
          } catch {
            payload = {}
          }

          const result = payload.results?.[0]
          if (xhr.status >= 200 && xhr.status < 300 && result?.success) {
            patchItem(item.id, { status: 'success', progress: 100, error: undefined })
            resolve(true)
            return
          }

          patchItem(item.id, {
            status: 'error',
            error: result?.error ?? payload.error ?? 'Upload failed',
          })
          resolve(false)
        }

        xhr.onerror = () => {
          patchItem(item.id, { status: 'error', error: 'Network error' })
          resolve(false)
        }

        patchItem(item.id, { status: 'uploading', progress: 0 })
        xhr.send(formData)
      })
    })
  }

  async function uploadAll() {
    const pending = queue.filter(
      (item) => item.status === 'pending' || item.status === 'error'
    )
    if (pending.length === 0) return

    setUploading(true)
    let uploaded = 0
    for (const item of pending) {
      if (await uploadItem(item)) uploaded += 1
    }
    setUploading(false)

    if (uploaded > 0) {
      toast.success(`${uploaded} photo${uploaded === 1 ? '' : 's'} uploaded`)
      onUploaded?.(uploaded)
      router.refresh()
    }
    if (uploaded < pending.length) {
      toast.error(`${pending.length - uploaded} upload(s) failed. You can retry them.`)
    }
  }

  const pendingCount = queue.filter((item) => item.status === 'pending').length
  const failedCount = queue.filter((item) => item.status === 'error').length

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        data-testid="dropzone"
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
        )}
      >
        <input {...getInputProps()} aria-label="Choose photos to upload" />
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drag photos here, or click to choose files
        </p>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WEBP or GIF · up to {formatBytes(MAX_FILE_SIZE, 0)} each · max{' '}
          {MAX_FILES_PER_UPLOAD} files
        </p>
      </div>

      {rejections.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="space-y-1">
              {rejections.map(({ file, errors }) => (
                <li key={file.name}>
                  <span className="font-medium">{file.name}</span>:{' '}
                  {errors
                    .map((error) => REJECTION_MESSAGES[error.code] ?? error.message)
                    .join(', ')}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {queue.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {queue.length} file{queue.length === 1 ? '' : 's'} in queue
              {failedCount > 0 && ` · ${failedCount} failed`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQueue((current) => current.filter((item) => item.status === 'success'))}
                disabled={uploading || pendingCount + failedCount === 0}
              >
                <Trash2 className="h-4 w-4" />
                Clear pending
              </Button>
              <Button
                size="sm"
                onClick={uploadAll}
                disabled={uploading || pendingCount + failedCount === 0}
              >
                {uploading
                  ? 'Uploading...'
                  : failedCount > 0 && pendingCount === 0
                    ? `Retry ${failedCount}`
                    : `Upload ${pendingCount + failedCount}`}
              </Button>
            </div>
          </div>

          <ul className="divide-y rounded-lg border" data-testid="upload-queue">
            {queue.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                {item.preview ? (
                  // Object URLs cannot be optimised by next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="h-14 w-14 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-muted text-[10px] uppercase text-muted-foreground">
                    {item.file.type.replace('image/', '') || 'file'}
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                    {item.status === 'success' && (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-emerald-600"
                        aria-label="Uploaded"
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(item.file.size)} ·{' '}
                    <span data-testid={`status-${item.file.name}`}>{item.status}</span>
                  </p>
                  {(item.status === 'uploading' || item.status === 'success') && (
                    <Progress value={item.progress} className="h-1.5" />
                  )}
                  {item.error && <p className="text-xs text-destructive">{item.error}</p>}
                </div>

                {item.status === 'error' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Retry ${item.file.name}`}
                    onClick={() => uploadItem(item)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                {item.status !== 'uploading' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() =>
                      setQueue((current) => current.filter((entry) => entry.id !== item.id))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
