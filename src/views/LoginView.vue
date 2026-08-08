<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  try {
    await auth.signIn(email.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Sign in failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="mx-auto mt-16 max-w-[22rem] px-4">
    <p class="mb-4">
      <RouterLink class="text-[0.9rem] text-muted" :to="{ name: 'home' }">← Back</RouterLink>
    </p>
    <h1 class="mb-2 text-[1.75rem] font-normal">Sign in</h1>

    <form class="grid gap-4" @submit.prevent="onSubmit">
      <label class="grid gap-[0.35rem] text-[0.9rem]">
        Email
        <input
          v-model="email"
          class="rounded-[0.35rem] border border-border px-[0.7rem] py-[0.6rem] font-inherit"
          type="email"
          autocomplete="username"
          required
        />
      </label>

      <label class="grid gap-[0.35rem] text-[0.9rem]">
        Password
        <input
          v-model="password"
          class="rounded-[0.35rem] border border-border px-[0.7rem] py-[0.6rem] font-inherit"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>

      <p v-if="errorMessage" class="m-0 text-[0.9rem] text-danger" role="alert">
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        class="cursor-pointer rounded-[0.35rem] border-0 bg-ink px-[0.9rem] py-[0.65rem] font-inherit text-white disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loading"
      >
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </main>
</template>
