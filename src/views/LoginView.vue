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
  <main class="login">
    <h1>Sign in</h1>
    <p class="hint">Use your email and password.</p>

    <form class="form" @submit.prevent="onSubmit">
      <label>
        Email
        <input v-model="email" type="email" autocomplete="username" required />
      </label>

      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login {
  max-width: 22rem;
  margin: 4rem auto;
  padding: 0 1rem;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
}

.hint {
  margin: 0 0 1.5rem;
  color: #555;
}

.form {
  display: grid;
  gap: 1rem;
}

label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.9rem;
}

input {
  padding: 0.6rem 0.7rem;
  border: 1px solid #ccc;
  border-radius: 0.35rem;
  font: inherit;
}

button {
  padding: 0.65rem 0.9rem;
  border: none;
  border-radius: 0.35rem;
  background: #1a1a1a;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin: 0;
  color: #b00020;
  font-size: 0.9rem;
}
</style>
