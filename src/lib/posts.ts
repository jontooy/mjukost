import { supabase } from '@/lib/supabase'
import type { Post, PostInput, PostUpdate } from '@/types/post'

export async function listPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, title, body, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getPost(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, title, body, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createPost(input: PostInput): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      title: input.title,
      body: input.body,
      user_id: input.user_id,
    })
    .select('id, user_id, title, body, created_at, updated_at')
    .single()

  if (error) throw error
  return data
}

export async function updatePost(id: string, input: PostUpdate): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .update({
      title: input.title,
      body: input.body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, user_id, title, body, created_at, updated_at')
    .single()

  if (error) throw error
  return data
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw error
}
