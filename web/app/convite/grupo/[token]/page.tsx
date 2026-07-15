'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardCopy,
  Link2,
  ListChecks,
  Shield,
  Users,
  UserPlus,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { buildLoginHref, buildProfileCreationHref } from '@/features/auth/auth-return'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'

type Vaga = {
  index: number
  nome: string
  slot_id?: string | null
  slot_numero?: number | null
  slot_letra: string | null
  ocupada: boolean
  equipe_nome: string | null
  line_nome: string | null
  logo_url: string | null
}

type Participacao = {
  id: string
  campeonato_equipe_id: string
  nome_exibicao: string
  slot_numero: number | null
  line: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
  jogadores: Array<{
    id: string
    nick: string
    foto_url?: string | null
    id_jogo?: string | null
    funcao?: string | null
  }>
  quantidade_jogadores: number
  limite_jogadores: number
  vagas_disponiveis: number
  link_escalacao: {
    id: string
    token: string
    expira_em: string | null
    limite_jogadores: number
    public_path: string
  } | null
}

type GroupInvitePayload = {
  error?: string
  autenticado?: boolean
  inscrita?: boolean
  campeonato?: { id: string; nome: string; logo_url: string | null }
  grupo?: { id: string; nome: string }
  vagas?: Vaga[]
  resumo_grupo?: { total: number; ocupadas: number; livres: number }
  equipe?: { id: string; nome: string; tag: string | null; logo_url: string | null } | null
  lines?: Array<{ id: string; nome: string; tag: string | null; logo_url: string | null; ja_inscrita: boolean }>
  minhas_participacoes?: Participacao[]
}

type ViewMode = 'entrada' | 'hub' | 'acompanhar' | 'escalar' | 'jogadores'

