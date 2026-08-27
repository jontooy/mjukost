<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function onSubmit() {
  errorMessage.value = ''

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match'
    return
  }

  loading.value = true

  try {
    await auth.updatePassword(password.value)
    await router.replace({ name: 'home' })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to update password'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="mx-auto mt-6 max-w-[22rem] px-3 pb-10 sm:mt-8 sm:px-4 sm:pb-12">
      <form class="grid gap-4" @submit.prevent="onSubmit">
        <h1 class="m-0 text-xl">Set a new password</h1>

        <label class="grid gap-[0.35rem] text-[0.9rem]">
          New password
          <input
            v-model="password"
            class="w-full min-h-11 rounded-[0.35rem] border border-border bg-surface px-[0.7rem] py-[0.6rem] text-base font-inherit text-ink"
            type="password"
            autocomplete="new-password"
            required
          />
        </label>

        <label class="grid gap-[0.35rem] text-[0.9rem]">
          Confirm password
          <input
            v-model="confirmPassword"
            class="w-full min-h-11 rounded-[0.35rem] border border-border bg-surface px-[0.7rem] py-[0.6rem] text-base font-inherit text-ink"
            type="password"
            autocomplete="new-password"
            required
          />
        </label>

        <p v-if="errorMessage" class="m-0 text-[0.9rem] text-danger" role="alert">
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          class="w-full min-h-11 cursor-pointer rounded-[0.35rem] border-0 bg-ink px-[0.9rem] py-[0.65rem] font-inherit text-page disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
        >
          {{ loading ? 'Updating…' : 'Update password' }}
        </button>
      </form>
    </main>
  </div>
</template>
