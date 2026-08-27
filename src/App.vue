<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

watch(
  () => [auth.passwordRecovery, auth.isAuthenticated] as const,
  ([recovering, isAuthenticated]) => {
    if (
      recovering &&
      isAuthenticated &&
      router.currentRoute.value.name !== 'update-password'
    ) {
      void router.replace({ name: 'update-password' })
    }
  },
  { immediate: true },
)
</script>

<template>
  <RouterView />
</template>
