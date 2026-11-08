import { api } from '@/lib/api'
import type { Post, PostInput } from '@/types/post'

export function listPosts(options: { isPrivate: boolean }): Promise<Post[]> {
  return api<Post[]>(`/posts?is_private=${options.isPrivate ? 1 : 0}`)
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
