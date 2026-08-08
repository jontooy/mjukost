import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const STORAGE_KEY = 'mjukost-private-mode'

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeStored(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // ignore
  }
}

function syncDocumentClass(enabled: boolean) {
  document.documentElement.classList.toggle('private-mode', enabled)
}

export const usePrivateModeStore = defineStore('privateMode', () => {
  const auth = useAuthStore()
  const enabled = ref(false)

  const active = computed(() => auth.isAuthenticated && enabled.value)

  function apply() {
    const next = auth.isAuthenticated && enabled.value
    syncDocumentClass(next)
  }

  function init() {
    enabled.value = readStored()
    if (!auth.isAuthenticated) {
      enabled.value = false
    }
    apply()
  }

  function setEnabled(value: boolean) {
    if (!auth.isAuthenticated) {
      enabled.value = false
      writeStored(false)
      apply()
      return
    }

    enabled.value = value
    writeStored(value)
    apply()
  }

  function toggle() {
    setEnabled(!enabled.value)
  }

  watch(
    () => auth.isAuthenticated,
    (isAuthenticated) => {
      if (!isAuthenticated) {
        enabled.value = false
        apply()
      } else {
        enabled.value = readStored()
        apply()
      }
    },
  )

  return {
    enabled,
    active,
    init,
    setEnabled,
    toggle,
  }
})
