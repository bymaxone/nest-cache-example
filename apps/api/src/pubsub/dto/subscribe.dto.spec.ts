/**
 * Accept/reject specs for the subscribe body DTO.
 *
 * @module pubsub/dto/subscribe.dto.spec
 */
import { subscribeSchema } from './subscribe.dto.js'

describe('subscribeSchema', () => {
  it('defaults pattern to false when omitted', () => {
    /* Accept: channel only → pattern defaults to false (plain subscribe). */
    expect(subscribeSchema.parse({ channel: 'orders' })).toEqual({
      channel: 'orders',
      pattern: false,
    })
  })

  it('accepts an explicit pattern flag', () => {
    /* Accept: pattern true → psubscribe form. */
    expect(subscribeSchema.parse({ channel: 'product:*', pattern: true })).toEqual({
      channel: 'product:*',
      pattern: true,
    })
  })

  it('rejects an empty channel and a non-boolean pattern', () => {
    /* Reject: channel min(1); pattern must be a boolean (no coercion). */
    expect(subscribeSchema.safeParse({ channel: '' }).success).toBe(false)
    expect(subscribeSchema.safeParse({ channel: 'c', pattern: 'yes' }).success).toBe(false)
  })
})
