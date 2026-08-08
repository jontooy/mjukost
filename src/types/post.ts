export interface Post {
  id: string
  user_id: string
  title: string
  body: string
  is_private: boolean
  created_at: string
  updated_at: string
}

export type PostInput = {
  title: string
  body: string
  is_private: boolean
  user_id: string
}

export type PostUpdate = {
  title: string
  body: string
  is_private: boolean
}

export const POST_COLUMNS =
  'id, user_id, title, body, is_private, created_at, updated_at' as const
