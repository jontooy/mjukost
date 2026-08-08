<script setup lang="ts">
import { marked } from 'marked'
import { onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { deletePost, listPosts } from '@/lib/posts'
import { useAuthStore } from '@/stores/auth'
import type { Post } from '@/types/post'

const auth = useAuthStore()

const posts = ref<Post[]>([])
const loading = ref(true)
const errorMessage = ref('')
const deletingId = ref<string | null>(null)

function renderMarkdown(body: string) {
  return marked.parse(body, { async: false }) as string
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

async function loadPosts() {
  loading.value = true
  errorMessage.value = ''

  try {
    posts.value = await listPosts()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load posts'
  } finally {
    loading.value = false
  }
}

async function onDelete(post: Post) {
  if (!confirm(`Delete “${post.title}”?`)) return

  deletingId.value = post.id
  errorMessage.value = ''

  try {
    await deletePost(post.id)
    posts.value = posts.value.filter((item) => item.id !== post.id)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to delete post'
  } finally {
    deletingId.value = null
  }
}

onMounted(loadPosts)
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="mx-auto max-w-[40rem] px-4 pb-12">
      <div
        v-if="loading"
        class="grid min-h-[calc(100vh-6rem)] place-items-center opacity-45"
        aria-label="Loading posts"
        role="status"
      >
        <div
          class="h-7 w-7 animate-spin rounded-full border-2 border-[#bbb] border-t-[#666]"
        />
      </div>
      <p v-else-if="errorMessage" class="text-danger" role="alert">{{ errorMessage }}</p>
      <p v-else-if="posts.length === 0" class="text-muted">No posts yet.</p>

      <section v-else class="grid gap-8">
        <article v-for="post in posts" :key="post.id">
          <header class="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 class="m-0 text-[1.4rem]">{{ post.title }}</h2>
              <time class="text-[0.85rem] text-subtle" :datetime="post.created_at">
                {{ formatDate(post.created_at) }}
              </time>
            </div>

            <div v-if="auth.isAuthenticated" class="flex shrink-0 items-center gap-[0.65rem]">
              <RouterLink
                class="text-[0.9rem] text-inherit"
                :to="{ name: 'post-edit', params: { id: post.id } }"
              >
                Edit
              </RouterLink>
              <button
                type="button"
                class="cursor-pointer rounded-[0.35rem] border border-border bg-white px-[0.55rem] py-[0.3rem] text-[0.85rem] font-inherit disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="deletingId === post.id"
                @click="onDelete(post)"
              >
                {{ deletingId === post.id ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </header>

          <div class="post-body" v-html="renderMarkdown(post.body)" />
        </article>
      </section>
    </main>
  </div>
</template>
