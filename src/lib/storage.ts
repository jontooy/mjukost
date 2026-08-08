import { supabase } from '@/lib/supabase'

const PUBLIC_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'post-images'
const PRIVATE_BUCKET =
  import.meta.env.VITE_SUPABASE_PRIVATE_STORAGE_BUCKET || 'private-images'
const PRIVATE_SCHEME = 'private://'
const MAX_BYTES = 5 * 1024 * 1024
const SIGNED_URL_SECONDS = 60 * 60

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
}

export async function uploadPostImage(
  file: File,
  userId: string,
  options?: { isPrivate?: boolean },
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed')
  }

  if (file.size > MAX_BYTES) {
    throw new Error('Image must be 5 MB or smaller')
  }

  const isPrivate = !!options?.isPrivate
  const bucket = isPrivate ? PRIVATE_BUCKET : PUBLIC_BUCKET
  const path = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) throw error

  if (isPrivate) {
    return `${PRIVATE_SCHEME}${path}`
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function resolvePrivateMarkdownUrls(markdown: string): Promise<string> {
  const refs = [...markdown.matchAll(/private:\/\/[^\s)]+/g)].map((match) => match[0])
  if (refs.length === 0) return markdown

  const uniqueRefs = [...new Set(refs)]
  let result = markdown

  await Promise.all(
    uniqueRefs.map(async (ref) => {
      const path = ref.slice(PRIVATE_SCHEME.length)
      const { data, error } = await supabase.storage
        .from(PRIVATE_BUCKET)
        .createSignedUrl(path, SIGNED_URL_SECONDS)

      if (!error && data?.signedUrl) {
        result = result.split(ref).join(data.signedUrl)
      }
    }),
  )

  return result
}
