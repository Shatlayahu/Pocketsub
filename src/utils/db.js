import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore'
import { firestore, isFirebaseConfigured } from '../firebase/firebase'
import { DEFAULT_BILLING_SETTINGS, normalizeBillingSettings } from './earnings'
import { getProgress } from './progress'

const DB_NAME = 'pocketsub-db'
const PROJECT_STORE = 'projects'
const SETTINGS_STORE = 'settings'
const VIDEO_STORE = 'videos'
const PROFILE_KEY = 'profile'
const DB_VERSION = 3

let currentUserId = ''

export function setCurrentUserId(userId) {
  currentUserId = userId || ''
}

function hasCloudUser() {
  return Boolean(isFirebaseConfigured && firestore && currentUserId)
}

function userDocRef() {
  if (!hasCloudUser()) {
    throw new Error('Firestore user is not ready.')
  }

  return doc(firestore, 'users', currentUserId)
}

function projectDocRef(projectId) {
  return doc(firestore, 'users', currentUserId, 'projects', projectId)
}

function projectsCollectionRef() {
  return collection(firestore, 'users', currentUserId, 'projects')
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: 'projectId' })
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE, { keyPath: 'projectId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(mode, action, storeName = PROJECT_STORE) {
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

function sanitizeVideo(video) {
  if (!video) {
    return null
  }

  if (video.source === 'file') {
    return {
      source: 'file',
      name: video.name,
      type: video.type || 'video/mp4',
      size: video.size || 0,
      savedLocally: true,
    }
  }

  return {
    source: 'youtube',
    name: video.name || 'YouTube video',
    url: video.url,
    videoId: video.videoId,
  }
}

function getProjectStats(project) {
  const progress = getProgress(project.subtitles || [])
  const status = progress.total > 0 && progress.done === progress.total
    ? 'done'
    : progress.done > 0 ? 'in_progress' : 'todo'

  return {
    totalLines: progress.total,
    completedLines: progress.done,
    status,
    finishedAt: status === 'done' ? project.finishedAt || new Date().toISOString() : project.finishedAt || '',
  }
}

function normalizeProjectForCloud(project) {
  const now = new Date().toISOString()
  const stats = getProjectStats(project)

  return {
    ...project,
    ...stats,
    video: sanitizeVideo(project.video),
    pricePerLine: Number(project.pricePerLine) || 0,
    dueDate: project.dueDate || '',
    priority: project.priority || 'normal',
    note: project.note || '',
    updatedAt: now,
    createdAt: project.createdAt || now,
  }
}

async function getLocalVideo(projectId) {
  const video = await withStore('readonly', (store) => store.get(projectId), VIDEO_STORE)

  if (!video?.blob) {
    return null
  }

  return {
    source: 'file',
    name: video.name,
    type: video.type || 'video/mp4',
    size: video.size || 0,
    blob: video.blob,
  }
}

async function saveLocalVideo(projectId, videoFile) {
  await withStore('readwrite', (store) => store.put({
    projectId,
    name: videoFile.name,
    type: videoFile.type || 'video/mp4',
    size: videoFile.size,
    blob: videoFile,
    savedAt: new Date().toISOString(),
  }), VIDEO_STORE)
}

async function deleteLocalVideo(projectId) {
  await withStore('readwrite', (store) => store.delete(projectId), VIDEO_STORE)
}

async function mergeLocalVideo(project) {
  if (project.video?.source !== 'file') {
    return project
  }

  const localVideo = await getLocalVideo(project.projectId)

  return {
    ...project,
    video: localVideo || project.video,
  }
}

async function mutateProject(projectId, mutator) {
  const project = await getProject(projectId)

  if (!project) {
    throw new Error('Project not found')
  }

  return saveProject(mutator(project))
}

export async function saveProject(project) {
  const nextProject = normalizeProjectForCloud(project)

  if (hasCloudUser()) {
    await setDoc(projectDocRef(nextProject.projectId), nextProject, { merge: true })
    return mergeLocalVideo(nextProject)
  }

  await withStore('readwrite', (store) => store.put(nextProject))
  return nextProject
}

export async function getProject(projectId) {
  if (hasCloudUser()) {
    const snapshot = await getDoc(projectDocRef(projectId))
    return snapshot.exists() ? mergeLocalVideo(snapshot.data()) : null
  }

  return withStore('readonly', (store) => store.get(projectId))
}

export async function getAllProjects() {
  if (hasCloudUser()) {
    const snapshot = await getDocs(projectsCollectionRef())
    const projects = await Promise.all(snapshot.docs.map((projectDoc) => mergeLocalVideo(projectDoc.data())))
    return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  }

  const projects = await withStore('readonly', (store) => store.getAll())
  return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export async function deleteProject(projectId) {
  await deleteLocalVideo(projectId)

  if (hasCloudUser()) {
    return deleteDoc(projectDocRef(projectId))
  }

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
        updatedAt: new Date().toISOString(),
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
        updatedAt: new Date().toISOString(),
      }
    })

    return { ...project, subtitles }
  })
}

