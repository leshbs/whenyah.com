import { describe, expect, it } from 'vitest'
import { describeRpcError } from '../../src/features/rally/rally.errors'

describe('describeRpcError', () => {
  it('translates known database errors to Indonesian', () => {
    expect(describeRpcError('result already recorded for this team, position and round')).toContain('sudah tercatat')
    expect(describeRpcError('round is not active')).toContain('Ronde')
    expect(describeRpcError('not allowed')).toContain('izin')
  })

  it('falls back to a generic message', () => {
    expect(describeRpcError(undefined)).toContain('Gagal menyimpan')
    expect(describeRpcError('something unexpected')).toContain('Gagal menyimpan')
  })
})
