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
  <header class="header">
    <RouterLink class="brand" :to="{ name: 'home' }">Mjukost</RouterLink>

    <div class="actions">
      <template v-if="auth.isAuthenticated">
        <span class="email">{{ auth.user?.email }}</span>
        <RouterLink class="link" :to="{ name: 'post-create' }">New post</RouterLink>
        <button type="button" class="button" @click="onSignOut">Sign out</button>
      </template>
      <RouterLink v-else class="link" :to="{ name: 'login' }">Sign in</RouterLink>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  max-width: 40rem;
  margin: 0 auto;
  padding: 1.25rem 1rem;
}

.brand {
  color: inherit;
  font-size: 1.25rem;
  font-weight: 700;
  text-decoration: none;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.email {
  color: #555;
  font-size: 0.85rem;
}

.link {
  color: inherit;
  font-size: 0.9rem;
}

.button {
  padding: 0.35rem 0.65rem;
  border: 1px solid #ccc;
  border-radius: 0.35rem;
  background: #fff;
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}
</style>
