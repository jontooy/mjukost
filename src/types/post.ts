import type { AsciiArt } from '@/ascii/image'

export interface Post {
  id: string
  user_id: string
  title: string
  body: string
  is_private: boolean
  slot: number // its place in the world; unique among public posts and among private ones
  image_ascii: AsciiArt | null // the first image as glyphs for its poster, computed on save
  created_at: string
  updated_at: string
}

export type PostInput = {
  title: string
  body: string
  is_private: boolean
}
