'use client'

import { useEffect, useRef, useState } from 'react'
import { Delete, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PIN_LENGTH } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface PinEntryProps {
  /** Number of digits. Defaults to the platform PIN length. */
  length?: number
  onSubmit: (pin: string) => void | Promise<void>
  disabled?: boolean
  /** Rendering an error shakes the boxes and clears them. */
  error?: string | null
  submitting?: boolean
  showKeypad?: boolean
}

export function PinEntry({
  length = PIN_LENGTH,
  onSubmit,
  disabled = false,
  error = null,
  submitting = false,
  showKeypad = true,
}: PinEntryProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''))
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const submittedRef = useRef(false)

  // A new error means the previous PIN was wrong: clear and start over.
  useEffect(() => {
    if (!error) return
    setDigits(Array(length).fill(''))
    submittedRef.current = false
    inputsRef.current[0]?.focus()
  }, [error, length])

  function focusInput(index: number) {
    inputsRef.current[Math.max(0, Math.min(length - 1, index))]?.focus()
  }

  function commit(next: string[]) {
    setDigits(next)

    const pin = next.join('')
    if (pin.length === length && !next.includes('') && !submittedRef.current) {
      submittedRef.current = true
      void onSubmit(pin)
    }
  }

  function handleChange(index: number, rawValue: string) {
    const value = rawValue.replace(/\D/g, '')
    if (value.length === 0) {
      const next = [...digits]
      next[index] = ''
      commit(next)
      return
    }

    // Handles both single keystrokes and pasted PINs.
    const next = [...digits]
    let cursor = index
    for (const digit of value) {
      if (cursor >= length) break
      next[cursor] = digit
      cursor += 1
    }
    commit(next)
    focusInput(cursor)
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const next = [...digits]

      if (next[index]) {
        next[index] = ''
        commit(next)
        return
      }
      if (index > 0) {
        next[index - 1] = ''
        commit(next)
        focusInput(index - 1)
      }
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusInput(index - 1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusInput(index + 1)
    }
  }

  function pressKey(digit: string) {
    const firstEmpty = digits.findIndex((value) => value === '')
    if (firstEmpty === -1) return
    handleChange(firstEmpty, digit)
  }

  function pressBackspace() {
    const lastFilled = [...digits].reduce(
      (found, value, index) => (value ? index : found),
      -1
    )
    if (lastFilled === -1) return
    const next = [...digits]
    next[lastFilled] = ''
    commit(next)
    focusInput(lastFilled)
  }

  const isLocked = disabled || submitting

  return (
    <div className="space-y-6">
      <div
        className={cn('flex justify-center gap-2 sm:gap-3', error && 'animate-shake')}
        data-testid="pin-entry"
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputsRef.current[index] = element
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={digit}
            disabled={isLocked}
            aria-label={`PIN digit ${index + 1}`}
            aria-invalid={Boolean(error)}
            data-testid={`pin-digit-${index}`}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onFocus={(event) => event.target.select()}
            className={cn(
              'h-14 w-11 rounded-lg border-2 bg-background text-center text-2xl font-semibold tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-ring sm:h-16 sm:w-14',
              error ? 'border-destructive' : 'border-input focus:border-primary',
              isLocked && 'opacity-60'
            )}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {submitting && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your PIN...
        </p>
      )}

      {showKeypad && (
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className="h-16 text-xl font-semibold"
              disabled={isLocked}
              onClick={() => pressKey(key)}
            >
              {key}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="h-16"
            disabled={isLocked}
            onClick={() => commit(Array(length).fill(''))}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-16 text-xl font-semibold"
            disabled={isLocked}
            onClick={() => pressKey('0')}
          >
            0
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-16"
            aria-label="Delete last digit"
            disabled={isLocked}
            onClick={pressBackspace}
          >
            <Delete className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  )
}
