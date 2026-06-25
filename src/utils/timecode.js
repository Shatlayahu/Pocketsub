export function parseSrtTime(value) {
  const match = value?.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/)

  if (!match) {
    return 0
  }

  const [, hours, minutes, seconds, milliseconds] = match

  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(milliseconds) / 1000
  )
}

function pad(value, size = 2) {
  return String(value).padStart(size, '0')
}

export function formatSrtTime(seconds) {
  const safeSeconds = Math.max(0, seconds)
  const totalMilliseconds = Math.round(safeSeconds * 1000)
  const milliseconds = totalMilliseconds % 1000
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60

  return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)},${pad(milliseconds, 3)}`
}

export function shiftSrtTime(value, deltaSeconds) {
  return formatSrtTime(parseSrtTime(value) + deltaSeconds)
}
