'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/** Keeps form state mounted while mobile readers open one section at a time. */
export function MobileSection({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  return <section className={`${className} mobile-section ${open ? 'is-open' : ''}`}>
    <button className="mobile-section-toggle" type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(value => !value)}>
      <span>{title}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    <div id={bodyId} className="mobile-section-body">{children}</div>
  </section>
}
