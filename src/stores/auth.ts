import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const ready = ref(false)
  const passwordRecovery = ref(false)

  const user = computed(() => session.value?.user ?? null)
  const isAuthenticated = computed(() => !!session.value)

  async function init() {
    if (ready.value) return

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (hashParams.get('type') === 'recovery') {
      passwordRecovery.value = true
    }

    const { data } = await supabase.auth.getSession()
    session.value = data.session

    supabase.auth.onAuthStateChange((event, newSession) => {
      session.value = newSession
      if (event === 'PASSWORD_RECOVERY') {
        passwordRecovery.value = true
      }
    })

    ready.value = true
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    session.value = data.session
    return data
  }

  async function requestPasswordReset(email: string) {
    const redirectTo = new URL(
      `${import.meta.env.BASE_URL}account/update-password`.replace(/\/{2,}/g, '/'),
      window.location.origin,
    ).href

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) throw error
  }

  async function updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    passwordRecovery.value = false
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    session.value = null
    passwordRecovery.value = false
  }

  return {
    session,
    user,
    isAuthenticated,
    ready,
    passwordRecovery,
    init,
    signIn,
    requestPasswordReset,
    updatePassword,
    signOut,
  }
})
