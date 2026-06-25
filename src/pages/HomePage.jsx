import { useMemo, useRef, useState } from 'react'
import ProjectCard from '../components/ProjectCard'
import TabBar from '../components/TabBar'
import { parseSrt } from '../utils/parseSrt'
import { getScheduleSummary, parseDueDate } from '../utils/schedule'
import { getEarningsSummary, formatCurrency } from '../utils/earnings'
import { getLocale, getTranslator } from '../utils/i18n'

function HomePage({
  projects,
  profile,
  onImport,
  onOpenProject,
  onStartProject,
  onUpdateProjectTask,
  onDeleteProject,
  onNavigate,
  error,
}) {
  const [query, setQuery] = useState('')
  const [editingProject, setEditingProject] = useState(null)
  const [calendarMode, setCalendarMode] = useState('month')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [taskForm, setTaskForm] = useState({
    dueDate: '',
    priority: 'normal',
    note: '',
  })
  const fileInputRef = useRef(null)
  const t = getTranslator(profile?.language)
  const locale = getLocale(profile?.language)
  const settlementDays = useMemo(() => profile?.billingSettings?.settlementDays || [5, 20], [profile?.billingSettings?.settlementDays])
  const scheduleSummary = useMemo(() => getScheduleSummary(projects), [projects])
  const earningsSummary = useMemo(() => getEarningsSummary(projects), [projects])
  const calendarTitle = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: calendarMode === 'month' ? 'long' : undefined,
  }).format(calendarDate)

  const filteredProjects = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) {
      return projects
    }

    return projects.filter((project) => project.fileName.toLowerCase().includes(value))
  }, [projects, query])

  const calendarCells = useMemo(() => {
    if (calendarMode === 'year') {
      return Array.from({ length: 12 }, (_, index) => ({
        type: 'month',
        value: index,
        label: profile?.language === 'en' ? new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(calendarDate.getFullYear(), index, 1)) : `${index + 1}月`,
        projects: projects.filter((project) => {
          if (!project.dueDate) return false
          const dueDate = parseDueDate(project.dueDate)
          return dueDate.getFullYear() === calendarDate.getFullYear() && dueDate.getMonth() === index
        }),
      }))
    }

    const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1)
    const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate()
    const leadingEmptyDays = (firstDay.getDay() + 6) % 7
    const dayCells = [
      ...Array.from({ length: leadingEmptyDays }, (_, index) => ({ type: 'empty', value: `empty-${index}` })),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1
        const isToday =
          calendarDate.getFullYear() === new Date().getFullYear() &&
          calendarDate.getMonth() === new Date().getMonth() &&
          day === new Date().getDate()
        return {
          type: 'day',
          value: day,
          label: day,
          dateLabel: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day)),
          isSettlement: settlementDays.includes(day),
          isToday,
          projects: projects.filter((project) => {
            if (!project.dueDate) return false
            const dueDate = parseDueDate(project.dueDate)
            return (
              dueDate.getFullYear() === calendarDate.getFullYear() &&
              dueDate.getMonth() === calendarDate.getMonth() &&
              dueDate.getDate() === day
            )
          }),
        }
      }),
    ]
    const trailingEmptyDays = (7 - (dayCells.length % 7)) % 7
    return [
      ...dayCells,
      ...Array.from({ length: trailingEmptyDays }, (_, index) => ({ type: 'empty', value: `tail-${index}` })),
    ]
  }, [calendarDate, calendarMode, locale, profile?.language, projects, settlementDays])

  function moveCalendar(delta) {
    setCalendarDate((current) => {
      if (calendarMode === 'year') {
        const nextDate = new Date(current.getFullYear() + delta, 0, 1)
        return nextDate
      } else {
        const nextDate = new Date(current.getFullYear(), current.getMonth() + delta, 1)
        return nextDate
      }
    })
    setSelectedDay(null)
  }

  function setCalendarView(mode) {
    setCalendarMode(mode)
    setCalendarDate((current) => {
      if (mode === 'year') {
        return new Date(current.getFullYear(), 0, 1)
      }

      return new Date(current.getFullYear(), current.getMonth(), 1)
    })
    setSelectedDay(null)
  }

  function handleCalendarCellClick(cell) {
    if (cell.type === 'month') {
      setCalendarDate((current) => new Date(current.getFullYear(), cell.value, 1))
      setCalendarMode('month')
      setSelectedDay(null)
      return
    }

    if (cell.projects?.length || cell.isSettlement) {
      setSelectedDay(cell)
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    const text = await file.text()
    const subtitles = parseSrt(text)

    if (!subtitles.length) {
      onImport(null, '没有解析到有效的 SRT 字幕。')
      return
    }

    onImport({
      projectId: crypto.randomUUID(),
      fileName: file.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtitles,
      dueDate: '',
      priority: 'normal',
      note: '',
    })
  }

  function openTaskEditor(project) {
    setEditingProject(project)
    setTaskForm({
      dueDate: project.dueDate || '',
      priority: project.priority || 'normal',
      note: project.note || '',
    })
  }

  async function handleTaskSubmit(event) {
    event.preventDefault()

    if (!editingProject) {
      return
    }

    await onUpdateProjectTask(editingProject.projectId, taskForm)
    setEditingProject(null)
  }

  return (
    <main className={`page home-page ${profile?.language === 'en' ? 'lang-en' : ''}`}>
      <header className="home-header app-title-row">
        <div>
          <h1>PocketSub</h1>
        </div>
        <TabBar current="home" onNavigate={onNavigate} className="header-tab-bar" language={profile?.language} />
        <button type="button" className="primary" onClick={() => fileInputRef.current?.click()}>
          {t('import')}
        </button>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept=".srt,text/plain"
          onChange={handleFileChange}
        />
      </header>

      <label className="search-box">
        <span>{t('search')}</span>
        <input
          type="search"
          value={query}
          placeholder={t('searchProjects')}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {error ? <p className="notice error">{error}</p> : null}

      <section className="home-summary-grid">
        <div className="summary-card">
          <span className="field-label">{t('planSummary')}</span>
          <strong>{t('today')} {scheduleSummary.today}</strong>
          <p>{t('thisWeek')} {scheduleSummary.week} · {t('overdue')} {scheduleSummary.overdue}</p>
        </div>
        <div className="summary-card">
          <span className="field-label">{t('projectIncome')}</span>
          <strong>{formatCurrency(earningsSummary.earnedIncome)}</strong>
          <p>{t('expected')} {formatCurrency(earningsSummary.expectedIncome)}</p>
        </div>
      </section>

      <section className="calendar-card home-calendar">
        <div className="calendar-toolbar">
          <div>
            <h2>{t('calendar')}</h2>
            <p>{t('settlementDays')}: {settlementDays.map((day) => profile?.language === 'en' ? day : `${day}号`).join(profile?.language === 'en' ? ', ' : '、')}</p>
          </div>
          <div className="calendar-controls">
            <button type="button" onClick={() => moveCalendar(-1)}>‹</button>
            <strong>{calendarTitle}</strong>
            <button type="button" onClick={() => moveCalendar(1)}>›</button>
          </div>
        </div>
        <div className="calendar-mode-switch">
          <button type="button" className={calendarMode === 'month' ? 'active' : ''} onClick={() => setCalendarView('month')}>{t('month')}</button>
          <button type="button" className={calendarMode === 'year' ? 'active' : ''} onClick={() => setCalendarView('year')}>{t('year')}</button>
        </div>
        {calendarMode === 'month' ? (
          <div className="calendar-weekdays" aria-hidden="true">
            <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
          </div>
        ) : null}
        <div className={calendarMode === 'year' ? 'calendar-grid year-grid' : 'calendar-grid'}>
          {calendarCells.map((cell) => (
            <button
              type="button"
              key={`${cell.type}-${cell.value}`}
              className={[
                cell.type === 'empty' ? 'empty-day' : '',
                cell.isSettlement ? 'settlement-day' : '',
                cell.isToday ? 'today-day' : '',
                cell.projects?.length ? 'ddl-day' : '',
              ].join(' ')}
              title={cell.isSettlement ? '结算日' : undefined}
              aria-label={cell.isSettlement ? `${cell.label}，结算日` : String(cell.label || '')}
              disabled={cell.type === 'empty'}
              onClick={() => handleCalendarCellClick(cell)}
            >
              {cell.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>{t('recentProjects')}</h2>
          <span>{projects.length} {t('filesCount')}</span>
        </div>

        {filteredProjects.length ? (
          <div className="project-list">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.projectId}
                project={project}
                onOpen={onOpenProject}
                onEditTask={openTaskEditor}
                onDelete={onDeleteProject}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="file-icon large" aria-hidden="true">SRT</div>
            <h2>{t('noProjects')}</h2>
            <p>{t('importToStart')}</p>
            <button type="button" className="primary" onClick={() => fileInputRef.current?.click()}>
              {t('importSubtitles')}
            </button>
          </div>
        )}
      </section>

      {editingProject ? (
        <div className="sheet-backdrop" onClick={() => setEditingProject(null)}>
          <aside className="action-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" aria-hidden="true" />
            <header className="sheet-header">
              <div>
                <p className="eyebrow">{t('editPlan')}</p>
                <h2>{editingProject.fileName}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditingProject(null)}
              >
                x
              </button>
            </header>
            <form className="task-form" onSubmit={handleTaskSubmit}>
              <label>
                <span className="field-label">{t('dueDate')}</span>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) => {
                    setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                  }}
                />
              </label>
              <label>
                <span className="field-label">{t('priority')}</span>
                <select
                  value={taskForm.priority}
                  onChange={(event) => {
                    setTaskForm((current) => ({ ...current, priority: event.target.value }))
                  }}
                >
                  <option value="low">{t('low')}</option>
                  <option value="normal">{t('normal')}</option>
                  <option value="high">{t('high')}</option>
                </select>
              </label>
              <label>
                <span className="field-label">{t('note')}</span>
                <textarea
                  value={taskForm.note}
                  rows="3"
                  placeholder={profile?.language === 'en' ? 'Example: due Sunday' : '例如：周日前交'}
                  onChange={(event) => {
                    setTaskForm((current) => ({ ...current, note: event.target.value }))
                  }}
                />
              </label>
              <div className="task-form-actions">
                <button
                  type="button"
                  onClick={() => setTaskForm({ dueDate: '', priority: 'normal', note: '' })}
                >
                  {t('clear')}
                </button>
                <button type="submit" className="primary">{t('savePlan')}</button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {selectedDay ? (
        <div className="context-backdrop" onClick={() => setSelectedDay(null)}>
          <aside className="context-popover calendar-popover" onClick={(event) => event.stopPropagation()}>
            <header className="context-header">
              <div>
                <p className="eyebrow">{selectedDay.isSettlement ? t('settlementDays') : t('contextDeadline')}</p>
                <h2>{selectedDay.dateLabel || selectedDay.label}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelectedDay(null)}>x</button>
            </header>
            {selectedDay.projects?.length ? (
              <div className="context-list">
                {selectedDay.projects.map((project) => (
                  <div className="context-line calendar-project-line" key={project.projectId}>
                    <p>{project.fileName}</p>
                    <button type="button" className="primary" onClick={() => onStartProject(project.projectId)}>
                      {t('startTranslating')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{t('settlementNoSubs')}</p>
            )}
          </aside>
        </div>
      ) : null}
    </main>
  )
}

export default HomePage
