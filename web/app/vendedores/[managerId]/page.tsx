'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, ShieldCheck, Trophy } from 'lucide-react'
import { useParams } from 'next/navigation'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

export default function VendedorCampeonatosPage() {
  const params = useParams<{ managerId: string }>()
  const managerId = String(params?.managerId || '')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const response = await fetch(`/api/vendedores/${encodeURIComponent(managerId)}/campeonatos`)
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Erro ao carregar vendedor.')
        setData(json)
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar vendedor.')
      } finally {
        setLoading(false)
      }
    }
    if (managerId) void load()
  }, [managerId])

  if (loading) return <DropzoneLoader label="Carregando campeonatos" />
  if (!data) return <main className="invite-page"><div className="invite-card"><ShieldCheck size={38} /><h1>Vendedor indisponível</h1><p>{error}</p></div></main>

  const manager = data.manager
  const avatar = manager.avatar_url || manager.foto_url

  return (
    <main className="directory-page seller-directory-page">
      <section className="directory-hero seller-hero">
        <small>VENDEDOR DE VAGAS</small>
        <div className="seller-hero-row">
          <span className="directory-list-media">{avatar ? <img src={avatar} alt="" /> : <b>{String(manager.nome || manager.username || 'MG').slice(0, 2).toUpperCase()}</b>}</span>
          <div>
            <h1>{manager.nome || manager.username || 'Manager'}</h1>
            <p>{manager.bio || 'Campeonatos disponíveis para compra de vagas.'}</p>
          </div>
        </div>
      </section>

      <div className="directory-list">
        {data.campeonatos.map((item: any) => {
          const champ = item.campeonatos || {}
          const producer = item.produtoras || {}
          return (
            <article className="directory-list-row seller-champ-row" key={item.id}>
              <span className="directory-list-media">{champ.logo_url ? <img src={champ.logo_url} alt="" /> : <Trophy size={18} />}</span>
              <span className="directory-list-main">
                <small>{producer.nome ? `Produtora ${producer.nome}` : 'Campeonato'}</small>
                <strong>{champ.nome || 'Campeonato'}</strong>
                <span>Status: {champ.status || 'ativo'}</span>
              </span>
              <span className="directory-list-meta">
                <a className="button seller-whatsapp-button" href={item.whatsapp_url} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Comprar vaga</a>
              </span>
            </article>
          )
        })}
      </div>
      {!data.campeonatos.length ? <div className="directory-empty">Nenhum campeonato disponível para venda.</div> : null}
    </main>
  )
}
