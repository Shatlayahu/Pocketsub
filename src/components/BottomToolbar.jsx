import { getTranslator } from '../utils/i18n'

function BottomToolbar({ onPrev, onAI, onNext, onNextTodo, canPrev, canNext, language = 'zh-CN' }) {
  const t = getTranslator(language)

  return (
    <nav className="bottom-toolbar" aria-label={t('editSubtitles')}>
      <button type="button" onClick={onPrev} disabled={!canPrev}>{t('previousLine')}</button>
      <button type="button" className="primary" onClick={onAI}>AI</button>
      <button type="button" onClick={onNext} disabled={!canNext}>{t('nextLine')}</button>
      <button type="button" onClick={onNextTodo}>{t('nextTodo')}</button>
    </nav>
  )
}

export default BottomToolbar
