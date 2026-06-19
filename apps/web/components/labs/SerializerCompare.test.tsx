/**
 * @fileoverview Unit tests for {@link SerializerCompare} — the raw-vs-decoded
 * serializer panel. Covers the codec label + byte-count header, the raw-string
 * column for a present value and the `null` (evicted) fallback, and that the
 * decoded value reaches the JSON tree.
 *
 * @module components/labs/SerializerCompare.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SerializerCompare } from './SerializerCompare'

describe('SerializerCompare', () => {
  it('renders the codec label, byte count, raw string, and decoded value', () => {
    /*
     * Scenario: a successful round-trip with a present raw string.
     * Rule it protects: the header shows the codec label and formatted byte count,
     * the raw column shows the exact stored string, and the decoded value renders.
     */
    render(
      <SerializerCompare codecLabel="json" raw='{"id":42}' decoded={{ id: 42 }} rawBytes={512} />,
    )
    expect(screen.getByText(/raw \(getRaw\) · json/)).toBeInTheDocument()
    expect(screen.getByText('512 B')).toBeInTheDocument()
    expect(screen.getByText('{"id":42}')).toBeInTheDocument()
    expect(screen.getByText('decoded (get)')).toBeInTheDocument()
    // The decoded object reaches the JSON tree (its `42` value is rendered).
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders the evicted fallback when raw is null', () => {
    /*
     * Scenario: the key was evicted before `getRaw` could read it.
     * Rule it protects: a `null` raw renders the `— (key evicted)` placeholder.
     */
    render(<SerializerCompare codecLabel="msgpack" raw={null} decoded={null} rawBytes={0} />)
    expect(screen.getByText('— (key evicted)')).toBeInTheDocument()
  })
})
