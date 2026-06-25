import { getProgress } from '../utils/progress'
import { getTranslator } from '../utils/i18n'

function ProgressBar({ subtitles, language = 'zh-CN' }) {
  const { done, total, percent } = getProgress(subtitles)
  const t = getTranslator(language)

  return (
    <div className="progress">
      <div className="progress__label">
        <span>{done} / {total} {t('completed')}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="progress__track">
        <div className="progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export default ProgressBar
