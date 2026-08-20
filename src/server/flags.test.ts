import { afterEach, describe, expect, it, vi } from 'vitest'

import { isArchitectureMapEnabled, isLoginAllowed } from './flags'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isLoginAllowed', () => {
  it('allows a login on the list and nobody else', () => {
    expect(isLoginAllowed('devtofunmi', 'devtofunmi,xt42io')).toBe(true)
    expect(isLoginAllowed('xt42io', 'devtofunmi,xt42io')).toBe(true)
    expect(isLoginAllowed('someone-else', 'devtofunmi,xt42io')).toBe(false)
  })

  it('compares case-insensitively, since GitHub logins are', () => {
    expect(isLoginAllowed('DevToFunmi', 'devtofunmi')).toBe(true)
    expect(isLoginAllowed('devtofunmi', 'DevToFunmi')).toBe(true)
  })

  it('tolerates spacing and empty entries in the list', () => {
    expect(isLoginAllowed('xt42io', ' devtofunmi , xt42io , ')).toBe(true)
  })

  it('denies a signed-out or nameless caller', () => {
    expect(isLoginAllowed(null, 'devtofunmi')).toBe(false)
    expect(isLoginAllowed(undefined, 'devtofunmi')).toBe(false)
    expect(isLoginAllowed('', 'devtofunmi')).toBe(false)
  })

  it('denies everyone when the list is empty', () => {
    expect(isLoginAllowed('devtofunmi', '')).toBe(false)
    expect(isLoginAllowed('devtofunmi', '  ,  ')).toBe(false)
  })

  it('opens the flag to everyone on the wildcard', () => {
    expect(isLoginAllowed('anyone-at-all', '*')).toBe(true)
    expect(isLoginAllowed('anyone-at-all', 'devtofunmi,*')).toBe(true)
    // Still not a way in for a signed-out caller by accident.
    expect(isLoginAllowed('someone-else', 'devtofunmi')).toBe(false)
  })
})

describe('isArchitectureMapEnabled', () => {
  it('defaults to the two accounts trialling the feature', () => {
    expect(isArchitectureMapEnabled('devtofunmi')).toBe(true)
    expect(isArchitectureMapEnabled('xt42io')).toBe(true)
    expect(isArchitectureMapEnabled('octocat')).toBe(false)
  })

  it('takes the list from the environment when one is set', () => {
    vi.stubEnv('ARCHITECTURE_MAP_LOGINS', 'octocat')

    expect(isArchitectureMapEnabled('octocat')).toBe(true)
    // The default no longer applies once the variable is set, so rolling the
    // trial forward cannot silently leave the original accounts enabled.
    expect(isArchitectureMapEnabled('devtofunmi')).toBe(false)
  })

  it('can be switched off entirely without a deploy', () => {
    vi.stubEnv('ARCHITECTURE_MAP_LOGINS', '')

    expect(isArchitectureMapEnabled('devtofunmi')).toBe(false)
  })
})
