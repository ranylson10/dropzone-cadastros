import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Auth events invalidate the scope immediately, including A-B-A before another render. */
export function useMobileLifecycleScope(resource: string) {
  const current = useRef<{ resource: string; actor: string | null | undefined; epoch: number; mounted: boolean }>({ resource, actor: undefined, epoch: 0, mounted: true })
  const [account, setAccount] = useState<{ actor: string | null; ready: boolean }>({ actor: null, ready: false })
  if (current.current.resource !== resource) { current.current.resource = resource; current.current.epoch++ }
  const actor = account.actor, epoch = current.current.epoch, key = JSON.stringify([actor, resource, epoch])
  useEffect(() => {
    current.current.mounted = true; let active = true
    const update = (next: string | null) => {
      if (!active || current.current.actor === next) return
      current.current.actor = next; current.current.epoch++; setAccount({ actor: next, ready: true })
    }
    const initial = current.current.epoch
    void supabase.auth.getSession().then(({ data }) => { if (active && current.current.epoch === initial) update(data.session?.user.id || null) }).catch(() => { if (active && current.current.epoch === initial) update(null) })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => update(session?.user.id || null))
    return () => { active = false; current.current.mounted = false; current.current.epoch++; data.subscription.unsubscribe() }
  }, [])
  const isCurrent = () => current.current.mounted && current.current.resource === resource && current.current.epoch === epoch && current.current.actor === actor
  return { actor, ready: account.ready, epoch, key, isCurrent }
}
