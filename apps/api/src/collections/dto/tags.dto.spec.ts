/**
 * Accept/reject specs for the tags body DTO.
 *
 * @module collections/dto/tags.dto.spec
 */
import { TagsSchema } from './tags.dto.js'

describe('TagsSchema', () => {
  it('accepts one or more non-empty tags', () => {
    /* Accept: at least one non-empty string member. */
    expect(TagsSchema.parse({ tags: ['new', 'sale'] })).toEqual({ tags: ['new', 'sale'] })
  })

  it('rejects an empty tag array', () => {
    /* Reject: the array min(1) bound requires at least one tag. */
    expect(TagsSchema.safeParse({ tags: [] }).success).toBe(false)
  })

  it('rejects an empty-string tag member', () => {
    /* Reject: each member must be a non-empty string (min(1)). */
    expect(TagsSchema.safeParse({ tags: [''] }).success).toBe(false)
  })
})
