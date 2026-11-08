import { api } from '@/lib/api'

const PRIVATE_SCHEME = 'private://'
const MAX_BYTES = 5 * 1024 * 1024

export async function uploadPostImage(
  file: File,
  options?: { isPrivate?: boolean },
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed')
  }

  if (file.size > MAX_BYTES) {
    throw new Error('Image must be 5 MB or smaller')
  }

  const form = new FormData()
  form.append('file', file)
  form.append('is_private', options?.isPrivate ? '1' : '0')

  const { url } = await api<{ url: string }>('/images', { method: 'POST', body: form })
  return url
}

export async function resolvePrivateMarkdownUrls(markdown: string): Promise<string> {
  const refs = [...new Set([...markdown.matchAll(/private:\/\/[^\s)]+/g)].map((match) => match[0]))]
  if (refs.length === 0) return markdown

  const urls = await api<{ urls: Record<string, string> }>('/images/sign', {
    method: 'POST',
    body: JSON.stringify({ paths: refs.map((ref) => ref.slice(PRIVATE_SCHEME.length)) }),
  })
    .then((data) => data.urls)
    .catch((): Record<string, string> => ({}))

  let result = markdown
  for (const ref of refs) {
    const url = urls[ref.slice(PRIVATE_SCHEME.length)]
    if (url) {
      result = result.split(ref).join(url)
    }
  }
  return result
}
