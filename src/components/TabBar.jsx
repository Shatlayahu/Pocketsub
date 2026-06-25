import { Files, UserRound, WalletCards } from 'lucide-react'
import { getTranslator } from '../utils/i18n'

const tabs = [
  { key: 'home', label: 'Files', icon: Files },
  { key: 'earnings', label: 'Earnings', icon: WalletCards },
  { key: 'account', label: 'Account', icon: UserRound },
]

function TabBar({ current, onNavigate, className = '', language = 'zh-CN' }) {
  const t = getTranslator(language)

  return (
    <nav className={['tab-bar', className].filter(Boolean).join(' ')} aria-label="主导航">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            type="button"
            key={tab.key}
            className={current === tab.key ? 'active' : ''}
            onClick={() => onNavigate(tab.key)}
          >
            <Icon size={18} strokeWidth={2.2} />
            <span>{t(tab.key === 'home' ? 'files' : tab.key)}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default TabBar
