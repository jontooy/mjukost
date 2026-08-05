<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PostForm from '@/components/PostForm.vue'
import { getPost, updatePost } from '@/lib/posts'
import type { Post } from '@/types/post'

const route = useRoute()
const router = useRouter()

const post = ref<Post | null>(null)
const loadingPost = ref(true)
const saving = ref(false)
const errorMessage = ref('')

async function loadPost() {
  loadingPost.value = true
  errorMessage.value = ''

  try {
    const id = String(route.params.id)
    post.value = await getPost(id)
    if (!post.value) {
      errorMessage.value = 'Post not found'
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load post'
  } finally {
    loadingPost.value = false
  }
}

async function onSubmit(payload: { title: string; body: string }) {
  if (!post.value) return

  saving.value = true
  errorMessage.value = ''

  try {
    await updatePost(post.value.id, {
      title: payload.title,
      body: payload.body,
    })
    await router.push({ name: 'home' })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to update post'
  } finally {
    saving.value = false
  }
}

onMounted(loadPost)
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="main">
      <h1>Edit post</h1>

      <p v-if="loadingPost" class="status">Loading…</p>
      <p v-else-if="!post" class="error" role="alert">{{ errorMessage || 'Post not found' }}</p>

      <PostForm
        v-else
        :title="post.title"
        :body="post.body"
        submit-label="Update"
        :loading="saving"
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

.status {
  color: #555;
}

.error {
  color: #b00020;
}
</style>
