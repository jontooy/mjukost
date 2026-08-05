export interface Post {
  id: string
  user_id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

export type PostInput = {
  title: string
  body: string
  user_id: string
}

export type PostUpdate = {
  title: string
  body: string
}
