import { usePagedDirectory } from './usePagedDirectory'

export function usePublicDirectory<T extends { id: string }>(kind: 'equipes' | 'jogadores', query: string) {
  return usePagedDirectory<T>(`/api/${kind}/busca-publica`, query)
}
