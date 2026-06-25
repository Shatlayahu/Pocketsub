import { getProgress } from '../utils/progress'
import { getTaskMeta } from '../utils/schedule'

function formatTime(value) {
  if (!value) {
    return '刚刚'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ProjectCard({ project, onOpen, onEditTask, onDelete }) {
  const { done, total } = getProgress(project.subtitles)
  const task = getTaskMeta(project)

  return (
    <article className="project-card" onClick={() => onOpen(project.projectId)}>
      <div className="file-icon" aria-hidden="true">SRT</div>
      <div className="project-card__body">
        <h3>{project.fileName}</h3>
        <p>
          {done} / {total} 行 · 截止 {project.dueDate ? task.dueLabel : '未设置'} ·
          {project.video ? ` 视频 ${project.video.name}` : ' 未绑定视频'}
        </p>
        <div className="mini-progress" aria-label={`完成率 ${task.percent}%`}>
          <span style={{ width: `${task.percent}%` }} />
        </div>
        <p>
          {task.statusLabel}
          {task.dailyTarget ? ` · 每日目标 ${task.dailyTarget} 条` : ''}
          {' · '}
          最后编辑 {formatTime(project.updatedAt)}
        </p>
      </div>
      <button
        type="button"
        className="project-action-button"
        onClick={(event) => {
          event.stopPropagation()
          onEditTask(project)
        }}
      >
        计划
      </button>
      <button
        type="button"
        className="icon-button danger"
        aria-label="删除项目"
        onClick={(event) => {
          event.stopPropagation()
          onDelete(project.projectId)
        }}
      >
        x
      </button>
    </article>
  )
}

export default ProjectCard
