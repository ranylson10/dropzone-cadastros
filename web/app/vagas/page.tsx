import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

export default async function VacanciesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const resolved = searchParams ? await searchParams : {}
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(resolved || {})) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    } else if (value != null) {
      params.set(key, value)
    }
  }

  if (!params.has('vagas')) params.set('vagas', '1')
  redirect(`/campeonatos?${params.toString()}`)
}
