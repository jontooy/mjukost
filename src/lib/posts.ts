import { supabase } from '@/lib/supabase'
import { POST_COLUMNS, type Post, type PostInput, type PostUpdate } from '@/types/post'

export async function listPosts(options?: { isPrivate: boolean }): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select(POST_COLUMNS)
    .order('created_at', { ascending: false })

  if (options) {
    query = query.eq('is_private', options.isPrivate)
  }

  const { data, error } = await query

  if (error) throw error
  return data ?? []
}

export async function getPost(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_COLUMNS)
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
      is_private: input.is_private,
      user_id: input.user_id,
    })
    .select(POST_COLUMNS)
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
      is_private: input.is_private,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(POST_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw error
}