export async function updateProjectTask(projectId, task) {
  return mutateProject(projectId, (project) => ({
    ...project,
    dueDate: task.dueDate || '',
    priority: task.priority || 'normal',
    note: task.note || '',
  }))
}

export async function updateProjectBilling(projectId, billing) {
  return mutateProject(projectId, (project) => ({
    ...project,
    pricePerLine: Number(billing.pricePerLine) || 0,
  }))
}

export async function getProfile() {
  if (hasCloudUser()) {
    const snapshot = await getDoc(userDocRef())
    const profile = snapshot.exists() ? snapshot.data() : {}

    return {
      userName: profile?.userName || '',
      email: profile?.email || '',
      emailVerified: Boolean(profile?.emailVerified),
      defaultPricePerLine: profile?.defaultPricePerLine ?? 0.8,
      billingSettings: normalizeBillingSettings(profile?.billingSettings || DEFAULT_BILLING_SETTINGS),
      language: profile?.language || 'zh-CN',
      compactMode: Boolean(profile?.compactMode),
    }
  }

  const profile = await withStore('readonly', (store) => store.get(PROFILE_KEY), SETTINGS_STORE)

  return {
    userName: profile?.userName || '',
    email: profile?.email || '',
    emailVerified: Boolean(profile?.emailVerified),
    defaultPricePerLine: profile?.defaultPricePerLine ?? 0.8,
    billingSettings: normalizeBillingSettings(profile?.billingSettings || DEFAULT_BILLING_SETTINGS),
    language: profile?.language || 'zh-CN',
    compactMode: Boolean(profile?.compactMode),
  }
}

export async function saveProfile(profile) {
  const now = new Date().toISOString()
  const nextProfile = {
    key: PROFILE_KEY,
    userName: profile.userName || '',
    email: profile.email || '',
    emailVerified: Boolean(profile.emailVerified),
    defaultPricePerLine: Number(profile.defaultPricePerLine) || 0,
    billingSettings: normalizeBillingSettings(profile.billingSettings || DEFAULT_BILLING_SETTINGS),
    language: profile.language || 'zh-CN',
    compactMode: Boolean(profile.compactMode),
    updatedAt: now,
    createdAt: profile.createdAt || now,
  }

  if (hasCloudUser()) {
    const cloudProfile = { ...nextProfile }
    delete cloudProfile.key
    await setDoc(userDocRef(), cloudProfile, { merge: true })
    return nextProfile
  }

  await withStore('readwrite', (store) => store.put(nextProfile), SETTINGS_STORE)
  return nextProfile
}

export async function attachVideo(projectId, videoFile) {
  const project = await getProject(projectId)

  if (!project) {
    throw new Error('Project not found')
  }

  await saveLocalVideo(projectId, videoFile)

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

  await deleteLocalVideo(projectId)

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
