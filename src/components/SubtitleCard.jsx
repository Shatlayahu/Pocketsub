import { useRef } from 'react'
import { getTranslator } from '../utils/i18n'

function SubtitleCard({
  subtitle,
  translation,
  onTranslationChange,
  onTranslationKeyDown,
  onOpenContext,
  onAdjustTiming,
  language = 'zh-CN',
}) {
  const textareaRef = useRef(null)
  const t = getTranslator(language)

  if (!subtitle) {
    return (
      <section className="subtitle-card">
        <p className="muted">{t('noSubtitleContent')}</p>
      </section>
    )
  }

  function insertLineBreakToken() {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? translation.length
    const end = textarea?.selectionEnd ?? translation.length
    const nextValue = `${translation.slice(0, start)}\\N${translation.slice(end)}`

    onTranslationChange(nextValue)

    window.requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(start + 2, start + 2)
    })
  }

  return (
    <section className="subtitle-card">
      <div className="timing-panel">
        <div className="timecode-row">
          <span className="field-label">{t('start')}</span>
          <strong>{subtitle.start}</strong>
          <button type="button" onClick={() => onAdjustTiming('start', -0.1)}>-0.1s</button>
          <button type="button" onClick={() => onAdjustTiming('start', 0.1)}>+0.1s</button>
        </div>
        <div className="timecode-row">
          <span className="field-label">{t('end')}</span>
          <strong>{subtitle.end}</strong>
          <button type="button" onClick={() => onAdjustTiming('end', -0.1)}>-0.1s</button>
          <button type="button" onClick={() => onAdjustTiming('end', 0.1)}>+0.1s</button>
        </div>
      </div>
      <button
        type="button"
        className="subtitle-card__section original-button"
        onClick={onOpenContext}
      >
        <span className="field-label">{t('original')}</span>
        <p className="original-text">{subtitle.original}</p>
      </button>
      <label className="subtitle-card__section">
        <span className="translation-label-row">
          <span className="field-label">{t('translation')}</span>
          <button type="button" className="token-button" onClick={insertLineBreakToken}>
            {t('insertLineBreak')}
          </button>
        </span>
        <textarea
          ref={textareaRef}
          value={translation}
          rows="7"
          placeholder={t('translationPlaceholder')}
          onChange={(event) => onTranslationChange(event.target.value)}
          onKeyDown={onTranslationKeyDown}
        />
      </label>
    </section>
  )
}

export default SubtitleCard
