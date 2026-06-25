import { useEffect, useMemo, useRef, useState } from 'react'
import { Home, List, MoreHorizontal, X } from 'lucide-react'
import AIAssistantPanel from '../components/AIAssistantPanel'
import BottomToolbar from '../components/BottomToolbar'
import ProgressBar from '../components/ProgressBar'
import SubtitleCard from '../components/SubtitleCard'
import { downloadSrt, exportSrt } from '../utils/exportSrt'
import { formatMessage, getTranslator } from '../utils/i18n'
import { getTaskMeta } from '../utils/schedule'
import { parseSrtTime, shiftSrtTime } from '../utils/timecode'
import { buildYouTubeEmbedUrl, getYouTubeId } from '../utils/youtube'

function EditorPage({
  project,
  initialIndex,
  onHome,
  onBack,
  onUpdateSubtitle,
  onUpdateSubtitleTiming,
  onUpdateProjectTask,
  onAttachVideo,
  onAttachYouTubeVideo,
  language = 'zh-CN',
}) {
  const t = getTranslator(language)
  const videoRef = useRef(null)
  const videoInputRef = useRef(null)
  const clipEndRef = useRef(0)
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0)
  const [translation, setTranslation] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [exportText, setExportText] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeError, setYoutubeError] = useState('')
  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState('')
  const [taskForm, setTaskForm] = useState({
    dueDate: project.dueDate || '',
    priority: project.priority || 'normal',
    note: project.note || '',
  })

  const subtitle = project.subtitles[currentIndex]
  const previousLine = project.subtitles[currentIndex - 1]
  const nextLine = project.subtitles[currentIndex + 1]
  const subtitleTranslation = subtitle?.translation || ''
  const isYouTubeVideo = project.video?.source === 'youtube'
  const isFileVideo = Boolean(project.video?.blob)
  const hasPlayableVideo = isFileVideo || isYouTubeVideo
  const taskMeta = getTaskMeta(project)

  useEffect(() => {
    setCurrentIndex(initialIndex || 0)
  }, [project.projectId, initialIndex])

  useEffect(() => {
    setTaskForm({
      dueDate: project.dueDate || '',
      priority: project.priority || 'normal',
      note: project.note || '',
    })
  }, [project.dueDate, project.note, project.priority])

  useEffect(() => {
    setTranslation(subtitleTranslation)
  }, [subtitle?.id, subtitleTranslation])

  useEffect(() => {
    if (!subtitle || translation === subtitleTranslation) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      onUpdateSubtitle(subtitle.id, translation)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [onUpdateSubtitle, subtitle, subtitleTranslation, translation])

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

  const nextTodoIndex = useMemo(() => {
    return project.subtitles.findIndex((line, index) => {
      return index > currentIndex && line.status !== 'done'
    })
  }, [currentIndex, project.subtitles])

  const contextLines = useMemo(() => {
    const start = Math.max(0, currentIndex - 3)
    const end = Math.min(project.subtitles.length, currentIndex + 4)

    return project.subtitles.slice(start, end).map((line, offset) => {
      const absoluteIndex = start + offset
      const isCurrent = absoluteIndex === currentIndex
      const draftTranslation = isCurrent ? translation : line.translation
      const displayText = draftTranslation.trim() || line.original

      return {
        ...line,
        displayText,
        isCurrent,
      }
    })
  }, [currentIndex, project.subtitles, translation])

  function moveTo(index) {
    saveCurrentLine()
    const bounded = Math.min(Math.max(index, 0), project.subtitles.length - 1)
    setContextOpen(false)
    setCurrentIndex(bounded)

    if (isFileVideo && videoRef.current) {
      const nextSubtitle = project.subtitles[bounded]
      if (nextSubtitle) {
        const nextStart = parseSrtTime(nextSubtitle.start)
        videoRef.current.currentTime = nextStart
        videoRef.current.pause()
        clipEndRef.current = 0
      }
    }
  }

  function getSubtitlesWithDraft() {
    if (!subtitle) {
      return project.subtitles
    }

    return project.subtitles.map((line) => {
      if (line.id !== subtitle.id) {
        return line
      }

      return {
        ...line,
        translation,
        status: translation.trim() ? 'done' : 'todo',
      }
    })
  }

  function saveCurrentLine() {
    if (subtitle && translation !== subtitleTranslation) {
      onUpdateSubtitle(subtitle.id, translation)
    }
  }

  function handleExport(mode) {
    saveCurrentLine()
    const content = exportSrt(getSubtitlesWithDraft(), mode)
    setExportText(content)
    downloadSrt(project.fileName, content)
  }

  async function handleVideoChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    await onAttachVideo(file)
    setOptionsOpen(false)
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
    setOptionsOpen(false)
  }

  async function handleTaskSubmit(event) {
    event.preventDefault()
    await onUpdateProjectTask(taskForm)
  }

  function playCurrentClip() {
    if (!subtitle) {
      return
    }

    const start = parseSrtTime(subtitle.start)
    const end = parseSrtTime(subtitle.end)

    if (isYouTubeVideo && project.video?.videoId) {
      setYoutubeEmbedUrl(buildYouTubeEmbedUrl(project.video.videoId, start, end, true))
      return
    }

    if (!videoRef.current) {
      return
    }

    const video = videoRef.current

    clipEndRef.current = Math.max(start, end - 0.05)
    video.pause()
    video.currentTime = start
    video.play().catch(() => {})
  }

  function handleVideoTimeUpdate() {
    const video = videoRef.current

    if (video && clipEndRef.current && video.currentTime >= clipEndRef.current) {
      video.pause()
      video.currentTime = clipEndRef.current
      clipEndRef.current = 0
    }
  }

  function handleTranslationKeyDown(event) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()

    if (event.shiftKey) {
      const textarea = event.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const nextValue = `${translation.slice(0, start)}\\N${translation.slice(end)}`

      setTranslation(nextValue)

      window.requestAnimationFrame(() => {
        textarea.setSelectionRange(start + 2, start + 2)
      })
      return
    }

    if (currentIndex < project.subtitles.length - 1) {
      moveTo(currentIndex + 1)
      return
    }

    saveCurrentLine()
  }

  function handleAdjustTiming(field, deltaSeconds) {
    if (!subtitle) {
      return
    }

    const nextTiming = {
      start: subtitle.start,
      end: subtitle.end,
    }

    nextTiming[field] = shiftSrtTime(subtitle[field], deltaSeconds)

    const startSeconds = parseSrtTime(nextTiming.start)
    const endSeconds = parseSrtTime(nextTiming.end)

    if (endSeconds <= startSeconds) {
      return
    }

    onUpdateSubtitleTiming(subtitle.id, nextTiming)
  }

  return (
    <main className={`page editor-page ${language === 'en' ? 'lang-en' : ''}`}>
      <header className="top-bar">
        <button
          type="button"
          className="nav-icon-button"
          aria-label={t('files')}
          onClick={() => {
            saveCurrentLine()
            onHome()
          }}
        >
          <Home size={19} strokeWidth={2.2} />
        </button>
        <div>
          <p className="eyebrow">{formatMessage(t('lineProgress'), { current: currentIndex + 1, total: project.subtitles.length })}</p>
          <h1>{project.fileName}</h1>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="nav-icon-button"
            aria-label={t('overview')}
            onClick={() => {
              saveCurrentLine()
              onBack()
            }}
          >
            <List size={19} strokeWidth={2.2} />
          </button>
          <button type="button" className="icon-button" onClick={() => setOptionsOpen(true)}>
            <MoreHorizontal size={20} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <ProgressBar subtitles={project.subtitles} language={language} />

      <section className={`task-summary ${taskMeta.status}`}>
        <div>
          <span className="field-label">{t('taskPlan')}</span>
          <p>
            {t('due')}: {project.dueDate ? taskMeta.dueLabel : t('unset')}
            {taskMeta.status === 'overdue' ? `, ${formatMessage(t('overdueDays'), { days: taskMeta.overdueDays })}` : ''}
          </p>
        </div>
        <div>
          <span className="field-label">{t('remaining')}</span>
          <p>
            {taskMeta.remainingLines} {t('linesUnit')}
            {taskMeta.dailyTarget ? `, ${formatMessage(t('dailySuggestion'), { count: taskMeta.dailyTarget })}` : ''}
          </p>
        </div>
      </section>

      <section className={`video-panel ${hasPlayableVideo ? '' : 'empty'}`}>
        {isFileVideo ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={handleVideoTimeUpdate}
            />
            <div className="video-actions">
              <div>
                <span className="field-label">{t('video')}</span>
                <p>{project.video.name}</p>
              </div>
              <button type="button" className="primary" onClick={playCurrentClip}>
                {t('playLine')}
              </button>
            </div>
          </>
        ) : isYouTubeVideo ? (
          <>
            <iframe
              title={project.video.name}
              src={youtubeEmbedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            <div className="video-actions">
              <div>
                <span className="field-label">YouTube</span>
                <p>{project.video.url}</p>
              </div>
              <button type="button" className="primary" onClick={playCurrentClip}>
                {t('playLine')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="field-label">{t('video')}</span>
              <p>{t('uploadVideoHelp')}</p>
            </div>
            <button
              type="button"
              className="primary"
              onClick={() => videoInputRef.current?.click()}
            >
              {t('uploadVideo')}
            </button>
          </>
        )}
      </section>

      <SubtitleCard
        subtitle={subtitle}
        translation={translation}
        onTranslationChange={setTranslation}
        onTranslationKeyDown={handleTranslationKeyDown}
        onOpenContext={() => setContextOpen(true)}
        onAdjustTiming={handleAdjustTiming}
        language={language}
      />

      <BottomToolbar
        canPrev={currentIndex > 0}
        canNext={currentIndex < project.subtitles.length - 1}
        onPrev={() => moveTo(currentIndex - 1)}
        onNext={() => moveTo(currentIndex + 1)}
        onAI={() => setAiOpen(true)}
        language={language}
        onNextTodo={() => {
          if (nextTodoIndex >= 0) {
            moveTo(nextTodoIndex)
          }
        }}
      />

      <AIAssistantPanel
        open={aiOpen}
        subtitle={subtitle}
        previousLine={previousLine}
        nextLine={nextLine}
        userTranslation={translation}
        onApply={(value) => {
          setTranslation(value)
          setAiOpen(false)
        }}
        onClose={() => setAiOpen(false)}
        language={language}
      />

      {optionsOpen ? (
        <div className="sheet-backdrop" onClick={() => setOptionsOpen(false)}>
          <aside className="action-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" aria-hidden="true" />
            <header className="sheet-header">
              <div>
                <p className="eyebrow">{t('fileActions')}</p>
                <h2>{project.fileName}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setOptionsOpen(false)}
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </header>
            <div className="action-list">
              <form className="task-form" onSubmit={handleTaskSubmit}>
                <label>
                  <span className="field-label">{t('dueDate')}</span>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) => {
                      setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                    }}
                  />
                </label>
                <label>
                  <span className="field-label">{t('priority')}</span>
                  <select
                    value={taskForm.priority}
                    onChange={(event) => {
                      setTaskForm((current) => ({ ...current, priority: event.target.value }))
                    }}
                  >
                    <option value="low">{t('low')}</option>
                    <option value="normal">{t('normal')}</option>
                    <option value="high">{t('high')}</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">{t('note')}</span>
                  <textarea
                    value={taskForm.note}
                    rows="2"
                    placeholder={language === 'en' ? 'Example: due Sunday' : '例如：周日前交'}
                    onChange={(event) => {
                      setTaskForm((current) => ({ ...current, note: event.target.value }))
                    }}
                  />
                </label>
                <button type="submit">{t('savePlan')}</button>
              </form>
              <button type="button" onClick={() => videoInputRef.current?.click()}>
                {hasPlayableVideo ? t('replaceLocalVideo') : t('uploadLocalVideo')}
              </button>
              <form className="youtube-form" onSubmit={handleYouTubeSubmit}>
                <label>
                  <span className="field-label">{t('youtubeLink')}</span>
                  <input
                    type="url"
                    value={youtubeUrl}
                    placeholder="https://www.youtube.com/watch?v=..."
                    onChange={(event) => {
                      setYoutubeUrl(event.target.value)
                      setYoutubeError('')
                    }}
                  />
                </label>
                {youtubeError ? <p className="notice error">{youtubeError}</p> : null}
                <button type="submit">{t('bindYoutube')}</button>
              </form>
              <button type="button" onClick={() => handleExport('translation')}>
                {t('exportTranslationSrt')}
              </button>
              <button type="button" onClick={() => handleExport('bilingual')}>
                {t('exportBilingualSrt')}
              </button>
              {exportText ? (
                <button type="button" onClick={() => navigator.clipboard?.writeText(exportText)}>
                  {t('copyExportText')}
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      <input
        ref={videoInputRef}
        className="visually-hidden"
        type="file"
        accept="video/*"
        onChange={handleVideoChange}
      />

      {contextOpen ? (
        <div className="context-backdrop" onClick={() => setContextOpen(false)}>
          <aside className="context-popover" onClick={(event) => event.stopPropagation()}>
            <header className="context-header">
              <div>
                <p className="eyebrow">{t('context')}</p>
                <h2>{t('nearbySubtitles')}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setContextOpen(false)}
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </header>
            <div className="context-list">
              {contextLines.map((line) => (
                <div
                  key={line.id}
                  className={`context-line ${line.isCurrent ? 'current' : ''}`}
                >
                  <span>{line.index}</span>
                  <p>{line.displayText}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  )
}

export default EditorPage
