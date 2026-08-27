<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)
const resetMode = ref(false)

async function onSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  loading.value = true

  try {
    if (resetMode.value) {
      await auth.requestPasswordReset(email.value.trim())
      successMessage.value = 'Check your email for a reset link.'
    } else {
      await auth.signIn(email.value.trim(), password.value)
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
      await router.replace(redirect)
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : resetMode.value ? 'Reset failed' : 'Sign in failed'
  } finally {
    loading.value = false
  }
}

function toggleResetMode() {
  resetMode.value = !resetMode.value
  errorMessage.value = ''
  successMessage.value = ''
  password.value = ''
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="mx-auto mt-6 max-w-[22rem] px-3 pb-10 sm:mt-8 sm:px-4 sm:pb-12">
      <form class="grid gap-4" @submit.prevent="onSubmit">
        <label class="grid gap-[0.35rem] text-[0.9rem]">
          Email
          <input
            v-model="email"
            class="w-full min-h-11 rounded-[0.35rem] border border-border bg-surface px-[0.7rem] py-[0.6rem] text-base font-inherit text-ink"
            type="email"
            autocomplete="username"
            required
          />
        </label>

        <label v-if="!resetMode" class="grid gap-[0.35rem] text-[0.9rem]">
          Password
          <input
            v-model="password"
            class="w-full min-h-11 rounded-[0.35rem] border border-border bg-surface px-[0.7rem] py-[0.6rem] text-base font-inherit text-ink"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>

        <p v-if="errorMessage" class="m-0 text-[0.9rem] text-danger" role="alert">
          {{ errorMessage }}
        </p>
        <p v-else-if="successMessage" class="m-0 text-[0.9rem] text-muted" role="status">
          {{ successMessage }}
        </p>

        <button
          type="submit"
          class="w-full min-h-11 cursor-pointer rounded-[0.35rem] border-0 bg-ink px-[0.9rem] py-[0.65rem] font-inherit text-page disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
        >
          {{
            loading
              ? resetMode
                ? 'Sending…'
                : 'Signing in…'
              : resetMode
                ? 'Send reset link'
                : 'Sign in'
          }}
        </button>

        <button
          type="button"
          class="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-left text-[0.9rem] font-inherit text-muted"
          @click="toggleResetMode"
        >
          {{ resetMode ? 'Back to sign in' : 'Forgot password?' }}
        </button>
      </form>
    </main>
  </div>
</template>
