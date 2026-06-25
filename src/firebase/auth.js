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

const authErrorMessages = {
  'auth/admin-restricted-operation': '当前认证方式未开启，请在 Firebase Console 中启用邮箱密码登录。',
  'auth/configuration-not-found': 'Firebase Authentication 尚未正确配置。',
  'auth/email-already-in-use': '邮箱已经被注册。',
  'auth/invalid-email': '邮箱格式不正确。',
  'auth/invalid-credential': '邮箱或密码不正确。',
  'auth/missing-email': '请输入邮箱。',
  'auth/missing-password': '请输入密码。',
  'auth/network-request-failed': '网络连接失败，请检查手机网络、Wi-Fi 或 Firebase 域名配置。',
  'auth/operation-not-allowed': '邮箱密码登录方式未开启，请在 Firebase Console 中启用 Email/Password。',
  'auth/popup-closed-by-user': '登录窗口已关闭，请重新尝试。',
  'auth/requires-recent-login': '为了安全，请重新登录后再修改密码。',
  'auth/too-many-requests': '请求过于频繁，请稍后再试。',
  'auth/unauthorized-domain': '当前访问域名未授权，请在 Firebase Authentication 的 Authorized domains 中添加该域名。',
  'auth/user-disabled': '该账户已被禁用。',
  'auth/user-not-found': '找不到该邮箱对应的账户。',
  'auth/weak-password': '密码至少需要 6 位。',
  'auth/wrong-password': '邮箱或密码不正确。',
}

function extractAuthCode(error) {
  const code = error?.code || ''

  if (code) {
    return code
  }

  const message = error?.message || ''
  const match = message.match(/auth\/[a-z0-9-]+/i)
  return match?.[0] || ''
}

export function getAuthErrorMessage(error) {
  const code = extractAuthCode(error)

  if (authErrorMessages[code]) {
    return authErrorMessages[code]
  }

  return '认证失败，请稍后重试。'
}
