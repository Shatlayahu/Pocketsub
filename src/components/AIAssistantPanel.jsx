import { useState } from 'react'
import { askAI } from '../utils/ai'
import { getTranslator } from '../utils/i18n'

function AIAssistantPanel({
  open,
  subtitle,
  previousLine,
  nextLine,
  userTranslation,
  onApply,
  onClose,
  language = 'zh-CN',
}) {
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState(null)
  const t = getTranslator(language)
  const actions = [
    { mode: 'explain_sentence', label: t('explainSentence') },
    { mode: 'suggest_translation', label: t('suggestTranslation') },
    { mode: 'polish_translation', label: t('polishTranslation') },
  ]

  if (!open) {
    return null
  }

  async function handleAsk(mode) {
    setLoading(true)
    const result = await askAI({
      mode,
      currentLine: subtitle?.original || '',
      previousLine: previousLine?.original || '',
      nextLine: nextLine?.original || '',
      userTranslation,
    })
    setReply(result)
    setLoading(false)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="ai-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <div>
            <p className="eyebrow">AI Assistant</p>
            <h2>{t('aiSubtitleHelper')}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>x</button>
        </header>

        <div className="ai-current">
          <span className="field-label">{t('currentLine')}</span>
          <p>{subtitle?.original}</p>
        </div>

        <div className="ai-actions">
          {actions.map((action) => (
            <button
              type="button"
              key={action.mode}
              onClick={() => handleAsk(action.mode)}
              disabled={loading}
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="ai-reply">
          {loading ? (
            <p className="muted">{t('aiGenerating')}</p>
          ) : reply ? (
            <>
              <p>{reply.answer}</p>
              <div className="sheet-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => onApply(reply.suggestedTranslation)}
                >
                  {t('applyTranslation')}
                </button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(reply.answer)}
                >
                  {t('copy')}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">{t('aiEmptyHint')}</p>
          )}
        </div>
      </aside>
    </div>
  )
}

export default AIAssistantPanel
