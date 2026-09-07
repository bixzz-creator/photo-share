import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinEntry } from '@/components/gallery/PinEntry'

function digitInputs() {
  return screen.getAllByRole('textbox') as HTMLInputElement[]
}

describe('PinEntry', () => {
  it('renders one input box per PIN digit', () => {
    render(<PinEntry onSubmit={jest.fn()} />)

    expect(digitInputs()).toHaveLength(6)
    expect(screen.getByLabelText('PIN digit 1')).toBeInTheDocument()
    expect(screen.getByLabelText('PIN digit 6')).toBeInTheDocument()
  })

  it('advances focus to the next box as digits are entered', async () => {
    const user = userEvent.setup()
    render(<PinEntry onSubmit={jest.fn()} showKeypad={false} />)
    const inputs = digitInputs()

    await user.click(inputs[0])
    await user.keyboard('1')
    expect(inputs[0]).toHaveValue('1')
    expect(inputs[1]).toHaveFocus()

    await user.keyboard('2')
    expect(inputs[1]).toHaveValue('2')
    expect(inputs[2]).toHaveFocus()
  })

  it('clears the previous box on backspace when the current one is empty', async () => {
    const user = userEvent.setup()
    render(<PinEntry onSubmit={jest.fn()} showKeypad={false} />)
    const inputs = digitInputs()

    await user.click(inputs[0])
    await user.keyboard('12')
    expect(inputs[2]).toHaveFocus()

    await user.keyboard('{Backspace}')
    expect(inputs[1]).toHaveValue('')
    expect(inputs[1]).toHaveFocus()

    // A second backspace clears the box that now holds focus.
    await user.keyboard('{Backspace}')
    expect(inputs[0]).toHaveValue('')
  })

  it('submits automatically once all six digits are entered', async () => {
    const onSubmit = jest.fn()
    const user = userEvent.setup()
    render(<PinEntry onSubmit={onSubmit} showKeypad={false} />)
    const inputs = digitInputs()

    await user.click(inputs[0])
    await user.keyboard('135790')

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('135790')
  })

  it('submits only once even if more keys are pressed', async () => {
    const onSubmit = jest.fn()
    const user = userEvent.setup()
    render(<PinEntry onSubmit={onSubmit} showKeypad={false} />)

    await user.click(digitInputs()[0])
    await user.keyboard('1234567')

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('ignores non numeric characters', async () => {
    const onSubmit = jest.fn()
    const user = userEvent.setup()
    render(<PinEntry onSubmit={onSubmit} showKeypad={false} />)
    const inputs = digitInputs()

    await user.click(inputs[0])
    await user.keyboard('a')

    expect(inputs[0]).toHaveValue('')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the error, clears the boxes and refocuses the first one', async () => {
    const { rerender } = render(<PinEntry onSubmit={jest.fn()} showKeypad={false} />)
    const user = userEvent.setup()

    await user.click(digitInputs()[0])
    await user.keyboard('111')

    rerender(<PinEntry onSubmit={jest.fn()} showKeypad={false} error="Incorrect PIN." />)

    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect PIN.')
    digitInputs().forEach((input) => expect(input).toHaveValue(''))
    expect(digitInputs()[0]).toHaveFocus()
  })

  it('fills digits from the on-screen keypad', async () => {
    const onSubmit = jest.fn()
    const user = userEvent.setup()
    render(<PinEntry onSubmit={onSubmit} />)

    for (const digit of ['1', '2', '3', '4', '5']) {
      await user.click(screen.getByRole('button', { name: digit }))
    }
    await user.click(screen.getByRole('button', { name: '0' }))

    expect(onSubmit).toHaveBeenCalledWith('123450')
  })
})
