import { useEffect, useMemo, useRef, useState } from 'react'
import { Home, Pencil } from 'lucide-react'
import { getTranslator } from '../utils/i18n'
import { parseSrtTime } from '../utils/timecode'
import { buildYouTubeEmbedUrl, getYouTubeId } from '../utils/youtube'

function findLineIndexByTime(subtitles, currentTime) {
  return subtitles.findIndex((line) => {
    return currentTime >= parseSrtTime(line.start) && currentTime <= parseSrtTime(line.end)
  })
}

function OverviewPage({
  project,
  onHome,
  onBack,
  onAttachVideo,
  onAttachYouTubeVideo,
  onSelectLine,
  language = 'zh-CN',
}) {
  const t = getTranslator(language)
  const filters = [
    { value: 'all', label: t('all') },
    { value: 'todo', label: t('untranslated') },
    { value: 'done', label: t('translated') },
  ]
  const videoRef = useRef(null)
  const videoInputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [activeIndex, setActiveIndex] = useState(0)
  const [videoUrl, setVideoUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeError, setYoutubeError] = useState('')
  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState('')

  const activeLine = project.subtitles[activeIndex]
  const isYouTubeVideo = project.video?.source === 'youtube'
  const isFileVideo = Boolean(project.video?.blob)
  const hasPlayableVideo = isFileVideo || isYouTubeVideo

  useEffect(() => {
    if (!project.video?.blob) {
      setVideoUrl('')
      return undefined
    }

    const url = URL.createObjectURL(project.video.blob)
    setVideoUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [project.video?.blob])

  useEffect(() => {
    if (!isYouTubeVideo || !project.video?.videoId) {
      setYoutubeEmbedUrl('')
      return
    }

    setYoutubeEmbedUrl(buildYouTubeEmbedUrl(project.video.videoId, 0, 0, false))
  }, [isYouTubeVideo, project.video?.videoId])

  const lines = useMemo(() => {
    const value = query.trim().toLowerCase()

    return project.subtitles.filter((line) => {
      const matchesFilter = filter === 'all' || line.status === filter
      const matchesQuery =
        !value ||
        line.original.toLowerCase().includes(value) ||
        line.translation.toLowerCase().includes(value)

      return matchesFilter && matchesQuery
    })
  }, [filter, project.subtitles, query])

  async function handleVideoChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    await onAttachVideo(file)
  }

  async function handleYouTubeSubmit(event) {
    event.preventDefault()
    const videoId = getYouTubeId(youtubeUrl)

    if (!videoId) {
      setYoutubeError(t('invalidYoutube'))
      return
    }

    await onAttachYouTubeVideo({
      url: youtubeUrl.trim(),
      videoId,
      title: 'YouTube video',
    })

    setYoutubeUrl('')
    setYoutubeError('')
  }

  function handleTimeUpdate(event) {
    const index = findLineIndexByTime(project.subtitles, event.currentTarget.currentTime)

    if (index >= 0 && index !== activeIndex) {
      setActiveIndex(index)
    }
  }

  function jumpToLine(index) {
    const line = project.subtitles[index]

    if (!line) {
      return
    }

    const start = parseSrtTime(line.start)
    const end = parseSrtTime(line.end)

    setActiveIndex(index)

    if (isFileVideo && videoRef.current) {
      videoRef.current.currentTime = start
      videoRef.current.pause()
      return
    }

    if (isYouTubeVideo && project.video?.videoId) {
      setYoutubeEmbedUrl(buildYouTubeEmbedUrl(project.video.videoId, start, end, false))
    }
  }

  function openLineEditor(index) {
    jumpToLine(index)
    onSelectLine(index)
  }

  return (
    <main className={`page overview-page ${language === 'en' ? 'lang-en' : ''}`}>
      <header className="top-bar">
        <button type="button" className="nav-icon-button" aria-label={t('files')} onClick={onHome}>
          <Home size={19} strokeWidth={2.2} />
        </button>
        <div>
          <p className="eyebrow">{t('overview')}</p>
          <h1>{project.fileName}</h1>
        </div>
        <button type="button" className="nav-icon-button" aria-label={t('editSubtitles')} onClick={onBack}>
          <Pencil size={18} strokeWidth={2.2} />
        </button>
      </header>

      <section className={`overview-video ${hasPlayableVideo ? '' : 'empty'}`}>
        {isFileVideo ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
          />
        ) : isYouTubeVideo ? (
          <iframe
            title={project.video.name}
            src={youtubeEmbedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="overview-video__empty"
            onClick={() => videoInputRef.current?.click()}
          >
            <h2>{t('bindVideo')}</h2>
            <p>{t('bindVideoHelp')}</p>
          </button>
        )}

        <div className="current-caption">
          <span className="field-label">{t('currentSubtitle')}</span>
          <p>{activeLine?.translation || activeLine?.original || t('noSubtitle')}</p>
        </div>

        <div className="media-tools">
          <button type="button" className="primary" onClick={() => videoInputRef.current?.click()}>
            {hasPlayableVideo ? t('changeVideo') : t('uploadVideo')}
          </button>
          <form className="youtube-inline-form" onSubmit={handleYouTubeSubmit}>
            <input
              type="url"
              value={youtubeUrl}
              placeholder={t('youtubeLink')}
              onChange={(event) => {
                setYoutubeUrl(event.target.value)
                setYoutubeError('')
              }}
            />
            <button type="submit">{t('bind')}</button>
          </form>
          {youtubeError ? <p className="notice error">{youtubeError}</p> : null}
        </div>
      </section>

      <input
        ref={videoInputRef}
        className="visually-hidden"
        type="file"
        accept="video/*"
        onChange={handleVideoChange}
      />

      <label className="search-box">
        <span>{t('search')}</span>
        <input
          type="search"
          value={query}
          placeholder={t('searchOriginalTranslation')}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="segmented">
        {filters.map((item) => (
          <button
            type="button"
            key={item.value}
            className={filter === item.value ? 'active' : ''}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="subtitle-list">
        {lines.map((line) => {
          const index = project.subtitles.findIndex((item) => item.id === line.id)
          const isActive = index === activeIndex

          return (
              <button
                type="button"
                key={line.id}
                className={`subtitle-row ${isActive ? 'active' : ''}`}
                onClick={() => openLineEditor(index)}
              >
                <span className={`status-dot ${line.status}`} />
                <span className="subtitle-row__index">{line.index}</span>
                <span className="subtitle-row__content">
                  <strong>{line.start}</strong>
                  <span>{line.original}</span>
                  <em>{line.translation || t('untranslated')}</em>
                </span>
              </button>
          )
        })}
      </section>
    </main>
  )
}

export default OverviewPage
