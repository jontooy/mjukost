<script setup lang="ts">
import { marked } from 'marked'
import { onMounted, ref, watch } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { deletePost, listPosts } from '@/lib/posts'
import { resolvePrivateMarkdownUrls } from '@/lib/storage'
import { useAuthStore } from '@/stores/auth'
import { usePrivateModeStore } from '@/stores/privateMode'
import type { Post } from '@/types/post'

const auth = useAuthStore()
const privateMode = usePrivateModeStore()

const posts = ref<Post[]>([])
const renderedBodies = ref<Record<string, string>>({})
const loading = ref(true)
const errorMessage = ref('')
const deletingId = ref<string | null>(null)

async function renderMarkdown(body: string) {
  const resolved = await resolvePrivateMarkdownUrls(body)
  return marked.parse(resolved, { async: false }) as string
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
    const nextPosts = await listPosts({ isPrivate: privateMode.active })
    const bodies = await Promise.all(
      nextPosts.map(async (post) => [post.id, await renderMarkdown(post.body)] as const),
    )
    posts.value = nextPosts
    renderedBodies.value = Object.fromEntries(bodies)
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
    delete renderedBodies.value[post.id]
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to delete post'
  } finally {
    deletingId.value = null
  }
}

watch(
  () => privateMode.active,
  () => {
    void loadPosts()
  },
)

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
          class="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-muted"
        />
      </div>
      <p v-else-if="errorMessage" class="text-danger" role="alert">{{ errorMessage }}</p>
      <p v-else-if="posts.length === 0" class="text-muted">
        {{ privateMode.active ? 'No private notes yet.' : 'No posts yet.' }}
      </p>

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
                class="cursor-pointer rounded-[0.35rem] border border-border bg-surface px-[0.55rem] py-[0.3rem] text-[0.85rem] font-inherit text-ink disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="deletingId === post.id"
                @click="onDelete(post)"
              >
                {{ deletingId === post.id ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </header>

          <div class="post-body" v-html="renderedBodies[post.id]" />
        </article>
      </section>
    </main>
  </div>
</template>
