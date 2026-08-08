<script setup lang="ts">
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
</script>

<template>
  <header
    class="mx-auto flex max-w-[40rem] items-center justify-between gap-3 px-3 py-4 sm:gap-4 sm:px-4 sm:py-5"
  >
    <div class="flex items-center gap-3">
      <RouterLink
        class="inline-block text-xl font-bold text-inherit no-underline transition-transform duration-500 ease-in-out"
        :class="privateMode.active ? 'rotate-180' : 'rotate-0'"
        :to="{ name: 'home' }"
      >
        mjukost
      </RouterLink>

      <button
        v-if="auth.isAuthenticated"
        type="button"
        role="switch"
        class="inline-flex min-h-11 items-center sm:min-h-0"
        :aria-checked="privateMode.active"
        :aria-label="privateMode.active ? 'Switch to public posts' : 'Switch to private notes'"
        @click="privateMode.toggle()"
      >
        <span
          class="relative block h-6 w-11 shrink-0 rounded-full bg-ink p-0.5 transition-colors duration-200"
        >
          <span
            class="block size-5 rounded-full bg-page transition-transform duration-200 ease-in-out"
            :class="privateMode.active ? 'translate-x-5' : 'translate-x-0'"
          />
        </span>
      </button>
    </div>

    <div class="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <template v-if="auth.isAuthenticated">
        <RouterLink
          class="inline-flex min-h-11 items-center text-[0.9rem] text-inherit sm:min-h-0"
          :to="{ name: 'post-create' }"
        >
          {{ privateMode.active ? 'New note' : 'New post' }}
        </RouterLink>
        <button
          type="button"
          class="min-h-11 cursor-pointer rounded-[0.35rem] border border-border bg-surface px-[0.65rem] py-[0.35rem] text-[0.9rem] font-inherit text-ink sm:min-h-0"
          @click="onSignOut"
        >
          Sign out
        </button>
      </template>
      <RouterLink
        v-else-if="route.name !== 'login'"
        class="inline-flex min-h-11 items-center text-[0.9rem] text-page transition-colors hover:text-ink sm:min-h-0"
        :to="{ name: 'login' }"
      >
        Sign in
      </RouterLink>
    </div>
  </header>
</template>
