export function getYouTubeId(value) {
  try {
    const url = new URL(value.trim())

    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace('/', '')
    }

    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/')[2]
      }

      if (url.pathname.startsWith('/embed/')) {
        return url.pathname.split('/')[2]
      }

      return url.searchParams.get('v')
    }
  } catch {
    return ''
  }

  return ''
}

export function buildYouTubeEmbedUrl(videoId, start = 0, end = 0, autoplay = false) {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    controls: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    start: String(Math.max(0, Math.floor(start))),
  })

  if (end > start) {
    params.set('end', String(Math.ceil(end)))
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}
