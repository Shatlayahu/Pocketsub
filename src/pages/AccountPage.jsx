import { useMemo, useState, useEffect } from 'react'
import TabBar from '../components/TabBar'
import { getEarningsSummary, formatCurrency } from '../utils/earnings'
import { getTranslator } from '../utils/i18n'
import { getProgress } from '../utils/progress'

function parseProjectDate(project) {
  const rawDate = project.finishedAt || project.dueDate || project.updatedAt || project.createdAt

  if (!rawDate) {
    return new Date()
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [year, month, day] = rawDate.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(rawDate)
}

function buildMonthBuckets(language) {
  const locale = language === 'en' ? 'en-US' : 'zh-CN'
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short' })
  const current = new Date()

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - (5 - index), 1)
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: formatter.format(date),
      workHours: 0,
      linesDone: 0,
    }
  })
}

function buildChartPoints(values, formatter) {
  const maxValue = Math.max(...values, 1)

  return values.map((value, index) => {
    const x = 18 + index * (140 / Math.max(values.length - 1, 1))
    const y = 88 - (value / maxValue) * 58

    return {
      x,
      y,
      value,
      label: formatter(value),
    }
  })
}

function buildAccountCharts(projects, language) {
  const buckets = buildMonthBuckets(language)
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  projects.forEach((project) => {
    const projectDate = parseProjectDate(project)
    const bucket = bucketMap.get(`${projectDate.getFullYear()}-${projectDate.getMonth()}`)

    if (!bucket) {
      return
    }

    const progress = getProgress(project.subtitles)
    bucket.linesDone += progress.done
    bucket.workHours += progress.done > 0 ? Math.max(0.25, progress.done / 32) : 0
  })

  const workValues = buckets.map((bucket) => Number(bucket.workHours.toFixed(1)))
  const efficiencyValues = buckets.map((bucket) => {
    if (!bucket.workHours) {
      return 0
    }

    return Math.round(bucket.linesDone / bucket.workHours)
  })

  return {
    labels: buckets.map((bucket) => bucket.label),
    workTime: buildChartPoints(workValues, (value) => `${value.toFixed(1)}h`),
    efficiency: buildChartPoints(efficiencyValues, (value) => String(Math.round(value))),
  }
}

function buildCurve(points) {
  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`
    }

    const previous = points[index - 1]
    const controlX = (previous.x + point.x) / 2
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`
  }, '')
}

function StatisticChart({ title, unit, points, labels, periodLabel, className = '' }) {
  const marker = points[points.length - 1] || points[0]
  const maxValue = Math.max(...points.map((point) => point.value), 1)
  const axisValues = [maxValue, maxValue * 0.66, maxValue * 0.33]

  return (
    <section className={`stat-chart-card ${className}`}>
      <header>
        <h2>{title}</h2>
        <span>{periodLabel}</span>
      </header>
      <div className="stat-chart">
        <div className="stat-chart__axis">
          {axisValues.map((value) => (
            <span key={value}>{value >= 10 ? Math.round(value) : value.toFixed(1)}{unit}</span>
          ))}
        </div>
        <svg viewBox="0 0 180 120" role="img" aria-label={title}>
          <line className="grid-line" x1="16" y1="28" x2="160" y2="28" />
          <line className="grid-line" x1="16" y1="58" x2="160" y2="58" />
          <line className="grid-line solid" x1="16" y1="94" x2="160" y2="94" />
          <path className="stat-path" d={buildCurve(points)} />
          <line className="marker-line" x1={marker.x} y1="22" x2={marker.x} y2="94" />
          {points.map((point) => (
            <g key={`${point.x}-${point.y}`}>
              <circle cx={point.x} cy={point.y} r="3.5" />
              <text x={point.x - 8} y={point.y - 9}>{point.label}</text>
            </g>
          ))}
          <g className="chart-badge">
            <rect x={marker.x - 16} y="8" width="42" height="16" rx="8" />
            <text x={marker.x - 10} y="20">{marker.label}</text>
          </g>
        </svg>
        <div className="stat-chart__months" style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}>
          {labels.map((month) => <span key={month}>{month}</span>)}
        </div>
      </div>
    </section>
  )
}

