/**
 * jsdom does not ship the WHATWG fetch primitives that Next.js route handlers
 * rely on, so pull them in from undici when they are missing.
 *
 * API route tests run in the `node` environment (see the `@jest-environment`
 * docblock in those files) where Node already provides everything, and this
 * file is a no-op.
 */
import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web'
import { TextDecoder, TextEncoder } from 'node:util'

const globals = globalThis as unknown as Record<string, unknown>

globals.TextEncoder ??= TextEncoder
globals.TextDecoder ??= TextDecoder

// undici builds on these, and jsdom exposes none of them.
//
// MessageChannel is deliberately left alone: React's scheduler would pick up a
// worker_threads port and keep the Jest process alive after the tests finish.
globals.ReadableStream ??= ReadableStream
globals.WritableStream ??= WritableStream
globals.TransformStream ??= TransformStream

const needsFetchPrimitives =
  typeof globals.Request === 'undefined' ||
  typeof globals.Response === 'undefined' ||
  typeof (globals.Response as { json?: unknown })?.json === 'undefined' ||
  typeof globals.FormData === 'undefined' ||
  typeof globals.File === 'undefined'

if (needsFetchPrimitives) {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const undici = require('undici')
  globals.fetch = undici.fetch
  globals.Request = undici.Request
  globals.Response = undici.Response
  globals.Headers = undici.Headers
  globals.FormData = undici.FormData
  globals.File = undici.File
  globals.Blob = undici.Blob
}

globals.structuredClone ??= (value: unknown) => JSON.parse(JSON.stringify(value))
