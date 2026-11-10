import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api, ApiError, getToken, setToken } from '@/lib/api'

const AUTH_TIMEOUT_MS = 5000

export interface AuthUser {
  id: string
  email: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const ready = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  async function init() {
    if (ready.value) return

    if (getToken()) {
      // The app mounts only after this, so a backend that accepts but never answers must not hold it.
      try {
        user.value = await api<AuthUser>('/user', { signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) })
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setToken(null)
        }
      }
    }

    ready.value = true
  }

  async function signIn(email: string, password: string) {
    const data = await api<{ token: string; user: AuthUser }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    setToken(data.token)
    user.value = data.user
    return data
  }

  async function signOut() {
    await api('/logout', { method: 'POST' }).catch(() => undefined)
    setToken(null)
    user.value = null
  }

  return {
    user,
    isAuthenticated,
    ready,
    init,
    signIn,
    signOut,
  }
})
