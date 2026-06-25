export function getProgress(subtitles) {
  const total = subtitles.length
  const done = subtitles.filter((line) => line.status === 'done').length
  const percent = total ? Math.round((done / total) * 100) : 0

  return { done, total, percent }
}
