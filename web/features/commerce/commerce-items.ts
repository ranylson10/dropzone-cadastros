import type { LocalCommerceItem } from './local-commerce'

export type ChampionshipCommerceSource = {
  id: string
  name?: string | null
  nome?: string | null
  href?: string | null
  image?: string | null
  logo_url?: string | null
  banner?: string | null
  banner_url?: string | null
  price?: number | string | null
  valor_inscricao?: number | string | null
  freeSlots?: number | null
  vagas_livres?: number | null
}

export function commerceMoney(value: unknown) {
  const number = Number(value)
  return number > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
    : 'Grátis'
}

export function championshipCommerceItem(
  source: ChampionshipCommerceSource,
  options?: Pick<LocalCommerceItem, 'origin' | 'sellerManagerId'>,
): LocalCommerceItem {
  const id = String(source.id || '')
  return {
    id,
    name: String(source.name || source.nome || 'Campeonato'),
    href: String(source.href || `/campeonatos/${encodeURIComponent(id)}`),
    image: source.image ?? source.logo_url ?? null,
    banner: source.banner ?? source.banner_url ?? null,
    price: Number(source.price ?? source.valor_inscricao ?? 0),
    freeSlots: Number(source.freeSlots ?? source.vagas_livres ?? 0),
    quantity: 1,
    origin: options?.origin || 'direto',
    sellerManagerId: options?.sellerManagerId || null,
  }
}

export function commerceItemFromApi(row: any): LocalCommerceItem {
  const championship = Array.isArray(row?.campeonato) ? row.campeonato[0] : row?.campeonato
  const id = String(row?.campeonato_id || championship?.id || row?.id || '')
  return {
    id,
    itemId: row?.id ? String(row.id) : null,
    name: String(championship?.nome || row?.name || 'Campeonato'),
    href: `/campeonatos/${encodeURIComponent(id)}`,
    image: championship?.logo_url || null,
    banner: championship?.banner_url || null,
    price: Number(row?.preco_unitario_centavos || 0) / 100 || Number(championship?.valor_inscricao || 0),
    freeSlots: Number(championship?.vagas_livres || 0),
    quantity: Math.max(1, Number(row?.quantidade || 1)),
    origin: row?.origem || 'direto',
    sellerManagerId: row?.vendedor_manager_id ? String(row.vendedor_manager_id) : null,
  }
}
