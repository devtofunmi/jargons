// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { IssueFixPrButton } from './fix-pr-button'

// The button owns the only feedback the user gets when a fix PR can't be
// opened, so the cases worth pinning down are which outcomes surface a message
// and which stay silent.
afterEach(cleanup)

const clickOpen = () =>
  fireEvent.click(screen.getByRole('button', { name: /open fix pr/i }))

// The in-flight overlay carries role="status"; waiting for it to go away is how
// we know the action settled and the component is back to idle.
const settled = () =>
  waitFor(() => expect(screen.queryByRole('status')).toBeNull())

describe('IssueFixPrButton', () => {
  it('shows the reason when the action reports a failure', async () => {
    render(
      <IssueFixPrButton
        onOpen={async () => ({
          url: null,
          reason: 'Affected files could not be read.',
        })}
      />,
    )

    clickOpen()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Affected files could not be read.')
  })

  it('stays silent when the action redirects instead of returning a reason', async () => {
    // What the route does for `upgrade_required` and a used-up plan: it
    // navigates away, so a message here would just flash on the way out.
    render(<IssueFixPrButton onOpen={async () => ({ url: null })} />)

    clickOpen()
    await settled()

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a generic message when the action throws', async () => {
    render(
      <IssueFixPrButton
        onOpen={async () => {
          throw new Error('Unable to commit x (409): {"message":"raw detail"}')
        }}
      />,
    )

    clickOpen()

    const alert = await screen.findByRole('alert')
    // The thrown message must not reach the user — it can carry raw API bodies.
    expect(alert.textContent).toBe(
      'Could not open the fix PR. Please try again.',
    )
    expect(alert.textContent).not.toContain('409')
  })

  it('links to the pull request on success', async () => {
    render(
      <IssueFixPrButton
        onOpen={async () => ({ url: 'https://github.com/acme/web/pull/7' })}
      />,
    )

    clickOpen()

    const link = await screen.findByRole('link', { name: /view fix pr/i })
    expect(link.getAttribute('href')).toBe('https://github.com/acme/web/pull/7')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears a previous failure when a retry succeeds', async () => {
    let attempts = 0
    render(
      <IssueFixPrButton
        onOpen={async () => {
          attempts += 1
          return attempts === 1
            ? { url: null, reason: 'GitHub rejected the pull request.' }
            : { url: 'https://github.com/acme/web/pull/8' }
        }}
      />,
    )

    clickOpen()
    expect((await screen.findByRole('alert')).textContent).toBe(
      'GitHub rejected the pull request.',
    )

    clickOpen()
    await screen.findByRole('link', { name: /view fix pr/i })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(attempts).toBe(2)
  })
})