function AccountPage({
  projects,
  profile,
  isLoggedIn,
  onSaveProfile,
  onLogin,
  onLogout,
  onResetPassword,
  onResendVerification,
  getAuthErrorMessage,
  onNavigate,
}) {
  const [authMode, setAuthMode] = useState('login')
  const [authMessage, setAuthMessage] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState(profile)
  const [settingsMessage, setSettingsMessage] = useState('')
  const [settingsPassword, setSettingsPassword] = useState({ next: '', confirm: '' })
  const [verificationMessage, setVerificationMessage] = useState('')
  const [verificationCooldown, setVerificationCooldown] = useState(0)
  const [resetCooldown, setResetCooldown] = useState(0)
  const [loginForm, setLoginForm] = useState({
    userName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const summary = getEarningsSummary(projects, profile.defaultPricePerLine)
  const t = getTranslator(profile.language)
  const accountCharts = useMemo(() => buildAccountCharts(projects, profile.language), [profile.language, projects])
  const chartPeriodLabel = profile.language === 'en' ? 'Last 6 months' : '最近 6 个月'

  useEffect(() => {
    if (verificationCooldown === 0 && resetCooldown === 0) {
      return undefined
    }

    const timer = setInterval(() => {
      setVerificationCooldown((current) => Math.max(0, current - 1))
      setResetCooldown((current) => Math.max(0, current - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [verificationCooldown, resetCooldown])

  const completedProjects = projects.filter((project) => {
    const progress = getProgress(project.subtitles)
    return progress.total > 0 && progress.done === progress.total
  }).length

  const pageHeader = (
    <header className="home-header app-title-row">
      <div>
        <p className="eyebrow">Account</p>
        <h1>{t('accountTitle')}</h1>
      </div>
      <TabBar current="account" onNavigate={onNavigate} className="header-tab-bar" language={profile.language} />
      <span aria-hidden="true" className="header-spacer" />
    </header>
  )

  if (!isLoggedIn) {
    const isRegister = authMode === 'register'
    const isReset = authMode === 'reset'
    const title = isRegister ? t('registerTitle') : isReset ? t('resetPassword') : t('loginTitle')
    const helperText = isRegister ? t('registerHelp') : isReset ? t('resetPasswordHelp') : t('loginHelp')

    return (
      <main className={`page account-page ${profile.language === 'en' ? 'lang-en' : ''}`}>
        {pageHeader}

        <section className="auth-card account-login-card">
          <div className="auth-mode-tabs" role="tablist" aria-label="账户操作">
            <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setAuthMessage('') }}>{t('signIn')}</button>
            <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => { setAuthMode('register'); setAuthMessage('') }}>{t('register')}</button>
          </div>
          <span className="field-label">{isRegister ? 'Create account' : isReset ? 'Reset password' : 'Sign in'}</span>
          <h2>{title}</h2>
          <p>{helperText}</p>
          <form
            className="login-form"
            onSubmit={async (event) => {
              event.preventDefault()
              setAuthMessage('')

              if (!loginForm.email.trim()) {
                setAuthMessage(t('emailRequired'))
                return
              }

              if (isReset) {
                try {
                  await onResetPassword(loginForm.email)
                  setAuthMessage(t('resetEmailSent'))
                  setResetCooldown(60)
                  setAuthMode('login')
                } catch (error) {
                  setAuthMessage(getAuthErrorMessage(error))
                }
                return
              }

              if (isRegister && loginForm.password !== loginForm.confirmPassword) {
                setAuthMessage(t('passwordsMismatch'))
                return
              }

              try {
                await onLogin({ ...loginForm, mode: isRegister ? 'register' : 'login' })
                if (isRegister) {
                  setAuthMessage(t('verificationEmailSent'))
                }
              } catch (error) {
                setAuthMessage(getAuthErrorMessage(error))
              }
            }}
          >
            {isRegister ? (
              <label>
                <span className="field-label">{t('username')}</span>
                <input
                  autoComplete="username"
                  placeholder={t('enterUsername')}
                  value={loginForm.userName}
                  onChange={(event) => {
                    setLoginForm((current) => ({ ...current, userName: event.target.value }))
                  }}
                />
              </label>
            ) : null}
            <label>
              <span className="field-label">{t('email')}</span>
              <input
                type="email"
                autoComplete="email"
                placeholder={t('enterEmail')}
                value={loginForm.email}
                onChange={(event) => {
                  setLoginForm((current) => ({ ...current, email: event.target.value }))
                }}
              />
            </label>
            {!isReset ? (
            <label>
              <span className="field-label">{t('password')}</span>
              <input
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={t('enterPassword')}
                value={loginForm.password}
                onChange={(event) => {
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }}
              />
            </label>
            ) : null}
            {isRegister ? (
              <label>
                <span className="field-label">{t('confirmPassword')}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('enterPasswordAgain')}
                  value={loginForm.confirmPassword}
                  onChange={(event) => {
                    setLoginForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }}
                />
              </label>
            ) : null}
            {authMessage ? <p className="auth-message">{authMessage}</p> : null}
            <button type="submit" className="primary" disabled={isReset && resetCooldown > 0}>
              {isRegister ? t('registerAndLogin') : isReset ? (resetCooldown > 0 ? `${t('sendReset')} (${resetCooldown}s)` : t('sendReset')) : t('signIn')}
            </button>
            <button
              type="button"
              className="auth-link-button"
              onClick={() => {
                setAuthMessage('')
                setAuthMode(isReset ? 'login' : 'reset')
              }}
            >
              {isReset ? t('backToLogin') : t('forgotPassword')}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className={`page account-page ${!profile.emailVerified ? 'has-email-warning' : ''} ${profile.language === 'en' ? 'lang-en' : ''}`}>
      {pageHeader}

      <header className="account-header">
        <div className="avatar" aria-hidden="true">
          {(profile.userName || 'User').slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1>{profile.userName || 'User'}</h1>
          <p>{profile.email || t('signedIn')}</p>
        </div>
        <button
          type="button"
          className="plain-button settings-button"
          onClick={() => {
            setSettingsForm(profile)
            setSettingsPassword({ next: '', confirm: '' })
            setSettingsMessage('')
            setSettingsOpen(true)
          }}
        >
          {t('settings')}
        </button>
        <button type="button" className="plain-button logout-button" onClick={onLogout}>
          {t('logout')}
        </button>
      </header>

      {!profile.emailVerified ? (
        <section className="auth-card email-verification-card">
          <span className="field-label">{t('emailVerification')}</span>
          <button
            type="button"
            className="primary"
            disabled={verificationCooldown > 0}
            onClick={async () => {
              try {
                await onResendVerification()
                setVerificationMessage(t('verificationEmailSent'))
                setVerificationCooldown(60)
              } catch (error) {
                setVerificationMessage(getAuthErrorMessage(error))
              }
            }}
          >
            {verificationCooldown > 0 ? `${t('resendVerification')} (${verificationCooldown}s)` : t('resendVerification')}
          </button>
          {verificationMessage ? <p className="auth-message">{verificationMessage}</p> : null}
        </section>
      ) : null}

      <StatisticChart className="work-time-chart" title={t('workTimeThisWeek')} unit="h" points={accountCharts.workTime} labels={accountCharts.labels} periodLabel={chartPeriodLabel} />

      <StatisticChart className="efficiency-chart" title={t('efficiency')} unit="" points={accountCharts.efficiency} labels={accountCharts.labels} periodLabel={chartPeriodLabel} />

      <section className="metrics-grid">
        <div>
          <span className="field-label">{t('projects')}</span>
          <strong>{projects.length}</strong>
        </div>
        <div>
          <span className="field-label">{t('completed')}</span>
          <strong>{completedProjects}</strong>
        </div>
        <div>
          <span className="field-label">{t('totalIncome')}</span>
          <strong>{formatCurrency(summary.earnedIncome)}</strong>
        </div>
        <div>
          <span className="field-label">{t('avgPrice')}</span>
          <strong>{formatCurrency(profile.defaultPricePerLine)}</strong>
        </div>
      </section>

      <form className="profile-form" onSubmit={(event) => event.preventDefault()}>
        <span className="field-label">{t('settingsSummary')}</span>
        <p>{t('defaultPrice')}: {formatCurrency(profile.defaultPricePerLine)}</p>
        <p>
          {t('workPeriod')}: {profile.billingSettings.firstPeriodStart}-{profile.billingSettings.firstPeriodEnd},
          {profile.billingSettings.firstPeriodEnd + 1}-{profile.billingSettings.firstPeriodStart - 1}
        </p>
        <button type="button" className="primary" onClick={() => { setSettingsForm(profile); setSettingsPassword({ next: '', confirm: '' }); setSettingsMessage(''); setSettingsOpen(true) }}>
          {t('openSettings')}
        </button>
      </form>

      {settingsOpen ? (
        <div className="sheet-backdrop" onClick={() => setSettingsOpen(false)}>
          <aside className="action-sheet settings-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" aria-hidden="true" />
            <header className="sheet-header">
              <div>
                <p className="eyebrow">Settings</p>
                <h2>{t('accountSettings')}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)}>x</button>
            </header>
            <form
              className="settings-form"
              onSubmit={async (event) => {
                event.preventDefault()
                if (settingsPassword.next !== settingsPassword.confirm) {
                  setSettingsMessage(t('newPasswordMismatch'))
                  return
                }

                try {
                  await onSaveProfile(settingsForm, settingsPassword.next)
                  setSettingsMessage(t('settingsSaved'))
                  setSettingsOpen(false)
                } catch (error) {
                  setSettingsMessage(getAuthErrorMessage(error))
                }
              }}
            >
              <section>
                <h3>{t('accountTitle')}</h3>
                <label>
                  <span className="field-label">{t('username')}</span>
                  <input
                    value={settingsForm.userName}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, userName: event.target.value }))}
                  />
                </label>
                <label>
                  <span className="field-label">{t('email')}</span>
                  <input
                    type="email"
                    value={settingsForm.email}
                    disabled
                    onChange={(event) => setSettingsForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </label>
                <label>
                  <span className="field-label">{t('newPassword')}</span>
                  <input type="password" placeholder={t('leaveBlank')} value={settingsPassword.next} onChange={(event) => setSettingsPassword((current) => ({ ...current, next: event.target.value }))} />
                </label>
                <label>
                  <span className="field-label">{t('confirmNewPassword')}</span>
                  <input type="password" placeholder={t('leaveBlank')} value={settingsPassword.confirm} onChange={(event) => setSettingsPassword((current) => ({ ...current, confirm: event.target.value }))} />
                </label>
              </section>
              <section>
                <h3>{t('income')}</h3>
                <label>
                  <span className="field-label">¥ / line</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={settingsForm.defaultPricePerLine}
                    onChange={(event) => {
                      setSettingsForm((current) => ({
                        ...current,
                        defaultPricePerLine: Number(event.target.value),
                      }))
                    }}
                  />
                </label>
              </section>
              <section>
                <h3>{t('workPeriod')}</h3>
                <div className="settings-two-col">
                  <label>
                    <span className="field-label">{t('firstPeriodStart')}</span>
                    <input
                      type="number"
                      min="2"
                      max="27"
                      value={settingsForm.billingSettings.firstPeriodStart}
                      onChange={(event) => {
                        setSettingsForm((current) => ({
                          ...current,
                          billingSettings: {
                            ...current.billingSettings,
                            firstPeriodStart: Number(event.target.value),
                          },
                        }))
                      }}
                    />
                  </label>
                  <label>
                    <span className="field-label">{t('firstPeriodEnd')}</span>
                    <input
                      type="number"
                      min="2"
                      max="28"
                      value={settingsForm.billingSettings.firstPeriodEnd}
                      onChange={(event) => {
                        setSettingsForm((current) => ({
                          ...current,
                          billingSettings: {
                            ...current.billingSettings,
                            firstPeriodEnd: Number(event.target.value),
                          },
                        }))
                      }}
                    />
                  </label>
                </div>
              </section>
              <section>
                <h3>{t('settlementDays')}</h3>
                <div className="settings-two-col">
                  <label>
                    <span className="field-label">{t('settlementDay1')}</span>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={settingsForm.billingSettings.settlementDays[0]}
                      onChange={(event) => {
                        setSettingsForm((current) => ({
                          ...current,
                          billingSettings: {
                            ...current.billingSettings,
                            settlementDays: [Number(event.target.value), current.billingSettings.settlementDays[1]],
                          },
                        }))
                      }}
                    />
                  </label>
                  <label>
                    <span className="field-label">{t('settlementDay2')}</span>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={settingsForm.billingSettings.settlementDays[1]}
                      onChange={(event) => {
                        setSettingsForm((current) => ({
                          ...current,
                          billingSettings: {
                            ...current.billingSettings,
                            settlementDays: [current.billingSettings.settlementDays[0], Number(event.target.value)],
                          },
                        }))
                      }}
                    />
                  </label>
                </div>
              </section>
              <section>
                <h3>{t('preferences')}</h3>
                <label>
                  <span className="field-label">{t('language')}</span>
                  <select
                    value={settingsForm.language}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, language: event.target.value }))}
                  >
                    <option value="zh-CN">中文</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={settingsForm.compactMode}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, compactMode: event.target.checked }))}
                  />
                  <span>{t('compactMode')}</span>
                </label>
              </section>
              {settingsMessage ? <p className="auth-message">{settingsMessage}</p> : null}
              <button type="submit" className="primary">{t('saveSettings')}</button>
            </form>
          </aside>
        </div>
      ) : null}
    </main>
  )
}

export default AccountPage
