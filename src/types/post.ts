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
}
