import { DEFAULT_BILLING_SETTINGS, normalizeBillingSettings } from './earnings'

const DB_NAME = 'pocketsub-db'
const STORE_NAME = 'projects'
const SETTINGS_STORE = 'settings'
const PROFILE_KEY = 'profile'
const DB_VERSION = 2

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' })
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(mode, action, storeName = STORE_NAME) {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const result = action(store)

    transaction.oncomplete = () => resolve(result?.result ?? result)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  }).finally(() => db.close())
}

async function mutateProject(projectId, mutator) {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(projectId)
    let nextProject = null

    getRequest.onsuccess = () => {
      const project = getRequest.result

      if (!project) {
        reject(new Error('Project not found'))
        transaction.abort()
        return
      }

      nextProject = {
        ...mutator(project),
        updatedAt: new Date().toISOString(),
      }
      store.put(nextProject)
    }

    transaction.oncomplete = () => resolve(nextProject)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  }).finally(() => db.close())
}

export async function saveProject(project) {
  const now = new Date().toISOString()
  const nextProject = {
    ...project,
    updatedAt: now,
    createdAt: project.createdAt || now,
  }

  await withStore('readwrite', (store) => store.put(nextProject))
  return nextProject
}

export async function getProject(projectId) {
  return withStore('readonly', (store) => store.get(projectId))
}

export async function getAllProjects() {
  const projects = await withStore('readonly', (store) => store.getAll())
  return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export async function deleteProject(projectId) {
  return withStore('readwrite', (store) => store.delete(projectId))
}

export async function updateSubtitle(projectId, subtitleId, translation) {
  return mutateProject(projectId, (project) => {
    const subtitles = project.subtitles.map((line) => {
      if (line.id !== subtitleId) {
        return line
      }

      const nextTranslation = translation

      return {
        ...line,
        translation: nextTranslation,
        status: nextTranslation.trim() ? 'done' : 'todo',
      }
    })

    return { ...project, subtitles }
  })
}

export async function updateSubtitleTiming(projectId, subtitleId, timing) {
  return mutateProject(projectId, (project) => {
    const subtitles = project.subtitles.map((line) => {
      if (line.id !== subtitleId) {
        return line
      }

      return {
        ...line,
        ...timing,
      }
    })

    return { ...project, subtitles }
  })
}

export async function updateProjectTask(projectId, task) {
  const project = await getProject(projectId)

  if (!project) {
    throw new Error('Project not found')
  }

  return saveProject({
    ...project,
    dueDate: task.dueDate || '',
    priority: task.priority || 'normal',
    note: task.note || '',
  })
}

export async function updateProjectBilling(projectId, billing) {
  return mutateProject(projectId, (project) => ({
    ...project,
    pricePerLine: Number(billing.pricePerLine) || 0,
  }))
}

export async function getProfile() {
  const profile = await withStore('readonly', (store) => store.get(PROFILE_KEY), SETTINGS_STORE)

  return {
    userName: profile?.userName || '',
    email: profile?.email || '',
    defaultPricePerLine: profile?.defaultPricePerLine ?? 0.8,
    billingSettings: normalizeBillingSettings(profile?.billingSettings || DEFAULT_BILLING_SETTINGS),
    language: profile?.language || 'zh-CN',
    compactMode: Boolean(profile?.compactMode),
  }
}

export async function saveProfile(profile) {
  const nextProfile = {
    key: PROFILE_KEY,
    userName: profile.userName || '',
    email: profile.email || '',
    defaultPricePerLine: Number(profile.defaultPricePerLine) || 0,
    billingSettings: normalizeBillingSettings(profile.billingSettings || DEFAULT_BILLING_SETTINGS),
    language: profile.language || 'zh-CN',
    compactMode: Boolean(profile.compactMode),
  }

  await withStore('readwrite', (store) => store.put(nextProfile), SETTINGS_STORE)

  return nextProfile
}

export async function attachVideo(projectId, videoFile) {
  const project = await getProject(projectId)

  if (!project) {
    throw new Error('Project not found')
  }

  return saveProject({
    ...project,
    video: {
      source: 'file',
      name: videoFile.name,
      type: videoFile.type || 'video/mp4',
      size: videoFile.size,
      blob: videoFile,
    },
  })
}

export async function attachYouTubeVideo(projectId, youtube) {
  const project = await getProject(projectId)

  if (!project) {
    throw new Error('Project not found')
  }

  return saveProject({
    ...project,
    video: {
      source: 'youtube',
      name: youtube.title || 'YouTube video',
      url: youtube.url,
      videoId: youtube.videoId,
    },
  })
}
