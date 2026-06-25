export function parseSrt(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

  if (!normalized) {
    return []
  }

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, position) => {
      const lines = block.split('\n').map((line) => line.trimEnd())
      const maybeIndex = Number.parseInt(lines[0], 10)
      const hasIndex = Number.isFinite(maybeIndex)
      const timeLine = hasIndex ? lines[1] : lines[0]
      const textLines = hasIndex ? lines.slice(2) : lines.slice(1)
      const match = timeLine?.match(
        /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/,
      )

      if (!match) {
        return null
      }

      const index = hasIndex ? maybeIndex : position + 1

      return {
        id: `line-${index}-${crypto.randomUUID()}`,
        index,
        start: match[1],
        end: match[2],
        original: textLines.join('\n').trim(),
        translation: '',
        status: 'todo',
      }
    })
    .filter(Boolean)
}
