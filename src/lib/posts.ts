import { api } from '@/lib/api'
import type { Post, PostInput } from '@/types/post'

const LIST_TIMEOUT_MS = 10000

// Bounded, so a backend that never answers counts as unreachable rather than loading forever.
export function listPosts(options: { isPrivate: boolean }): Promise<Post[]> {
  return api<Post[]>(`/posts?is_private=${options.isPrivate ? 1 : 0}`, { signal: AbortSignal.timeout(LIST_TIMEOUT_MS) })
}

export function createPost(input: PostInput & { slot: number }): Promise<Post> {
  return api<Post>('/posts', { method: 'POST', body: JSON.stringify(input) })
}

export function updatePost(id: string, input: PostInput): Promise<Post> {
  return api<Post>(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function deletePost(id: string): Promise<void> {
  await api<void>(`/posts/${id}`, { method: 'DELETE' })
}
