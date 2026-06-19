/**
 * Unit specs for the Redis INFO text parser.
 *
 * Drives a single crafted INFO payload that exercises every branch: section
 * headers, the default section, blank lines, non-`# ` comment lines, no-colon
 * lines, values containing colons, and the `??=` section-create-vs-reuse arms.
 *
 * @module admin/info.parser.spec
 */
import { parseInfo } from './info.parser.js'

describe('parseInfo', () => {
  it('groups field:value lines by lower-cased section, skipping noise', () => {
    /*
     * Scenario: an INFO payload that opens with a pre-header field (default
     * section), then a `# Server` header with two fields (??= create then reuse),
     * a blank line, a bare `#` comment (starts with '#' but not '# '), a no-colon
     * line, a value containing a colon, and a second `# Clients` section.
     * Rule it protects: headers open lower-cased section groups; the default
     * section captures pre-header fields; blank/comment/no-colon lines are skipped;
     * the colon split keeps everything after the FIRST colon as the value.
     */
    const raw = [
      'preheader:value0',
      '# Server',
      'redis_version:7.0.0',
      'uptime_in_seconds:12345',
      '',
      '#bare-comment',
      'garbage_without_colon',
      'config_file:',
      'key_with_colon:a:b:c',
      '# Clients',
      'connected_clients:3',
    ].join('\r\n')

    const parsed = parseInfo(raw)

    expect(parsed).toEqual({
      default: { preheader: 'value0' },
      server: {
        redis_version: '7.0.0',
        uptime_in_seconds: '12345',
        config_file: '',
        key_with_colon: 'a:b:c',
      },
      clients: { connected_clients: '3' },
    })
  })

  it('returns an empty record for input with no field lines', () => {
    /*
     * Scenario: only headers, blank lines and comments — no `field:value` pairs.
     * Rule it protects: when no line yields a colon, no section object is ever
     * created, so the result is an empty record (the `out[section] ??=` create arm
     * is never taken).
     */
    expect(parseInfo('# Server\r\n\r\n#comment\r\nno_colon_here')).toEqual({})
  })
})
