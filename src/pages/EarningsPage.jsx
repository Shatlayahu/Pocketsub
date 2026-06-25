import { useMemo, useState } from 'react'
import TabBar from '../components/TabBar'
import {
  getEarningsSummary,
  getProjectEarnings,
  getProjectSettlementPeriod,
  getSettlementPeriodsForMonth,
  formatCurrency,
} from '../utils/earnings'
import { getLocale, getTranslator } from '../utils/i18n'

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

function startOfWeek(date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  const mondayOffset = (nextDate.getDay() + 6) % 7
  nextDate.setDate(nextDate.getDate() - mondayOffset)
  return nextDate
}

function formatWeekRange(startDate, locale = 'zh-CN') {
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)

  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
  })

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
}

function EarningsPage({ projects, profile, isLoggedIn, onUpdateProjectBilling, onNavigate }) {
  const t = getTranslator(profile.language)
  const locale = getLocale(profile.language)
  const billingSettings = profile.billingSettings
  const [periodMonth, setPeriodMonth] = useState(() => new Date())
  const periods = useMemo(() => getSettlementPeriodsForMonth(periodMonth, billingSettings), [billingSettings, periodMonth])
  const [periodKey, setPeriodKey] = useState('all')
  const [chartWeekStart, setChartWeekStart] = useState(() => startOfWeek(new Date()))
  const [touchStartX, setTouchStartX] = useState(null)
  const visibleProjects = useMemo(() => {
    const periodKeys = new Set(periods.map((period) => period.key))

    if (periodKey === 'all') {
      return projects.filter((project) => periodKeys.has(getProjectSettlementPeriod(project, billingSettings).key))
    }

    return projects.filter((project) => getProjectSettlementPeriod(project, billingSettings).key === periodKey)
  }, [billingSettings, periodKey, periods, projects])
  const summary = getEarningsSummary(visibleProjects, profile.defaultPricePerLine)
  const chartWeekEnd = useMemo(() => {
    const endDate = new Date(chartWeekStart)
    endDate.setDate(chartWeekStart.getDate() + 6)
    endDate.setHours(23, 59, 59, 999)
    return endDate
  }, [chartWeekStart])
  const previousWeekStart = useMemo(() => {
    const date = new Date(chartWeekStart)
    date.setDate(chartWeekStart.getDate() - 7)
    return date
  }, [chartWeekStart])
  const previousWeekEnd = useMemo(() => {
    const date = new Date(chartWeekStart)
    date.setMilliseconds(-1)
    return date
  }, [chartWeekStart])
  const weeklyIncome = useMemo(() => {
    return projects.reduce(
      (days, project) => {
        const projectDate = parseProjectDate(project)
        if (projectDate < chartWeekStart || projectDate > chartWeekEnd) {
          return days
        }

        const dayIndex = Math.floor((startOfWeek(projectDate) - chartWeekStart) / 86400000)
        const calendarDayIndex = (projectDate.getDay() + 6) % 7
        const index = Number.isFinite(dayIndex) && dayIndex >= 0 ? calendarDayIndex : 0
        const earnings = getProjectEarnings(project, profile.defaultPricePerLine)
        days[index] += earnings.earnedIncome || earnings.expectedIncome
        return days
      },
      Array(7).fill(0),
    )
  }, [chartWeekEnd, chartWeekStart, profile.defaultPricePerLine, projects])
  const previousWeekIncome = useMemo(() => {
    return projects.reduce((total, project) => {
      const projectDate = parseProjectDate(project)
      if (projectDate < previousWeekStart || projectDate > previousWeekEnd) {
        return total
      }

      const earnings = getProjectEarnings(project, profile.defaultPricePerLine)
      return total + (earnings.earnedIncome || earnings.expectedIncome)
    }, 0)
  }, [previousWeekEnd, previousWeekStart, profile.defaultPricePerLine, projects])
  const weeklyTotal = weeklyIncome.reduce((total, value) => total + value, 0)
  const weeklyChange = previousWeekIncome > 0
    ? Math.round(((weeklyTotal - previousWeekIncome) / previousWeekIncome) * 100)
    : weeklyTotal > 0 ? 100 : 0
  const maxWeeklyIncome = Math.max(...weeklyIncome, 1)
  const chartBars = weeklyIncome.map((value) => ({
    amount: value,
    height: value > 0 ? Math.max(12, (value / maxWeeklyIncome) * 100) : 8,
  }))
  const weekLabels = profile.language === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['一', '二', '三', '四', '五', '六', '日']
  const today = new Date()
  const activeChartIndex = today >= chartWeekStart && today <= chartWeekEnd
    ? (today.getDay() + 6) % 7
    : Math.max(0, weeklyIncome.indexOf(Math.max(...weeklyIncome)))

  function moveChartWeek(delta) {
    setChartWeekStart((current) => {
      const nextDate = new Date(current)
      nextDate.setDate(current.getDate() + delta * 7)
      return startOfWeek(nextDate)
    })
  }

  function movePeriodMonth(delta) {
    setPeriodMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
    setPeriodKey('all')
  }

  function movePeriodYear(delta) {
    setPeriodMonth((current) => new Date(current.getFullYear() + delta, current.getMonth(), 1))
    setPeriodKey('all')
  }

  function handleChartTouchEnd(event) {
    if (touchStartX === null) {
      return
    }

    const deltaX = event.changedTouches[0].clientX - touchStartX
    setTouchStartX(null)

    if (Math.abs(deltaX) < 48) {
      return
    }

    moveChartWeek(deltaX > 0 ? -1 : 1)
  }

  function exportCsv() {
    const rows = [
      ['Sub Name', 'Total Lines', 'Completed', 'Price/Line', 'Earned Income', 'Expected Income'],
      ...visibleProjects.map((project) => {
        const earnings = getProjectEarnings(project, profile.defaultPricePerLine)
        return [
          project.fileName,
          earnings.total,
          earnings.done,
          earnings.pricePerLine.toFixed(2),
          earnings.earnedIncome.toFixed(2),
          earnings.expectedIncome.toFixed(2),
        ]
      }),
    ]
    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'pocketsub-earnings.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className={`page earnings-page ${profile.language === 'en' ? 'lang-en' : ''}`}>
      <header className="home-header app-title-row">
        <div>
          <p className="eyebrow">Earnings</p>
          <h1>{t('earningsTitle')}</h1>
        </div>
        <TabBar current="earnings" onNavigate={onNavigate} className="header-tab-bar" language={profile.language} />
        <button type="button" className="primary" onClick={exportCsv} disabled={!isLoggedIn}>CSV</button>
      </header>

      {!isLoggedIn ? (
        <section className="auth-card earnings-auth-card">
          <span className="field-label">{t('statsLocked')}</span>
          <h2>{t('loginForStats')}</h2>
          <p>{t('guestStatsHint')}</p>
          <button type="button" className="primary" onClick={() => onNavigate('account')}>
            {t('goLogin')}
          </button>
        </section>
      ) : null}

      {!isLoggedIn ? null : (
        <>

      <section className="period-panel">
        <div>
          <span className="field-label">{t('workPeriod')}</span>
          <p>
            {t('currentRule')}: {billingSettings.firstPeriodStart}-{billingSettings.firstPeriodEnd},
            {billingSettings.firstPeriodEnd + 1}-{billingSettings.firstPeriodStart - 1}
          </p>
        </div>
        <div className="period-browser">
          <button type="button" onClick={() => movePeriodYear(-1)}>{t('previousYear')}</button>
          <button type="button" onClick={() => movePeriodMonth(-1)}>‹</button>
          <strong>{new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(periodMonth)}</strong>
          <button type="button" onClick={() => movePeriodMonth(1)}>›</button>
          <button type="button" onClick={() => movePeriodYear(1)}>{t('nextYear')}</button>
        </div>
        <select value={periodKey} onChange={(event) => setPeriodKey(event.target.value)}>
          <option value="all">{t('allPeriodsThisMonth')}</option>
          {periods.map((period) => (
            <option key={period.key} value={period.key}>
              {period.label}
            </option>
          ))}
        </select>
      </section>

      <section className="metrics-grid">
        <div>
          <span className="field-label">{t('earnedIncome')}</span>
          <strong>{formatCurrency(summary.earnedIncome)}</strong>
        </div>
        <div>
          <span className="field-label">{t('expectedIncome')}</span>
          <strong>{formatCurrency(summary.expectedIncome)}</strong>
        </div>
        <div>
          <span className="field-label">{t('completedLines')}</span>
          <strong>{summary.completedLines}</strong>
        </div>
        <div>
          <span className="field-label">{t('totalLines')}</span>
          <strong>{summary.totalLines}</strong>
        </div>
      </section>

      <section className="chart-card">
        <div className="income-chart-header">
          <div>
            <p className="eyebrow">Income Tracker</p>
            <h2>{t('incomeTrend')}</h2>
            <span>{t('incomeTrendHelp')}</span>
          </div>
          <div className="chart-week-controls" aria-label="切换收入周">
            <button type="button" onClick={() => moveChartWeek(-1)}>‹</button>
            <span className="chart-period-pill">{formatWeekRange(chartWeekStart, locale)}</span>
            <button type="button" onClick={() => moveChartWeek(1)}>›</button>
          </div>
        </div>
        <div
          className="income-tracker"
          onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
          onTouchEnd={handleChartTouchEnd}
        >
          <div className="income-tracker__summary">
            <strong>{weeklyChange > 0 ? '+' : ''}{weeklyChange}%</strong>
            <p>{formatCurrency(weeklyTotal)} · {t('weekSwitchHint')}</p>
          </div>
          <div className="income-bars">
            {chartBars.map((bar, index) => (
              <div
                key={`${chartWeekStart.toISOString()}-${index}`}
                className={`income-bar ${index === activeChartIndex ? 'active' : ''}`}
              >
                {index === activeChartIndex ? (
                  <span className="income-tooltip">{formatCurrency(bar.amount)}</span>
                ) : null}
                <span className="income-stem" style={{ height: `${Math.max(42, bar.height)}%` }} />
                <span className="income-dot" />
                <span className="income-day">{weekLabels[index]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="earnings-table-card">
        <div className="section-title">
          <h2>{t('incomeDetails')}</h2>
          <span>Total {formatCurrency(summary.earnedIncome)}</span>
        </div>
        <div className="earnings-table">
          <div className="earnings-table__head">
            <span>Sub Name</span>
            <span>{t('completed')}</span>
            <span>¥ / line</span>
            <span>Earned</span>
            <span>Expected</span>
            <span>Period</span>
          </div>
          {visibleProjects.map((project) => {
            const earnings = getProjectEarnings(project, profile.defaultPricePerLine)
            const period = getProjectSettlementPeriod(project, billingSettings)

            return (
              <div className="earnings-table__row" key={project.projectId}>
                <strong>{project.fileName}</strong>
                <span>{earnings.done} / {earnings.total}</span>
                <label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={earnings.pricePerLine}
                    onChange={(event) => {
                      onUpdateProjectBilling(project.projectId, {
                        pricePerLine: event.target.value,
                      })
                    }}
                  />
                </label>
                <span>{formatCurrency(earnings.earnedIncome)}</span>
                <span>{formatCurrency(earnings.expectedIncome)}</span>
                <span>{period.label}</span>
              </div>
            )
          })}
        </div>
      {!visibleProjects.length ? (
          <div className="empty-state">
            <h2>{t('noPeriodProjects')}</h2>
            <p>{t('periodEmptyHint')}</p>
          </div>
        ) : null}
      </section>
        </>
      )}
    </main>
  )
}

export default EarningsPage
