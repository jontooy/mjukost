<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePrivateModeStore } from '@/stores/privateMode'

const auth = useAuthStore()
const privateMode = usePrivateModeStore()
const route = useRoute()
const router = useRouter()

async function onSignOut() {
  privateMode.setEnabled(false)
  await auth.signOut()
  await router.push({ name: 'home' })
}

function onKeydown(event: KeyboardEvent) {
  if (!auth.isAuthenticated) return
  if (route.name !== 'home') return
  if (event.key !== 'p' && event.key !== 'P') return
  if (event.metaKey || event.ctrlKey || event.altKey) return

  const target = event.target as HTMLElement | null
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
    return
  }

  event.preventDefault()
  privateMode.toggle()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <header class="mx-auto flex max-w-[40rem] items-center justify-between gap-4 px-4 py-5">
    <RouterLink
      class="inline-block text-xl font-bold text-inherit no-underline transition-transform duration-500 ease-in-out"
      :class="privateMode.active ? 'rotate-180' : 'rotate-0'"
      :to="{ name: 'home' }"
    >
      mjukost
    </RouterLink>

    <div class="flex flex-wrap items-center justify-end gap-3">
      <template v-if="auth.isAuthenticated">
        <RouterLink class="text-[0.9rem] text-inherit" :to="{ name: 'post-create' }">
          {{ privateMode.active ? 'New note' : 'New post' }}
        </RouterLink>
        <button
          type="button"
          class="cursor-pointer rounded-[0.35rem] border border-border bg-surface px-[0.65rem] py-[0.35rem] text-[0.9rem] font-inherit text-ink"
          @click="onSignOut"
        >
          Sign out
        </button>
      </template>
      <RouterLink
        v-else-if="route.name !== 'login'"
        class="text-[0.9rem] text-page transition-colors hover:text-ink"
        :to="{ name: 'login' }"
      >
        Sign in
      </RouterLink>
    </div>
  </header>
</template>
