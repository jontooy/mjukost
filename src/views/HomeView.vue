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
  <div class="page">
    <AppHeader />

    <main class="main">
      <p v-if="loading" class="status">Loading posts…</p>
      <p v-else-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
      <p v-else-if="posts.length === 0" class="status">No posts yet.</p>

      <section v-else class="posts">
        <article v-for="post in posts" :key="post.id" class="post">
          <header class="post-header">
            <div>
              <h2>{{ post.title }}</h2>
              <time :datetime="post.created_at">{{ formatDate(post.created_at) }}</time>
            </div>

            <div v-if="auth.isAuthenticated" class="post-actions">
              <RouterLink class="link" :to="{ name: 'post-edit', params: { id: post.id } }">
                Edit
              </RouterLink>
              <button
                type="button"
                class="button"
                :disabled="deletingId === post.id"
                @click="onDelete(post)"
              >
                {{ deletingId === post.id ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </header>

          <div class="body" v-html="renderMarkdown(post.body)" />
        </article>
      </section>
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

.status {
  color: #555;
}

.error {
  color: #b00020;
}

.posts {
  display: grid;
  gap: 2rem;
}

.post-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

h2 {
  margin: 0;
  font-size: 1.4rem;
}

time {
  color: #666;
  font-size: 0.85rem;
}

.post-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-shrink: 0;
}

.link {
  color: inherit;
  font-size: 0.9rem;
}

.button {
  padding: 0.3rem 0.55rem;
  border: 1px solid #ccc;
  border-radius: 0.35rem;
  background: #fff;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.body :deep(p) {
  margin: 0 0 0.85rem;
}

.body :deep(p:last-child) {
  margin-bottom: 0;
}

.body :deep(pre) {
  overflow-x: auto;
  padding: 0.75rem;
  border-radius: 0.35rem;
  background: #eee;
}

.body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
}
</style>
