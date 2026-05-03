/** Normalize tags like the compose page: trim, lowercase, dedupe. */
export function tagsFromStrings(...parts: (string | string[] | undefined | null)[]): string[] {
  const out: string[] = []
  for (const p of parts) {
    if (p == null) continue
    if (Array.isArray(p)) {
      for (const s of p) {
        const t = String(s).trim().toLowerCase()
        if (t) out.push(t)
      }
    } else {
      const t = String(p).trim().toLowerCase()
      if (t) out.push(t)
    }
  }
  return [...new Set(out)]
}
