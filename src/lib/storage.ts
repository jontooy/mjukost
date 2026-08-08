import { supabase } from '@/lib/supabase'

const BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'post-images'
const MAX_BYTES = 5 * 1024 * 1024

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
}

export async function uploadPostImage(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed')
  }

  if (file.size > MAX_BYTES) {
    throw new Error('Image must be 5 MB or smaller')
  }

  const path = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
