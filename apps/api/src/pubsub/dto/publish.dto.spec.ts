/**
 * Accept/reject specs for the publish body DTO.
 *
 * @module pubsub/dto/publish.dto.spec
 */
import { publishSchema } from './publish.dto.js'

describe('publishSchema', () => {
  it('accepts a non-empty channel with an arbitrary message', () => {
    /* Accept: channel non-empty; message is z.unknown() (any JSON value). */
    expect(publishSchema.parse({ channel: 'orders', message: { id: 1 } })).toEqual({
      channel: 'orders',
      message: { id: 1 },
    })
  })

  it('rejects an empty channel', () => {
    /* Reject: channel min(1). */
    expect(publishSchema.safeParse({ channel: '', message: 'x' }).success).toBe(false)
  })

  it('rejects a missing channel', () => {
    /* Reject: channel is required even though message is unknown/optional. */
    expect(publishSchema.safeParse({ message: 'x' }).success).toBe(false)
  })
})
