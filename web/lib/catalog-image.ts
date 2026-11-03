/** Only public project media goes through the image optimizer. Other sources
 * retain their existing URLs, including external producer artwork. */
export function canOptimizeCatalogImage(source: string) {
  if (source.startsWith('/') && !source.startsWith('//')) return !source.startsWith('/api/') || source.startsWith('/api/media/')
  try {
    const url = new URL(source)
    const storage = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co')
    return url.protocol === 'https:' && url.origin === storage.origin && url.pathname.startsWith('/storage/v1/object/public/')
  } catch { return false }
}
