<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PostForm from '@/components/PostForm.vue'
import { createPost } from '@/lib/posts'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')

async function onSubmit(payload: { title: string; body: string }) {
  const userId = auth.user?.id
  if (!userId) {
    errorMessage.value = 'You must be signed in to create a post'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    await createPost({
      title: payload.title,
      body: payload.body,
      user_id: userId,
    })
    await router.push({ name: 'home' })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to create post'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="main">
      <h1>New post</h1>
      <PostForm
        submit-label="Publish"
        :loading="loading"
        :error-message="errorMessage"
        @submit="onSubmit"
      />
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
}

.main {
  max-width: 40rem;
  margin: 0 auto;
  padding: 0 1rem 3rem;
}

h1 {
  margin: 0 0 1.25rem;
  font-size: 1.5rem;
}
</style>
