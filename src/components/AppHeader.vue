<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function onSignOut() {
  await auth.signOut()
  await router.push({ name: 'home' })
}
</script>

<template>
  <header class="mx-auto flex max-w-[40rem] items-center justify-between gap-4 px-4 py-5">
    <RouterLink class="text-xl font-bold text-inherit no-underline" :to="{ name: 'home' }">
      mjukost
    </RouterLink>

    <div class="flex flex-wrap items-center justify-end gap-3">
      <template v-if="auth.isAuthenticated">
        <RouterLink class="text-[0.9rem] text-inherit" :to="{ name: 'post-create' }">
          New post
        </RouterLink>
        <button
          type="button"
          class="cursor-pointer rounded-[0.35rem] border border-border bg-white px-[0.65rem] py-[0.35rem] text-[0.9rem] font-inherit"
          @click="onSignOut"
        >
          Sign out
        </button>
      </template>
      <RouterLink v-else class="text-[0.9rem] text-inherit" :to="{ name: 'login' }">
        Sign in
      </RouterLink>
    </div>
  </header>
</template>
