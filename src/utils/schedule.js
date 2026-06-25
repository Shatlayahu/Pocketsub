import { getProgress } from './progress'

function startOfDay(date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

export function parseDueDate(value) {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatMonth(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
  }).format(date)
}

function formatWeekRange(startDate) {
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)

  const formatter = new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  })

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
}

export function getTaskMeta(project, today = new Date()) {
  const { done, total, percent } = getProgress(project.subtitles)
  const remainingLines = Math.max(0, total - done)
  const dueDate = parseDueDate(project.dueDate)

  if (!dueDate) {
    return {
      done,
      total,
      percent,
      remainingLines,
      status: done === total && total > 0 ? 'done' : 'todo',
      statusLabel: done === total && total > 0 ? '已完成' : '未排期',
      dueLabel: '未设置截止',
      daysLeft: null,
      dailyTarget: null,
      overdueDays: 0,
    }
  }

  const todayStart = startOfDay(today)
  const dueStart = startOfDay(dueDate)
  const daysLeft = Math.ceil((dueStart - todayStart) / 86400000)
  const isDone = total > 0 && done === total
  const isOverdue = !isDone && daysLeft < 0
  const dailyTarget = isDone ? 0 : Math.ceil(remainingLines / Math.max(daysLeft + 1, 1))
  let status = 'todo'

  if (isDone) {
    status = 'done'
  } else if (isOverdue) {
    status = 'overdue'
  } else if (done > 0) {
    status = 'in_progress'
  }

  return {
    done,
    total,
    percent,
    remainingLines,
    status,
    statusLabel: {
      todo: '未开始',
      in_progress: '进行中',
      done: '已完成',
      overdue: '已逾期',
    }[status],
    dueLabel: new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
    }).format(dueDate),
    daysLeft,
    dailyTarget,
    overdueDays: isOverdue ? Math.abs(daysLeft) : 0,
  }
}

export function getScheduleSummary(projects) {
  return projects.reduce(
    (summary, project) => {
      const meta = getTaskMeta(project)

      if (!project.dueDate) {
        return summary
      }

      if (meta.status === 'overdue') {
        summary.overdue += 1
      }

      if (meta.daysLeft === 0 && meta.status !== 'done') {
        summary.today += 1
      }

      if (meta.daysLeft >= 0 && meta.daysLeft <= 6 && meta.status !== 'done') {
        summary.week += 1
      }

      return summary
    },
    { today: 0, week: 0, overdue: 0 },
  )
}

export function groupProjectsByDueDate(projects) {
  const groups = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
    later: [],
    unscheduled: [],
    done: [],
  }

  projects.forEach((project) => {
    const meta = getTaskMeta(project)

    if (meta.status === 'done') {
      groups.done.push(project)
      return
    }

    if (!project.dueDate) {
      groups.unscheduled.push(project)
      return
    }

    if (meta.status === 'overdue') {
      groups.overdue.push(project)
    } else if (meta.daysLeft === 0) {
      groups.today.push(project)
    } else if (meta.daysLeft === 1) {
      groups.tomorrow.push(project)
    } else if (meta.daysLeft <= 6) {
      groups.week.push(project)
    } else {
      groups.later.push(project)
    }
  })

  return groups
}

export function groupProjectsByWeek(projects, today = new Date()) {
  const todayStart = startOfDay(today)
  const groups = new Map()

  projects.forEach((project) => {
    const meta = getTaskMeta(project, today)

    if (!project.dueDate || meta.status === 'done') {
      return
    }

    let key = 'overdue'
    let title = '已逾期'

    if (meta.status !== 'overdue') {
      const dueDate = startOfDay(parseDueDate(project.dueDate))
      const weekIndex = Math.floor((dueDate - todayStart) / 86400000 / 7)
      const weekStart = new Date(todayStart)
      weekStart.setDate(todayStart.getDate() + weekIndex * 7)
      key = `week-${weekIndex}`
      title = weekIndex === 0 ? '本周' : `第 ${weekIndex + 1} 周`
      title = `${title} ${formatWeekRange(weekStart)}`
    }

    if (!groups.has(key)) {
      groups.set(key, { key, title, projects: [] })
    }

    groups.get(key).projects.push(project)
  })

  return Array.from(groups.values())
}

export function groupProjectsByMonth(projects) {
  const groups = new Map()

  projects.forEach((project) => {
    const meta = getTaskMeta(project)

    if (!project.dueDate || meta.status === 'done') {
      return
    }

    const dueDate = parseDueDate(project.dueDate)
    const key = `${dueDate.getFullYear()}-${dueDate.getMonth() + 1}`

    if (!groups.has(key)) {
      groups.set(key, { key, title: formatMonth(dueDate), projects: [] })
    }

    groups.get(key).projects.push(project)
  })

  return Array.from(groups.values())
}
