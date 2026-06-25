import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import { firebaseAuth, isFirebaseConfigured } from './firebase'

function requireAuthService() {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase is not configured. Please add your VITE_FIREBASE_* values.')
  }

  return firebaseAuth
}

export function watchAuthState(callback) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    callback(null)
    return () => {}
  }

  return onAuthStateChanged(firebaseAuth, callback)
}

export async function registerWithEmail({ email, password, userName }) {
  const auth = requireAuthService()
  const credential = await createUserWithEmailAndPassword(auth, email, password)

  if (userName) {
    await updateProfile(credential.user, { displayName: userName })
  }

  await sendEmailVerification(credential.user)
  return credential.user
}

export async function loginWithEmail({ email, password }) {
  const auth = requireAuthService()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function logoutUser() {
  const auth = requireAuthService()
  await signOut(auth)
}

export async function sendResetPassword(email) {
  const auth = requireAuthService()
  await sendPasswordResetEmail(auth, email)
}

export async function resendVerificationEmail() {
  const auth = requireAuthService()

  if (!auth.currentUser) {
    throw new Error('No signed-in user.')
  }

  await sendEmailVerification(auth.currentUser)
}

export async function changeCurrentUserPassword(nextPassword) {
  const auth = requireAuthService()

  if (!auth.currentUser) {
    throw new Error('No signed-in user.')
  }

  await updatePassword(auth.currentUser, nextPassword)
}

export function getAuthErrorMessage(error) {
  const code = error?.code || ''

  if (code.includes('auth/email-already-in-use')) return '邮箱已经被注册。'
  if (code.includes('auth/invalid-email')) return '邮箱格式不正确。'
  if (code.includes('auth/user-not-found')) return '找不到该邮箱对应的账户。'
  if (code.includes('auth/invalid-credential')) return '邮箱或密码不正确。'
  if (code.includes('auth/weak-password')) return '密码至少需要 6 位。'
  if (code.includes('auth/requires-recent-login')) return '为了安全，请重新登录后再修改密码。'
  if (code.includes('auth/too-many-requests')) return '请求过于频繁，请稍后再试。'

  return error?.message || '认证失败，请稍后重试。'
}

