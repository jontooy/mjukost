<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function onSignOut() {
  await auth.signOut()
  await router.push({ name: 'login' })
}
</script>

<template>
  <main class="home">
    <header class="header">
      <div>
        <h1>Mjukost</h1>
        <p class="email">{{ auth.user?.email }}</p>
      </div>
      <button type="button" @click="onSignOut">Sign out</button>
    </header>

    <p>You’re signed in. Blog posts come next.</p>
  </main>
</template>

<style scoped>
.home {
  max-width: 40rem;
  margin: 2rem auto;
  padding: 0 1rem;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

h1 {
  margin: 0;
  font-size: 1.75rem;
}

.email {
  margin: 0.25rem 0 0;
  color: #555;
  font-size: 0.9rem;
}

button {
  padding: 0.5rem 0.8rem;
  border: 1px solid #ccc;
  border-radius: 0.35rem;
  background: #fff;
  font: inherit;
  cursor: pointer;
}
</style>
