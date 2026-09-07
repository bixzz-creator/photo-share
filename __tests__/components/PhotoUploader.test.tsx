import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhotoUploader } from '@/components/photos/PhotoUploader'
import { MAX_FILE_SIZE } from '@/lib/constants'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}))

const EVENT_ID = '11111111-1111-4111-8111-111111111111'

function imageFile(name: string, type: string, size = 1024) {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

/** react-dropzone reads files off the drop event's dataTransfer. */
function dropFiles(files: File[]) {
  fireEvent.drop(screen.getByTestId('dropzone'), {
    dataTransfer: {
      files,
      items: files.map((file) => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      })),
      types: ['Files'],
    },
  })
}

beforeAll(() => {
  // jsdom has no object URL support, which the previews rely on.
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: jest.fn(() => 'blob:preview'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: jest.fn() })
})

describe('PhotoUploader', () => {
  it('queues valid image files', async () => {
    render(<PhotoUploader eventId={EVENT_ID} />)

    dropFiles([imageFile('sunset.jpg', 'image/jpeg'), imageFile('cake.png', 'image/png')])

    await waitFor(() => {
      expect(screen.getByText('sunset.jpg')).toBeInTheDocument()
    })
    expect(screen.getByText('cake.png')).toBeInTheDocument()
    expect(screen.getByText('2 files in queue')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload 2/i })).toBeInTheDocument()
  })

  it('shows a preview thumbnail for each queued file', async () => {
    render(<PhotoUploader eventId={EVENT_ID} />)

    dropFiles([imageFile('sunset.jpg', 'image/jpeg')])

    const preview = await screen.findByAltText('sunset.jpg')
    expect(preview).toHaveAttribute('src', 'blob:preview')
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('rejects files that are not images', async () => {
    render(<PhotoUploader eventId={EVENT_ID} />)

    dropFiles([imageFile('notes.txt', 'text/plain')])

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /only jpeg, png, webp and gif images are allowed/i
      )
    })
    expect(screen.queryByTestId('upload-queue')).not.toBeInTheDocument()
  })

  it('rejects files over the 10MB limit', async () => {
    render(<PhotoUploader eventId={EVENT_ID} />)

    dropFiles([imageFile('huge.jpg', 'image/jpeg', MAX_FILE_SIZE + 1)])

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/larger than the 10 MB limit/i)
    })
    expect(screen.queryByTestId('upload-queue')).not.toBeInTheDocument()
  })

  it('keeps the valid files when a batch is partly rejected', async () => {
    render(<PhotoUploader eventId={EVENT_ID} />)

    dropFiles([imageFile('good.webp', 'image/webp'), imageFile('bad.pdf', 'application/pdf')])

    await waitFor(() => {
      expect(screen.getByText('good.webp')).toBeInTheDocument()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('bad.pdf')
    expect(screen.getByText('1 file in queue')).toBeInTheDocument()
  })

  it('removes a pending file from the queue', async () => {
    render(<PhotoUploader eventId={EVENT_ID} />)

    dropFiles([imageFile('sunset.jpg', 'image/jpeg')])
    const remove = await screen.findByRole('button', { name: 'Remove sunset.jpg' })

    fireEvent.click(remove)

    await waitFor(() => {
      expect(screen.queryByText('sunset.jpg')).not.toBeInTheDocument()
    })
  })

  it('states the accepted formats and limits up front', () => {
    render(<PhotoUploader eventId={EVENT_ID} />)

    expect(
      screen.getByText(/JPEG, PNG, WEBP or GIF · up to 10 MB each · max 50 files/i)
    ).toBeInTheDocument()
  })
})