export default function ConviteGrupoPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [data, setData] = useState<GroupInvitePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [vagaIndex, setVagaIndex] = useState('')
  const [lineId, setLineId] = useState('')
  const [nomeNovaLine, setNomeNovaLine] = useState('')
  const [view, setView] = useState<ViewMode>('entrada')
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState('')
  const [generated, setGenerated] = useState<{ link: string; texto: string } | null>(null)

  const linesDisponiveis = useMemo(() => (data?.lines || []).filter((line) => !line.ja_inscrita), [data?.lines])
  const vagasLivres = useMemo(() => (data?.vagas || []).filter((vaga) => !vaga.ocupada), [data?.vagas])
  const minhasParticipacoes = data?.minhas_participacoes || []
  const selectedParticipacao =
    minhasParticipacoes.find((item) => item.id === selectedParticipacaoId) || minhasParticipacoes[0] || null

  async function carregar(opts?: { preferHub?: boolean }) {
    setLoading(true)
    setMessage('')
    const { data: sessionData } = await supabase.auth.getSession()
    const response = await fetch(`/api/convites/grupo/${encodeURIComponent(token)}`, {
      headers: sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
      cache: 'no-store',
    })
    const payload = await response.json()
    setData(payload)

    const primeiraVaga = (payload.vagas || []).find((vaga: Vaga) => !vaga.ocupada)
    const primeiraLine = (payload.lines || []).find((line: any) => !line.ja_inscrita)
    setVagaIndex(primeiraVaga ? String(primeiraVaga.index) : '')
    setLineId(primeiraLine?.id || '')

    const parts: Participacao[] = payload.minhas_participacoes || []
    if (parts[0]?.id) setSelectedParticipacaoId(parts[0].id)

    if (opts?.preferHub || payload.inscrita) {
      setView('hub')
    } else {
      setView('entrada')
    }
    setLoading(false)
  }

  useEffect(() => {
    void carregar()
  }, [token])

  async function confirmar() {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) return setMessage('Entre com sua conta de equipe para continuar.')
    if (vagaIndex === '') return setMessage('Selecione qual vaga esperada sua equipe vai ocupar.')
    if (!lineId && !nomeNovaLine.trim()) return setMessage('Selecione uma line disponivel ou crie uma nova.')

    const vagaSelecionada = (data?.vagas || []).find((vaga) => String(vaga.index) === String(vagaIndex))
    if (!vagaSelecionada) return setMessage('Vaga selecionada invalida. Atualize a pagina e tente novamente.')
    if (vagaSelecionada.ocupada) return setMessage('Essa vaga ja foi preenchida. Escolha outra.')
    if (!vagaSelecionada.slot_id) {
      return setMessage('Esta vaga ainda nao tem slot no grupo. Peca ao organizador para recriar o grupo/slots.')
    }

    setBusy(true)
    setMessage('')
    const response = await fetch(`/api/convites/grupo/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        vaga_index: Number(vagaIndex),
        slot_id: vagaSelecionada.slot_id,
        line_id: lineId || null,
        nome_line: lineId ? null : nomeNovaLine.trim(),
      }),
    })
    const payload = await response.json()
    setBusy(false)
    if (!response.ok) return setMessage(payload.error || 'Nao foi possivel entrar no grupo.')

    setMessage(
      `${payload.line?.nome || 'Line'} entrou como ${payload.referencia || 'vaga'} pela equipe ${payload.equipe?.nome || 'equipe'}.`,
    )
    await carregar({ preferHub: true })
  }

  async function gerarLinkEscalacao() {
    if (!selectedParticipacao) return setMessage('Nenhuma line inscrita neste grupo.')
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) return setMessage('Entre com sua conta de equipe para continuar.')

    setBusy(true)
    setMessage('')
    setGenerated(null)
    try {
      const response = await fetch('/api/equipe/escalacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          campeonato_equipe_id: selectedParticipacao.campeonato_equipe_id,
          limite_jogadores: selectedParticipacao.limite_jogadores || 6,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao gerar link de escalacao.')
      setGenerated({
        link: String(json.public_url || `${window.location.origin}/escala/${json.token}`),
        texto: String(json.texto || json.public_url || ''),
      })
      await carregar({ preferHub: true })
      setView('escalar')
      setMessage('Link de escalacao gerado.')
    } catch (error: any) {
      setMessage(error?.message || 'Erro ao gerar link de escalacao.')
    } finally {
      setBusy(false)
    }
  }

  async function copiar(texto: string, okMessage = 'Copiado.') {
    try {
      await navigator.clipboard.writeText(texto)
      setMessage(okMessage)
    } catch {
      setMessage('Nao foi possivel copiar automaticamente. Selecione o texto e copie.')
    }
  }

  if (loading) return <DropzoneLoader label="Carregando link de equipes" />

  if (!data || data.error) {
    return (
      <main className="invite-page">
        <div className="invite-card">
          <Shield size={38} />
          <h1>Link inválido</h1>
          <p>{data?.error || 'Não foi possível carregar este link.'}</p>
          <p className="invite-hint">
            Se você já se inscreveu, peça ao organizador o link atualizado do grupo ou acesse o painel da equipe.
          </p>
          <a className="button invite-confirm" href="/">
            Ir para o painel
          </a>
        </div>
      </main>
    )
  }

  const showHub = data.inscrita || view === 'hub' || view === 'acompanhar' || view === 'escalar' || view === 'jogadores'

  if (showHub && data.equipe && minhasParticipacoes.length) {
    return (
      <main className="invite-page">
        <div className="invite-card invite-hub-card">
          {data.campeonato?.logo_url ? (
            <img className="invite-champ-logo" src={data.campeonato.logo_url} alt="" />
          ) : (
            <CheckCircle2 size={42} />
          )}
          <p className="eyebrow">Equipe inscrita</p>
          <h1>{data.campeonato?.nome}</h1>
          <p>
            {data.grupo?.nome} · {data.equipe.nome}
          </p>

          {minhasParticipacoes.length > 1 ? (
            <label className="field">
              <span>Line inscrita</span>
              <select value={selectedParticipacao?.id || ''} onChange={(e) => setSelectedParticipacaoId(e.target.value)}>
                {minhasParticipacoes.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.nome_exibicao}
                    {part.slot_numero ? ` · slot ${part.slot_numero}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : selectedParticipacao ? (
            <div className="invite-current-team">
              <small>Line confirmada</small>
              <strong>{selectedParticipacao.nome_exibicao}</strong>
              <span>
                {selectedParticipacao.quantidade_jogadores}/{selectedParticipacao.limite_jogadores} jogadores
                {selectedParticipacao.slot_numero ? ` · slot ${selectedParticipacao.slot_numero}` : ''}
              </span>
            </div>
          ) : null}

          {view === 'hub' ? (
            <div className="invite-hub-actions">
              <button className="invite-hub-option" type="button" onClick={() => setView('acompanhar')}>
                <Users size={20} />
                <span>
                  <strong>Acompanhar grupo</strong>
                  <small>Veja as equipes e lines que já entraram neste grupo</small>
                </span>
              </button>
              <button className="invite-hub-option" type="button" onClick={() => setView('escalar')}>
                <Link2 size={20} />
                <span>
                  <strong>Escalar elenco</strong>
                  <small>Gere o link de escalação para os jogadores entrarem na line</small>
                </span>
              </button>
              <button className="invite-hub-option" type="button" onClick={() => setView('jogadores')}>
                <ListChecks size={20} />
                <span>
                  <strong>Jogadores inscritos</strong>
                  <small>Acompanhe quem já confirmou na sua escalação</small>
                </span>
              </button>
            </div>
          ) : null}

          {view === 'acompanhar' ? (
            <div className="invite-section">
              <div className="invite-section-head">
                <h2>Equipes no grupo</h2>
                <button className="button secondary" type="button" onClick={() => setView('hub')}>
                  Voltar
                </button>
              </div>
              <div className="invite-mini-stats">
                <span>
                  <strong>{data.resumo_grupo?.ocupadas ?? 0}</strong> ocupadas
                </span>
                <span>
                  <strong>{data.resumo_grupo?.livres ?? 0}</strong> livres
                </span>
                <span>
                  <strong>{data.resumo_grupo?.total ?? 0}</strong> total
                </span>
              </div>
              <div className="lineup-slots public-lineup-slots">
                {(data.vagas || []).map((vaga) => (
                  <div className={`lineup-slot ${vaga.ocupada ? 'occupied' : ''}`} key={vaga.index}>
                    <b>{vaga.slot_letra || vaga.index + 1}</b>
                    {vaga.logo_url ? <img src={vaga.logo_url} alt="" /> : null}
                    <div>
                      <strong>{vaga.ocupada ? vaga.line_nome || vaga.nome : vaga.nome}</strong>
                      <span>
                        {vaga.ocupada
                          ? `${vaga.equipe_nome || 'Equipe'}${vaga.line_nome ? ` · ${vaga.line_nome}` : ''}`
                          : 'Disponível'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {view === 'escalar' ? (
            <div className="invite-section">
              <div className="invite-section-head">
                <h2>Escalar elenco</h2>
                <button className="button secondary" type="button" onClick={() => setView('hub')}>
                  Voltar
                </button>
              </div>
              <p className="invite-section-copy">
                Gere um link de escalação para a line <strong>{selectedParticipacao?.nome_exibicao}</strong>. Os
                jogadores entram por esse link, igual ao painel da equipe.
              </p>

              {selectedParticipacao?.link_escalacao ? (
                <div className="invite-link-box">
                  <small>Link ativo</small>
                  <strong>{`${typeof window !== 'undefined' ? window.location.origin : ''}${selectedParticipacao.link_escalacao.public_path}`}</strong>
                  <span>
                    Limite {selectedParticipacao.link_escalacao.limite_jogadores} jogadores
                    {selectedParticipacao.link_escalacao.expira_em
                      ? ` · expira ${new Date(selectedParticipacao.link_escalacao.expira_em).toLocaleString('pt-BR')}`
                      : ''}
                  </span>
                  <div className="invite-inline-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() =>
                        copiar(
                          `${window.location.origin}${selectedParticipacao.link_escalacao!.public_path}`,
                          'Link de escalação copiado.',
                        )
                      }
                    >
                      <ClipboardCopy size={15} /> Copiar link
                    </button>
                    <a className="button secondary" href={selectedParticipacao.link_escalacao.public_path} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  </div>
                </div>
              ) : null}

              {generated ? (
                <div className="invite-link-box">
                  <small>Novo link gerado</small>
                  <strong>{generated.link}</strong>
                  <div className="invite-inline-actions">
                    <button className="button" type="button" onClick={() => copiar(generated.link, 'Link copiado.')}>
                      <ClipboardCopy size={15} /> Copiar link
                    </button>
                    <button className="button secondary" type="button" onClick={() => copiar(generated.texto, 'Mensagem copiada.')}>
                      Copiar mensagem
                    </button>
                  </div>
                </div>
              ) : null}

              <button className="button invite-confirm" type="button" disabled={busy} onClick={() => void gerarLinkEscalacao()}>
                <UserPlus size={16} />
                {selectedParticipacao?.link_escalacao ? 'Gerar novo link de escalação' : 'Gerar link de escalação'}
              </button>
            </div>
          ) : null}

          {view === 'jogadores' ? (
            <div className="invite-section">
              <div className="invite-section-head">
                <h2>Jogadores inscritos</h2>
                <button className="button secondary" type="button" onClick={() => setView('hub')}>
                  Voltar
                </button>
              </div>
              <p className="invite-section-copy">
                {selectedParticipacao?.quantidade_jogadores || 0} de {selectedParticipacao?.limite_jogadores || 6} vagas
                preenchidas na line <strong>{selectedParticipacao?.nome_exibicao}</strong>.
              </p>
              {(selectedParticipacao?.jogadores || []).length === 0 ? (
                <p className="invite-empty">Nenhum jogador inscrito ainda. Gere o link de escalação e envie para o elenco.</p>
              ) : (
                <div className="invite-player-list">
                  {selectedParticipacao?.jogadores.map((player) => (
                    <div className="invite-player-row" key={player.id}>
                      <span className="invite-player-avatar">
                        {player.foto_url ? <img src={player.foto_url} alt="" /> : <Users size={16} />}
                      </span>
                      <div>
                        <strong>{player.nick}</strong>
                        <small>
                          {player.funcao || 'função'}
                          {player.id_jogo ? ` · ID ${player.id_jogo}` : ''}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="invite-inline-actions">
                <button className="button" type="button" onClick={() => setView('escalar')}>
                  Ir para escalação
                </button>
                <button className="button secondary" type="button" onClick={() => void carregar({ preferHub: true })}>
                  Atualizar
                </button>
              </div>
            </div>
          ) : null}

          {message ? <p className="invite-message">{message}</p> : null}

          {view === 'hub' ? (
            <div className="invite-footer-links">
              {vagasLivres.length ? (
                <button className="button secondary" type="button" onClick={() => setView('entrada')}>
                  Inscrever outra line
                </button>
              ) : null}
              <a className="button secondary" href="/">
                Painel da equipe
              </a>
            </div>
          ) : null}
        </div>
      </main>
    )
  }

  return (
    <main className="invite-page">
      <div className="invite-card">
        {data.campeonato?.logo_url ? (
          <img className="invite-champ-logo" src={data.campeonato.logo_url} alt="" />
        ) : (
          <Users size={42} />
        )}
        <p className="eyebrow">Entrada de equipes</p>
        <h1>{data.campeonato?.nome}</h1>
        <p>{data.grupo?.nome}</p>

        <div className="lineup-slots public-lineup-slots">
          {(data.vagas || []).map((vaga) => (
            <div className={`lineup-slot ${vaga.ocupada ? 'occupied' : ''}`} key={vaga.index}>
              <b>{vaga.slot_letra || vaga.index + 1}</b>
              {vaga.logo_url ? <img src={vaga.logo_url} alt="" /> : null}
              <div>
                <strong>{vaga.nome}</strong>
                <span>
                  {vaga.ocupada ? `${vaga.line_nome || 'Line'} · ${vaga.equipe_nome || 'Equipe'}` : 'Disponível'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {data.autenticado ? (
          data.equipe ? (
            <div className="invite-team-confirmation">
              <div className="invite-current-team">
                <small>Confirmar com a equipe vinculada</small>
                <strong>{data.equipe.nome}</strong>
                {data.equipe.tag ? <span>{data.equipe.tag}</span> : null}
              </div>

              {data.inscrita ? (
                <button className="button invite-confirm" type="button" onClick={() => setView('hub')}>
                  Abrir opções da inscrição
                </button>
              ) : null}

              <label className="field">
                <span>Escolha a vaga esperada</span>
                <select value={vagaIndex} onChange={(event) => setVagaIndex(event.target.value)}>
                  {vagasLivres.map((vaga) => (
                    <option value={vaga.index} key={vaga.index}>
                      {vaga.nome}
                    </option>
                  ))}
                </select>
              </label>

              {linesDisponiveis.length ? (
                <label className="field">
                  <span>Escolha a line real</span>
                  <select
                    value={lineId}
                    onChange={(event) => {
                      setLineId(event.target.value)
                      setNomeNovaLine('')
                    }}
                  >
                    {linesDisponiveis.map((line) => (
                      <option value={line.id} key={line.id}>
                        {line.nome}
                      </option>
                    ))}
                    <option value="">Criar nova line</option>
                  </select>
                </label>
              ) : null}

              {!lineId ? (
                <label className="field">
                  <span>Nome da nova line</span>
                  <input
                    value={nomeNovaLine}
                    onChange={(event) => setNomeNovaLine(event.target.value)}
                    placeholder="Ex.: OS MATADORES"
                  />
                </label>
              ) : null}

              <button
                className="button invite-confirm"
                onClick={confirmar}
                disabled={busy || !vagasLivres.length}
              >
                {busy ? 'Confirmando...' : 'Confirmar entrada'}
              </button>
              <a
                className="button secondary"
                href={buildLoginHref('equipe', `/convite/grupo/${encodeURIComponent(token)}`, true)}
              >
                Usar outra equipe
              </a>
            </div>
          ) : (
            <div className="invite-auth-box">
              <p>Seu login está ativo, mas ainda não possui um perfil de equipe vinculado.</p>
              <a
                className="button"
                href={buildProfileCreationHref('equipe', `/convite/grupo/${encodeURIComponent(token)}`)}
              >
                Criar equipe com meu login atual
              </a>
              <a
                className="button secondary"
                href={buildLoginHref('equipe', `/convite/grupo/${encodeURIComponent(token)}`, true)}
              >
                Criar equipe com outro login
              </a>
            </div>
          )
        ) : (
          <div className="invite-auth-actions">
            <SocialLogin profileType="equipe" returnTo={`/convite/grupo/${encodeURIComponent(token)}`} />
          </div>
        )}

        {message ? <p className="invite-message">{message}</p> : null}
      </div>
    </main>
  )
}
