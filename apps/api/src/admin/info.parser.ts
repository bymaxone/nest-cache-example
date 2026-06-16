/**
 * Redis INFO text parser.
 *
 * Layer: admin. Converts the raw multi-line string returned by
 * `CacheService.info()` into a structured nested record grouped by section.
 * Redis INFO format: `# SectionName\r\n` headers followed by
 * `field:value\r\n` lines; blank lines and pure comment lines are skipped.
 */

/**
 * Parses raw Redis INFO text into a nested record grouped by section.
 *
 * Section headers (lines starting with `# `) open a new section group. Each
 * `field:value` pair is stored under its section; the section name is
 * lower-cased for consistent key access regardless of Redis casing.
 *
 * @param raw - The raw string returned by `CacheService.info()`.
 * @returns A record of `sectionName → { fieldName: value }`.
 */
export function parseInfo(raw: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  let section = 'default'
  for (const line of raw.split('\r\n')) {
    if (!line || line.startsWith('#')) {
      if (line.startsWith('# ')) section = line.slice(2).trim().toLowerCase()
      continue
    }
    const idx = line.indexOf(':')
    if (idx === -1) continue
    ;(out[section] ??= {})[line.slice(0, idx)] = line.slice(idx + 1)
  }
  return out
}
