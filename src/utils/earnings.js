import { getProgress } from './progress'

export const DEFAULT_BILLING_SETTINGS = {
  firstPeriodStart: 6,
  firstPeriodEnd: 20,
  settlementDays: [5, 20],
}

function normalizeDay(value, fallback) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return fallback
  }

  return Math.min(28, Math.max(1, Math.round(numberValue)))
}

export function normalizeBillingSettings(settings = {}) {
  const firstPeriodStart = Math.min(27, Math.max(2, normalizeDay(settings.firstPeriodStart, DEFAULT_BILLING_SETTINGS.firstPeriodStart)))
  let firstPeriodEnd = normalizeDay(settings.firstPeriodEnd, DEFAULT_BILLING_SETTINGS.firstPeriodEnd)

  if (firstPeriodEnd <= firstPeriodStart) {
    firstPeriodEnd = Math.min(28, firstPeriodStart + 1)
  }

  const settlementDays = Array.isArray(settings.settlementDays) && settings.settlementDays.length >= 2
    ? settings.settlementDays
    : DEFAULT_BILLING_SETTINGS.settlementDays

  return {
    firstPeriodStart,
    firstPeriodEnd,
    settlementDays: [
      normalizeDay(settlementDays[0], DEFAULT_BILLING_SETTINGS.settlementDays[0]),
      normalizeDay(settlementDays[1], DEFAULT_BILLING_SETTINGS.settlementDays[1]),
    ],
  }
}

export function getProjectEarnings(project, defaultPricePerLine = 0.8) {
  const { done, total } = getProgress(project.subtitles)
  const pricePerLine = Number(project.pricePerLine ?? defaultPricePerLine) || 0
  const expectedIncome = total * pricePerLine
  const earnedIncome = done * pricePerLine

  return {
    done,
    total,
    pricePerLine,
    expectedIncome,
    earnedIncome,
  }
}

export function getEarningsSummary(projects, defaultPricePerLine = 0.8) {
  return projects.reduce(
    (summary, project) => {
      const earnings = getProjectEarnings(project, defaultPricePerLine)

      return {
        totalLines: summary.totalLines + earnings.total,
        completedLines: summary.completedLines + earnings.done,
        expectedIncome: summary.expectedIncome + earnings.expectedIncome,
        earnedIncome: summary.earnedIncome + earnings.earnedIncome,
      }
    },
    {
      totalLines: 0,
      completedLines: 0,
      expectedIncome: 0,
      earnedIncome: 0,
    },
  )
}

function dateFromProject(project) {
  return new Date(project.finishedAt || project.dueDate || project.updatedAt || project.createdAt)
}

function formatPeriodDate(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPeriodFromDate(date, settings = DEFAULT_BILLING_SETTINGS) {
  const billingSettings = normalizeBillingSettings(settings)
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  let start = null
  let end = null

  if (day >= billingSettings.firstPeriodStart && day <= billingSettings.firstPeriodEnd) {
    start = new Date(year, month, billingSettings.firstPeriodStart)
    end = new Date(year, month, billingSettings.firstPeriodEnd)
  } else if (day > billingSettings.firstPeriodEnd) {
    start = new Date(year, month, billingSettings.firstPeriodEnd + 1)
    end = new Date(year, month + 1, billingSettings.firstPeriodStart - 1)
  } else {
    start = new Date(year, month - 1, billingSettings.firstPeriodEnd + 1)
    end = new Date(year, month, billingSettings.firstPeriodStart - 1)
  }

  return {
    key: `${formatDateKey(start)}_${formatDateKey(end)}`,
    label: `${formatPeriodDate(start)} - ${formatPeriodDate(end)}`,
    start,
    end,
  }
}

export function getProjectSettlementPeriod(project, settings) {
  return getPeriodFromDate(dateFromProject(project), settings)
}

export function getRecentSettlementPeriods(today = new Date(), settings = DEFAULT_BILLING_SETTINGS) {
  const periods = []
  const cursor = new Date(today)

  for (let index = 0; index < 6; index += 1) {
    const period = getPeriodFromDate(cursor, settings)
    periods.push(period)
    cursor.setTime(period.start.getTime())
    cursor.setDate(cursor.getDate() - 1)
  }

  return periods
}

export function getSettlementPeriodsForMonth(date = new Date(), settings = DEFAULT_BILLING_SETTINGS) {
  const billingSettings = normalizeBillingSettings(settings)
  const year = date.getFullYear()
  const month = date.getMonth()
  const samples = [
    new Date(year, month, 1),
    new Date(year, month, billingSettings.firstPeriodStart),
    new Date(year, month, billingSettings.firstPeriodEnd + 1),
  ]
  const periods = samples.map((sample) => getPeriodFromDate(sample, billingSettings))
  const uniquePeriods = new Map(periods.map((period) => [period.key, period]))

  return Array.from(uniquePeriods.values()).sort((a, b) => a.start - b.start)
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(value)
}
