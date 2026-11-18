import { useEffect, useState } from 'react'
import { getBlob } from './store'

const cache = new Map<string, string>()

export async function blobUrl(ns: string, id: string): Promise<string | undefined> {
  const k = `${ns}:${id}`
  if (cache.has(k)) return cache.get(k)
  const b = await getBlob(ns, id)
  if (!b) return undefined
  const u = URL.createObjectURL(b)
  cache.set(k, u)
  return u
}

export function useBlobUrl(ns: string, id: string | null | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let live = true
    setUrl(undefined)
    if (id) blobUrl(ns, id).then((u) => live && setUrl(u))
    return () => { live = false }
  }, [ns, id])
  return url
}
