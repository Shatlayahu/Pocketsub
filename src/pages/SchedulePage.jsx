import { Home } from 'lucide-react'
import { useState } from 'react'
import { getTaskMeta, groupProjectsByMonth, groupProjectsByWeek } from '../utils/schedule'

function TaskItem({ project, onOpenProject }) {
  const meta = getTaskMeta(project)

  return (
    <button
      type="button"
      className={`schedule-card ${meta.status}`}
      onClick={() => onOpenProject(project.projectId)}
    >
      <div className="schedule-card__title">
        <h3>{project.fileName}</h3>
        <span className={`task-badge ${meta.status}`}>{meta.statusLabel}</span>
      </div>
      <p>{meta.done} / {meta.total} 行，完成率 {meta.percent}%</p>
      <p>
        截止：{project.dueDate ? meta.dueLabel : '未设置'}
        {meta.status === 'overdue' ? `，已逾期 ${meta.overdueDays} 天` : ''}
      </p>
      <p>
        剩余 {meta.remainingLines} 条
        {meta.dailyTarget ? `，建议每天 ${meta.dailyTarget} 条` : ''}
      </p>
      {project.note ? <p>{project.note}</p> : null}
    </button>
  )
}

function SchedulePage({ projects, onHome, onOpenProject }) {
  const [view, setView] = useState('week')
  const weekGroups = groupProjectsByWeek(projects)
  const monthGroups = groupProjectsByMonth(projects)
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7
  const calendarCells = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const ddlDays = new Set(
    projects
      .map((project) => {
        if (!project.dueDate) return null
        const dueDate = new Date(project.dueDate)
        if (dueDate.getFullYear() !== today.getFullYear() || dueDate.getMonth() !== today.getMonth()) {
          return null
        }
        return dueDate.getDate()
      })
      .filter(Boolean),
  )
  const taskStats = projects.reduce(
    (stats, project) => {
      const meta = getTaskMeta(project)
      if (meta.daysLeft === 0 && meta.status !== 'done') stats.today += 1
      if (meta.daysLeft >= 0 && meta.daysLeft <= 6 && meta.status !== 'done') stats.week += 1
      if (meta.status === 'overdue') stats.overdue += 1
      if (meta.dailyTarget) stats.dailyTarget += meta.dailyTarget
      return stats
    },
    { today: 0, week: 0, overdue: 0, dailyTarget: 0 },
  )

  return (
    <main className="page schedule-page">
      <header className="top-bar">
        <button type="button" className="nav-icon-button" aria-label="返回首页" onClick={onHome}>
          <Home size={19} strokeWidth={2.2} />
        </button>
        <div>
          <p className="eyebrow">Schedule</p>
          <h1>计划</h1>
        </div>
        <span />
      </header>

      <section className="schedule-list">
        <section className="metrics-grid schedule-metrics">
          <div><span className="field-label">今天到期</span><strong>{taskStats.today}</strong></div>
          <div><span className="field-label">本周到期</span><strong>{taskStats.week}</strong></div>
          <div><span className="field-label">已逾期</span><strong>{taskStats.overdue}</strong></div>
          <div><span className="field-label">每日目标</span><strong>{taskStats.dailyTarget}</strong></div>
        </section>

        <section className="calendar-card">
          <div className="section-title">
            <h2>结算日历</h2>
            <span>5号 / 20号</span>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
          </div>
          <div className="calendar-grid" aria-hidden="true">
            {calendarCells.map((day, index) => (
              <span
                key={`${day || 'empty'}-${index}`}
                className={[
                  day === 5 || day === 20 ? 'settlement-day' : '',
                  ddlDays.has(day) ? 'ddl-day' : '',
                  day ? '' : 'empty-day',
                ].join(' ')}
              >
                {day}
              </span>
            ))}
          </div>
        </section>

        <div className="section-title schedule-view-title">
          <h2>{view === 'week' ? '按周' : '按月'}</h2>
          <div className="segmented compact">
            <button type="button" className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>按周</button>
            <button type="button" className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>按月</button>
          </div>
        </div>

        {(view === 'week' ? weekGroups : monthGroups).length ? (
          (view === 'week' ? weekGroups : monthGroups).map((group) => (
            <section className="schedule-section" key={group.key}>
              <div className="week-heading">
                <h3>{group.title}</h3>
                <span>{group.projects.length} 个字幕</span>
              </div>
              {group.projects.map((project) => (
                <TaskItem
                  key={project.projectId}
                  project={project}
                  onOpenProject={onOpenProject}
                />
              ))}
            </section>
          ))
        ) : (
          <div className="empty-state">
            <h2>暂无已排期任务</h2>
            <p>回到首页，在文件卡片上点击“计划”设置截止日期。</p>
          </div>
        )}

      </section>
    </main>
  )
}

export default SchedulePage
