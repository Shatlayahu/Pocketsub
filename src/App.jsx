import { useCallback, useEffect, useMemo, useState } from 'react'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import OverviewPage from './pages/OverviewPage'
import EarningsPage from './pages/EarningsPage'
import AccountPage from './pages/AccountPage'
import {
  deleteProject,
  attachVideo,
  attachYouTubeVideo,
  getAllProjects,
  getProfile,
  saveProject,
  saveProfile,
  updateSubtitle,
  updateSubtitleTiming,
  updateProjectTask,
  updateProjectBilling,
} from './utils/db'
import { DEFAULT_BILLING_SETTINGS, normalizeBillingSettings } from './utils/earnings'
import './styles/app.css'

const AUTH_KEY = 'pocketsub-auth'
const DEFAULT_PROFILE = {
  userName: '',
  email: '',
  defaultPricePerLine: 0.8,
  billingSettings: DEFAULT_BILLING_SETTINGS,
  language: 'zh-CN',
  compactMode: false,
}

function App() {
  const [projects, setProjects] = useState([])
  const [route, setRoute] = useState({ name: 'home' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem(AUTH_KEY) === 'true')
  const [profile, setProfile] = useState(DEFAULT_PROFILE)

  const activeProject = useMemo(() => {
    return projects.find((project) => project.projectId === route.projectId)
  }, [projects, route.projectId])

  const pendingDeleteProject = useMemo(() => {
    return projects.find((project) => project.projectId === pendingDeleteId)
  }, [pendingDeleteId, projects])

  const refreshProjects = useCallback(async () => {
    if (!isLoggedIn) {
      return
    }

    const allProjects = await getAllProjects()
    setProjects(allProjects)
  }, [isLoggedIn])

  useEffect(() => {
    setLoading(true)

    if (!isLoggedIn) {
      setProjects([])
      setProfile(DEFAULT_PROFILE)
      setLoading(false)
      return
    }

    Promise.all([refreshProjects(), getProfile().then(setProfile)])
      .catch(() => setError('读取项目失败，请稍后重试。'))
      .finally(() => setLoading(false))
  }, [isLoggedIn, refreshProjects])

  function updateProjectInMemory(projectId, updater, shouldSort = false) {
    setProjects((currentProjects) => {
      const nextProjects = currentProjects.map((project) => {
        if (project.projectId !== projectId) {
          return project
        }

        return {
          ...updater(project),
          updatedAt: new Date().toISOString(),
        }
      })

      if (!shouldSort) {
        return nextProjects
      }

      return nextProjects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    })
  }

  async function handleImport(project, importError) {
    setError(importError || '')

    if (!project) {
      return
    }

    const nextProject = {
      ...project,
      pricePerLine: project.pricePerLine ?? profile.defaultPricePerLine,
    }

    if (!isLoggedIn) {
      setProjects((currentProjects) => [nextProject, ...currentProjects])
      setRoute({ name: 'overview', projectId: nextProject.projectId })
      return
    }

    const savedProject = await saveProject(nextProject)
    await refreshProjects()
    setRoute({ name: 'overview', projectId: savedProject.projectId })
  }

  async function confirmDeleteProject() {
    if (!pendingDeleteProject) {
      return
    }

    if (isLoggedIn) {
      await deleteProject(pendingDeleteProject.projectId)
      await refreshProjects()
    } else {
      setProjects((currentProjects) => {
        return currentProjects.filter((project) => project.projectId !== pendingDeleteProject.projectId)
      })
    }

    if (route.projectId === pendingDeleteProject.projectId) {
      setRoute({ name: 'home' })
    }

    setPendingDeleteId('')
  }

  const handleUpdateSubtitle = useCallback(
    async (subtitleId, translation) => {
      if (!activeProject) {
        return
      }

      if (!isLoggedIn) {
        updateProjectInMemory(activeProject.projectId, (project) => ({
          ...project,
          subtitles: project.subtitles.map((line) => {
            if (line.id !== subtitleId) {
              return line
            }

            return {
              ...line,
              translation,
              status: translation.trim() ? 'done' : 'todo',
            }
          }),
        }), true)
        return
      }

      const updatedProject = await updateSubtitle(
        activeProject.projectId,
        subtitleId,
        translation,
      )

      setProjects((currentProjects) => {
        return currentProjects
          .map((project) => {
            if (project.projectId === updatedProject.projectId) {
              return updatedProject
            }

            return project
          })
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      })
    },
    [activeProject, isLoggedIn],
  )

  const handleUpdateSubtitleTiming = useCallback(
    async (subtitleId, timing) => {
      if (!activeProject) {
        return
      }

      const projectId = activeProject.projectId

      if (!isLoggedIn) {
        updateProjectInMemory(projectId, (project) => ({
          ...project,
          subtitles: project.subtitles.map((line) => {
            if (line.id !== subtitleId) {
              return line
            }

            return {
              ...line,
              ...timing,
            }
          }),
        }))
        return
      }

      setProjects((currentProjects) => {
        return currentProjects.map((project) => {
          if (project.projectId !== projectId) {
            return project
          }

          return {
            ...project,
            updatedAt: new Date().toISOString(),
            subtitles: project.subtitles.map((line) => {
              if (line.id !== subtitleId) {
                return line
              }

              return {
                ...line,
                ...timing,
              }
            }),
          }
        })
      })

      const updatedProject = await updateSubtitleTiming(
        projectId,
        subtitleId,
        timing,
      )

      setProjects((currentProjects) => {
        return currentProjects
          .map((project) => {
            if (project.projectId === updatedProject.projectId) {
              return updatedProject
            }

            return project
          })
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      })
    },
    [activeProject, isLoggedIn],
  )

  const handleAttachVideo = useCallback(
    async (videoFile) => {
      if (!activeProject) {
        return
      }

      if (!isLoggedIn) {
        updateProjectInMemory(activeProject.projectId, (project) => ({
          ...project,
          video: {
            source: 'file',
            name: videoFile.name,
            type: videoFile.type || 'video/mp4',
            size: videoFile.size,
            blob: videoFile,
          },
        }))
        return
      }

      const updatedProject = await attachVideo(activeProject.projectId, videoFile)

      setProjects((currentProjects) => {
        return currentProjects.map((project) => {
          if (project.projectId === updatedProject.projectId) {
            return updatedProject
          }

          return project
        })
      })
    },
    [activeProject, isLoggedIn],
  )

  const handleAttachYouTubeVideo = useCallback(
    async (youtube) => {
      if (!activeProject) {
        return
      }

      if (!isLoggedIn) {
        updateProjectInMemory(activeProject.projectId, (project) => ({
          ...project,
          video: {
            source: 'youtube',
            name: youtube.title || 'YouTube video',
            url: youtube.url,
            videoId: youtube.videoId,
          },
        }))
        return
      }

      const updatedProject = await attachYouTubeVideo(activeProject.projectId, youtube)

      setProjects((currentProjects) => {
        return currentProjects.map((project) => {
          if (project.projectId === updatedProject.projectId) {
            return updatedProject
          }

          return project
        })
      })
    },
    [activeProject, isLoggedIn],
  )

  const handleUpdateProjectTask = useCallback(
    async (task) => {
      if (!activeProject) {
        return
      }

      if (!isLoggedIn) {
        updateProjectInMemory(activeProject.projectId, (project) => ({
          ...project,
          dueDate: task.dueDate || '',
          priority: task.priority || 'normal',
          note: task.note || '',
        }))
        return
      }

      const updatedProject = await updateProjectTask(activeProject.projectId, task)

      setProjects((currentProjects) => {
        return currentProjects.map((project) => {
          if (project.projectId === updatedProject.projectId) {
            return updatedProject
          }

          return project
        })
      })
    },
    [activeProject, isLoggedIn],
  )

  const handleUpdateProjectTaskById = useCallback(async (projectId, task) => {
    if (!isLoggedIn) {
      updateProjectInMemory(projectId, (project) => ({
        ...project,
        dueDate: task.dueDate || '',
        priority: task.priority || 'normal',
        note: task.note || '',
      }))
      return
    }

    const updatedProject = await updateProjectTask(projectId, task)

    setProjects((currentProjects) => {
      return currentProjects.map((project) => {
        if (project.projectId === updatedProject.projectId) {
          return updatedProject
        }

        return project
      })
    })
  }, [isLoggedIn])

  const handleUpdateProjectBilling = useCallback(async (projectId, billing) => {
    if (!isLoggedIn) {
      updateProjectInMemory(projectId, (project) => ({
        ...project,
        pricePerLine: Number(billing.pricePerLine) || 0,
      }))
      return
    }

    const updatedProject = await updateProjectBilling(projectId, billing)

    setProjects((currentProjects) => {
      return currentProjects.map((project) => {
        if (project.projectId === updatedProject.projectId) {
          return updatedProject
        }

        return project
      })
    })
  }, [isLoggedIn])

  const handleSaveProfile = useCallback(async (nextProfile) => {
    if (!isLoggedIn) {
      setProfile(nextProfile)
      return
    }

    setProfile(nextProfile)
    const savedProfile = await saveProfile(nextProfile)
    setProfile(savedProfile)
  }, [isLoggedIn])

  const handleLogin = useCallback(async (loginProfile) => {
    const nextProfile = {
      userName: loginProfile.userName || 'User',
      email: loginProfile.email || profile.email || '',
      defaultPricePerLine: Number(loginProfile.defaultPricePerLine) || profile.defaultPricePerLine || DEFAULT_PROFILE.defaultPricePerLine,
      billingSettings: normalizeBillingSettings(profile.billingSettings),
      language: profile.language || DEFAULT_PROFILE.language,
      compactMode: Boolean(profile.compactMode),
    }

    await saveProfile(nextProfile)
    await Promise.all(projects.map((project) => saveProject({
      ...project,
      pricePerLine: project.pricePerLine ?? nextProfile.defaultPricePerLine,
    })))
    localStorage.setItem(AUTH_KEY, 'true')
    setProfile(nextProfile)
    setIsLoggedIn(true)
  }, [profile.billingSettings, profile.compactMode, profile.defaultPricePerLine, profile.email, profile.language, projects])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY)
    setIsLoggedIn(false)
    setProjects([])
    setProfile(DEFAULT_PROFILE)
    setRoute({ name: 'home' })
  }, [])

  if (loading) {
    return (
      <main className="page centered-page">
        <p className="muted">正在读取本地字幕项目...</p>
      </main>
    )
  }

  if (route.name === 'editor' && activeProject) {
    return (
      <EditorPage
        project={activeProject}
        language={profile.language}
        initialIndex={route.index || 0}
        onHome={() => setRoute({ name: 'home' })}
        onBack={() => setRoute({ name: 'overview', projectId: activeProject.projectId })}
        onUpdateSubtitle={handleUpdateSubtitle}
        onUpdateSubtitleTiming={handleUpdateSubtitleTiming}
        onUpdateProjectTask={handleUpdateProjectTask}
        onAttachVideo={handleAttachVideo}
        onAttachYouTubeVideo={handleAttachYouTubeVideo}
      />
    )
  }

  if (route.name === 'overview' && activeProject) {
    return (
      <OverviewPage
        project={activeProject}
        language={profile.language}
        onHome={() => setRoute({ name: 'home' })}
        onBack={() => setRoute({ name: 'editor', projectId: activeProject.projectId, index: 0 })}
        onAttachVideo={handleAttachVideo}
        onAttachYouTubeVideo={handleAttachYouTubeVideo}
        onSelectLine={(index) => {
          setRoute({ name: 'editor', projectId: activeProject.projectId, index })
        }}
      />
    )
  }

  if (route.name === 'earnings') {
    return (
      <EarningsPage
        projects={projects}
        profile={profile}
        isLoggedIn={isLoggedIn}
        onUpdateProjectBilling={handleUpdateProjectBilling}
        onLogin={handleLogin}
        onNavigate={(name) => setRoute({ name })}
      />
    )
  }

  if (route.name === 'account') {
    return (
      <AccountPage
        projects={projects}
        profile={profile}
        isLoggedIn={isLoggedIn}
        onSaveProfile={handleSaveProfile}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onNavigate={(name) => setRoute({ name })}
      />
    )
  }

  return (
    <>
      <HomePage
        projects={projects}
        profile={profile}
        error={error}
        onImport={handleImport}
        onOpenProject={(projectId) => setRoute({ name: 'overview', projectId })}
        onStartProject={(projectId) => setRoute({ name: 'editor', projectId, index: 0 })}
        onUpdateProjectTask={handleUpdateProjectTaskById}
        onDeleteProject={setPendingDeleteId}
        onNavigate={(name) => setRoute({ name })}
      />
      {pendingDeleteProject ? (
        <div className="sheet-backdrop" onClick={() => setPendingDeleteId('')}>
          <aside className="delete-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" aria-hidden="true" />
            <div className="delete-sheet__icon" aria-hidden="true">!</div>
            <h2>删除这个项目？</h2>
            <p>
              {pendingDeleteProject.fileName} 会从项目列表中移除，
              翻译内容和视频绑定也会一起删除。
            </p>
            <div className="delete-actions">
              <button type="button" onClick={() => setPendingDeleteId('')}>
                取消
              </button>
              <button type="button" className="danger-button" onClick={confirmDeleteProject}>
                删除
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}

export default App
