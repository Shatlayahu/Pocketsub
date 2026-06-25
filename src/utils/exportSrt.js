function buildContent(line, mode) {
  const translation = line.translation.trim()

  if (mode === 'bilingual') {
    return [line.original, translation || line.original].filter(Boolean).join('\n')
  }

  return translation || line.original
}

export function exportSrt(subtitles, mode = 'translation') {
  return subtitles
    .map((line) => {
      return `${line.index}\n${line.start} --> ${line.end}\n${buildContent(line, mode)}`
    })
    .join('\n\n')
}

export function downloadSrt(fileName, content) {
  const baseName = fileName.replace(/\.srt$/i, '')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `${baseName || 'pocketsub'}_translated.srt`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
