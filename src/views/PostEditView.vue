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
  <div class="min-h-screen">
    <AppHeader />

    <main class="mx-auto max-w-[40rem] px-4 pb-12">
      <h1 class="mb-5 text-2xl font-normal">Edit post</h1>

      <p v-if="loadingPost" class="text-muted">Loading…</p>
      <p v-else-if="!post" class="text-danger" role="alert">
        {{ errorMessage || 'Post not found' }}
      </p>

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
