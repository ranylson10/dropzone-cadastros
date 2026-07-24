'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Dumbbell, Medal, Plus, Swords, Trash2, Trophy } from 'lucide-react'
import { CHAMPIONSHIP_TYPE_LABELS, type ChampionshipType } from '@/lib/dropzone-constants'
import { championshipThemeStyle } from '@/lib/championship-theme'
import { Field, UploadField } from '@/features/dropzone/components/form-fields'
import { PremiacaoDivisaoEditor } from './PremiacaoDivisaoEditor'

export type CampeonatoFormValue = {
  nome: string
  tipo: string
  logo_url: string
  banner_url: string
  regras_url: string
  premiacao: string
  valor_inscricao: string
  descricao_premiacao: string
  divisao_premiacao: string
  numero_vagas: string
  formato: string
  plataforma: string
  servidor: string
  tipo_premiacao: string
  tem_trofeu: boolean
  tem_live: boolean
  vagas_por_equipe: string
  jogadores_por_vaga: string
  permite_jogador_multiplas_equipes: boolean
  permite_troca_jogadores: boolean
  data_limite_trocas: string
  data_limite_inscricao: string
  aceita_novas_inscricoes_equipes: boolean
  contatos_whatsapp: CampeonatoWhatsappContact[]
  /** Tema visual do campeonato */
  cor_principal: string
  cor_secundaria: string
  /** Intensidade da cor no fundo (0–100) */
  bg_opacidade: string
  /** Imagem de fundo do layout (opcional) */
  bg_image_url: string
  cor_texto_clara: string
  cor_texto_escura: string
  /** Recursos cobrados no pacote DropZone (criação) */
  recurso_export: boolean
  recurso_stream: boolean
  recurso_rulebook: boolean
  recurso_stats: boolean
  recurso_broadcast: boolean
}

export type CampeonatoWhatsappContact = {
  id: string
  nome: string
  pais: string
  bandeira: string
  ddi: string
  telefone: string
}

export const WHATSAPP_COUNTRIES = [
  { pais: 'Brasil', bandeira: '🇧🇷', ddi: '+55' },
  { pais: 'Portugal', bandeira: '🇵🇹', ddi: '+351' },
  { pais: 'Estados Unidos', bandeira: '🇺🇸', ddi: '+1' },
  { pais: 'Argentina', bandeira: '🇦🇷', ddi: '+54' },
  { pais: 'Paraguai', bandeira: '🇵🇾', ddi: '+595' },
] as const

export const emptyCampeonatoForm: CampeonatoFormValue = {
  nome: '',
  tipo: '',
  logo_url: '',
  banner_url: '',
  regras_url: '',
  premiacao: '',
  valor_inscricao: '',
  descricao_premiacao: '',
  divisao_premiacao: '',
  numero_vagas: '',
  formato: '',
  plataforma: '',
  servidor: '',
  tipo_premiacao: 'sem_premiacao',
  tem_trofeu: false,
  tem_live: false,
  vagas_por_equipe: '',
  jogadores_por_vaga: '',
  permite_jogador_multiplas_equipes: false,
  permite_troca_jogadores: false,
  data_limite_trocas: '',
  data_limite_inscricao: '',
  aceita_novas_inscricoes_equipes: true,
  contatos_whatsapp: [],
  cor_principal: '#ff4655',
  cor_secundaria: '#17191d',
  bg_opacidade: '18',
  bg_image_url: '',
  cor_texto_clara: '#ffffff',
  cor_texto_escura: '#17191d',
  recurso_export: true,
  recurso_stream: true,
  recurso_rulebook: true,
  recurso_stats: true,
  recurso_broadcast: false,
}

const TYPE_OPTIONS: Array<{
  type: ChampionshipType
  title: string
  description: string
  format: string
  icon: typeof Trophy
}> = [
  {
    type: 'diario',
    title: 'Diário',
    description: 'Evento rápido em grupo único, com uma rodada e um vencedor.',
    format: 'Grupo único / jogo único',
    icon: CalendarDays,
  },
  {
    type: 'copa',
    title: 'Copa',
    description: 'Competição eliminatória com grupos, classificatórias e fases finais.',
    format: 'Grupos e fases eliminatórias',
    icon: Trophy,
  },
  {
    type: 'liga',
    title: 'Liga',
    description: 'Poucas equipes disputam várias rodadas em sistema de pontos corridos.',
    format: 'Pontos corridos',
    icon: Medal,
  },
  {
    type: 'xtreino',
    title: 'X-Treino',
    description: 'Treino preparatório que pode usar jogo único, mata-mata ou pontos corridos.',
    format: 'Jogo único',
    icon: Dumbbell,
  },
  {
    type: 'confronto',
    title: 'Confronto',
    description: 'Disputa direta 4x4 entre equipes, em modo Tático, UMP ou personalizado.',
    format: 'Confronto direto 4x4 - Tático',
    icon: Swords,
  },
]

function defaultFormat(type: string) {
  return TYPE_OPTIONS.find((option) => option.type === type)?.format || ''
}

function moneyDisplay(value: string) {
  if (!value) return ''
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(parsed)
}

function moneyValue(input: string) {
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toFixed(2)
}

type PriceQuote = {
  valor_total_brl: string
  valor_total_centavos: number
  linhas: Array<{ chave: string; rotulo: string; valor_centavos: number; qtd?: number }>
}

export function CampeonatoForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  loading,
  mode = 'create',
  uploadPublicFile,
}: {
  value: CampeonatoFormValue
  onChange: (value: CampeonatoFormValue) => void
  onSubmit: () => void
  onCancel?: () => void
  loading: boolean
  mode?: 'create' | 'edit'
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
}) {
  const [step, setStep] = useState<'type' | 'form'>(mode === 'edit' ? 'form' : 'type')
  const [quote, setQuote] = useState<PriceQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(false)

  useEffect(() => {
    setStep(mode === 'edit' ? 'form' : 'type')
  }, [mode])

  const selectedType = useMemo(
    () => TYPE_OPTIONS.find((option) => option.type === value.tipo),
    [value.tipo],
  )

  // Cotação ao vivo (só na criação)
  useEffect(() => {
    if (mode !== 'create' || step !== 'form' || !value.tipo) {
      setQuote(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true)
      setQuoteError('')
      try {
        const { data } = await import('@/lib/supabase-browser').then((m) => m.supabase.auth.getSession())
        const token = data.session?.access_token
        const res = await fetch('/api/campeonatos/pricing-quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            tipo: value.tipo,
            numero_vagas: Number(value.numero_vagas) || 0,
            recursos: {
              export: value.recurso_export !== false,
              stream: value.recurso_stream !== false,
              rulebook: value.recurso_rulebook !== false,
              stats: value.recurso_stats !== false,
              broadcast: value.recurso_broadcast === true,
            },
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao cotar')
        if (!cancelled) setQuote(json.quote || null)
      } catch (e: any) {
        if (!cancelled) {
          setQuote(null)
          setQuoteError(e?.message || 'Cotação indisponível (rode o SQL de preços se ainda não rodou).')
        }
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    mode,
    step,
    value.tipo,
    value.numero_vagas,
    value.recurso_export,
    value.recurso_stream,
    value.recurso_rulebook,
    value.recurso_stats,
    value.recurso_broadcast,
  ])

  function update<K extends keyof CampeonatoFormValue>(key: K, next: CampeonatoFormValue[K]) {
    onChange({ ...value, [key]: next })
  }

  function selectType(type: ChampionshipType) {
    const nextFormat = defaultFormat(type)
    onChange({
      ...value,
      tipo: type,
      formato: nextFormat,
    })
    setStep('form')
  }

  function updatePrizeType(nextType: string) {
    onChange({
      ...value,
      tipo_premiacao: nextType,
      premiacao: nextType === 'pix' || nextType === 'dinheiro' ? value.premiacao : '',
      descricao_premiacao: nextType === 'brinde' ? value.descricao_premiacao : '',
      divisao_premiacao: nextType === 'pix' || nextType === 'dinheiro' ? value.divisao_premiacao : '',
    })
  }

  function addWhatsappContact() {
    update('contatos_whatsapp', [
      ...value.contatos_whatsapp,
      { id: crypto.randomUUID(), nome: '', pais: 'Brasil', bandeira: '🇧🇷', ddi: '+55', telefone: '' },
    ])
  }

  function updateWhatsappContact(id: string, patch: Partial<CampeonatoWhatsappContact>) {
    update('contatos_whatsapp', value.contatos_whatsapp.map((contact) => contact.id === id ? { ...contact, ...patch } : contact))
  }

  function removeWhatsappContact(id: string) {
    update('contatos_whatsapp', value.contatos_whatsapp.filter((contact) => contact.id !== id))
  }

  if (step === 'type') {
    return (
      <div className="championship-type-step">
        <div className="championship-step-copy">
          <p className="eyebrow">Etapa 1 de 2</p>
          <h3>Escolha o tipo de campeonato</h3>
          <p>O tipo define o formato inicial e ajuda o sistema a preparar a estrutura correta.</p>
        </div>

        <div className="championship-type-cards">
          {TYPE_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.type}
                className="championship-type-card"
                type="button"
                onClick={() => selectType(option.type)}
              >
                <span className="championship-type-icon"><Icon size={26} /></span>
                <span className="championship-type-card-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="championship-type-format">{option.format}</span>
              </button>
            )
          })}
        </div>

        {onCancel ? (
          <div className="button-row compact-actions">
            <button className="button secondary" type="button" onClick={onCancel}>Cancelar</button>
          </div>
        ) : null}
      </div>
    )
  }

  const showMoneyPrize = value.tipo_premiacao === 'pix' || value.tipo_premiacao === 'dinheiro'
  const showGiftPrize = value.tipo_premiacao === 'brinde'

  return (
    <div className="championship-form-stack">
      <div className="championship-form-progress">
        <div>
          <p className="eyebrow">Etapa 2 de 2</p>
          <strong>{selectedType?.title || CHAMPIONSHIP_TYPE_LABELS[value.tipo as ChampionshipType] || 'Campeonato'}</strong>
          <small>{selectedType?.description}</small>
        </div>
        {mode === 'create' ? (
          <button className="text-action-button" type="button" onClick={() => setStep('type')}>
            <ArrowLeft size={15} /> Alterar tipo
          </button>
        ) : null}
      </div>

      <section className="form-section-card">
        <p className="eyebrow">Dados obrigatórios</p>
        <div className="mini-grid two">
          <Field label="Nome do campeonato"><input required value={value.nome} onChange={(e) => update('nome', e.target.value)} /></Field>
          <UploadField label="Logo do campeonato *" value={value.logo_url} bucket="campeonato" onChange={(url) => update('logo_url', url)} onUpload={uploadPublicFile} />
          <UploadField label="Banner do campeonato" value={value.banner_url} bucket="campeonato" cropTarget="campeonato_banner" onChange={(url) => update('banner_url', url)} onUpload={uploadPublicFile} />
          <Field label="Link do regulamento (opcional)"><input type="url" value={value.regras_url} onChange={(e) => update('regras_url', e.target.value)} placeholder="https://..." /></Field>
        </div>
      </section>

      <section className="form-section-card">
        <p className="eyebrow">Identidade visual</p>
        <p className="empty" style={{ margin: '0 0 12px' }}>
          Escolha 2 cores, a intensidade do fundo e (opcional) uma imagem de background. O sistema usa a cor{' '}
          <strong>mais escura</strong> nos botões, aplica a opacidade no BG e calcula o contraste do texto.
        </p>
        <div className="mini-grid two">
          <Field label="Cor A">
            <div className="color-field-row">
              <input type="color" value={value.cor_principal || '#ff4655'} onChange={(e) => update('cor_principal', e.target.value)} />
              <input value={value.cor_principal || ''} onChange={(e) => update('cor_principal', e.target.value)} placeholder="#ff4655" />
            </div>
          </Field>
          <Field label="Cor B">
            <div className="color-field-row">
              <input type="color" value={value.cor_secundaria || '#17191d'} onChange={(e) => update('cor_secundaria', e.target.value)} />
              <input value={value.cor_secundaria || ''} onChange={(e) => update('cor_secundaria', e.target.value)} placeholder="#17191d" />
            </div>
          </Field>
        </div>
        <div className="mini-grid two" style={{ marginTop: 12 }}>
          <Field label={`Opacidade do fundo (${value.bg_opacidade || 18}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Number(value.bg_opacidade || 18)}
              onChange={(e) => update('bg_opacidade', e.target.value)}
            />
            <div className="color-field-row" style={{ marginTop: 8 }}>
              <input
                type="number"
                min={0}
                max={100}
                value={value.bg_opacidade || '18'}
                onChange={(e) => update('bg_opacidade', e.target.value)}
                style={{ gridColumn: '1 / -1' }}
              />
            </div>
          </Field>
          <UploadField
            label="Imagem de fundo (opcional)"
            value={value.bg_image_url}
            bucket="campeonato"
            onChange={(url) => update('bg_image_url', url)}
            onUpload={uploadPublicFile}
          />
        </div>
        <div
          className="champ-theme-preview champ-theme"
          style={championshipThemeStyle({
            cor_principal: value.cor_principal,
            cor_secundaria: value.cor_secundaria,
            bg_opacidade: value.bg_opacidade,
            bg_image_url: value.bg_image_url,
          })}
        >
          <div className="champ-theme-preview-banner">Prévia do banner</div>
          <div className="champ-theme-preview-body">
            <div>
              <strong>Área clara do layout</strong>
              <small style={{ display: 'block', marginTop: 4, opacity: 0.75 }}>
                Botão = cor mais escura · BG com {value.bg_opacidade || 18}%
              </small>
            </div>
            <button type="button" className="champ-theme-preview-btn">Botão principal</button>
          </div>
        </div>
      </section>

      <section className="form-section-card">
        <p className="eyebrow">Estrutura do campeonato</p>
        <div className="mini-grid three">
          <Field label="Limite de vagas (meta)">
            <input
              type="number"
              min="1"
              value={value.numero_vagas}
              onChange={(e) => update('numero_vagas', e.target.value)}
              placeholder="Ex.: 96 — não cria slots; só limita"
            />
          </Field>

          {value.tipo === 'xtreino' ? (
            <Field label="Formato do X-Treino">
              <select value={value.formato} onChange={(e) => update('formato', e.target.value)}>
                <option value="Jogo único">Jogo único</option>
                <option value="Mata-mata">Mata-mata</option>
                <option value="Pontos corridos">Pontos corridos</option>
              </select>
            </Field>
          ) : value.tipo === 'confronto' ? (
            <Field label="Modo do confronto">
              <select value={value.formato} onChange={(e) => update('formato', e.target.value)}>
                <option value="Confronto direto 4x4 - Tático">Tático</option>
                <option value="Confronto direto 4x4 - UMP">UMP</option>
                <option value="Confronto direto 4x4 - Personalizado">Personalizado</option>
              </select>
            </Field>
          ) : (
            <Field label="Formato automático"><input value={value.formato || defaultFormat(value.tipo)} readOnly /></Field>
          )}

          <Field label="Plataforma">
            <select value={value.plataforma} onChange={(e) => update('plataforma', e.target.value)}>
              <option value="">Selecione</option>
              <option value="mobile">Mobile</option>
              <option value="emulador">Emulador</option>
              <option value="misto">Misto</option>
            </select>
          </Field>
          <Field label="Servidor"><input value={value.servidor} onChange={(e) => update('servidor', e.target.value)} placeholder="Ex.: Brasil" /></Field>
        </div>
      </section>

      <section className="form-section-card">
        <p className="eyebrow">Premiação e inscrição</p>
        <div className="mini-grid three">
          <Field label="Tipo de premiação">
            <select value={value.tipo_premiacao} onChange={(e) => updatePrizeType(e.target.value)}>
              <option value="sem_premiacao">Sem premiação</option>
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="brinde">Brinde</option>
            </select>
          </Field>

          {showMoneyPrize ? (
            <Field label="Valor da premiação">
              <input
                inputMode="numeric"
                value={moneyDisplay(value.premiacao)}
                onChange={(e) => update('premiacao', moneyValue(e.target.value))}
                placeholder="R$ 0,00"
              />
            </Field>
          ) : null}

          <Field label="Valor da inscrição">
            <input
              inputMode="numeric"
              value={moneyDisplay(value.valor_inscricao)}
              onChange={(e) => update('valor_inscricao', moneyValue(e.target.value))}
              placeholder="R$ 0,00"
            />
          </Field>
        </div>

        {showGiftPrize ? (
          <Field label="Descrição do brinde"><textarea value={value.descricao_premiacao} onChange={(e) => update('descricao_premiacao', e.target.value)} placeholder="Ex.: troféu, camisa personalizada e kit gamer" /></Field>
        ) : null}

        {showMoneyPrize ? (
          <PremiacaoDivisaoEditor
            totalPremiacao={value.premiacao}
            value={value.divisao_premiacao}
            onChange={(serialized) => update('divisao_premiacao', serialized)}
            disabled={loading}
          />
        ) : null}

        <div className="checkbox-row">
          <label><input type="checkbox" checked={value.tem_trofeu} onChange={(e) => update('tem_trofeu', e.target.checked)} /> Tem troféu</label>
          <label><input type="checkbox" checked={value.tem_live} onChange={(e) => update('tem_live', e.target.checked)} /> Tem transmissão ao vivo</label>
        </div>
      </section>

      <section className="form-section-card">
        <p className="eyebrow">Controle de inscrições</p>
        <div className="mini-grid three">
          <Field label="Vagas por equipe"><input type="number" min="1" value={value.vagas_por_equipe} onChange={(e) => update('vagas_por_equipe', e.target.value)} /></Field>
          <Field label="Players por vaga"><input type="number" min="1" value={value.jogadores_por_vaga} onChange={(e) => update('jogadores_por_vaga', e.target.value)} /></Field>
          <Field label="Data limite de inscrição"><input type="datetime-local" value={value.data_limite_inscricao} onChange={(e) => update('data_limite_inscricao', e.target.value)} /></Field>
        </div>
        <div className="checkbox-row">
          <label><input type="checkbox" checked={value.aceita_novas_inscricoes_equipes} onChange={(e) => update('aceita_novas_inscricoes_equipes', e.target.checked)} /> Aceitar novas inscrições de equipes</label>
          <label><input type="checkbox" checked={value.permite_jogador_multiplas_equipes} onChange={(e) => update('permite_jogador_multiplas_equipes', e.target.checked)} /> Permitir jogador em mais de uma line</label>
          <label><input type="checkbox" checked={value.permite_troca_jogadores} onChange={(e) => update('permite_troca_jogadores', e.target.checked)} /> Permitir troca de jogadores</label>
        </div>
        {value.permite_troca_jogadores ? (
          <Field label="Data limite para troca de jogadores"><input type="datetime-local" value={value.data_limite_trocas} onChange={(e) => update('data_limite_trocas', e.target.value)} /></Field>
        ) : null}
      </section>

      <section className="form-section-card whatsapp-contacts-section">
        <div className="form-section-heading">
          <div><p className="eyebrow">Venda de vagas</p><strong>Contatos do WhatsApp</strong></div>
          <button className="button secondary" type="button" onClick={addWhatsappContact}><Plus size={15} /> Adicionar contato</button>
        </div>
        {value.contatos_whatsapp.length ? (
          <div className="whatsapp-contact-list">
            {value.contatos_whatsapp.map((contact) => (
              <div className="whatsapp-contact-row" key={contact.id}>
                <Field label="Nome do vendedor"><input value={contact.nome} onChange={(event) => updateWhatsappContact(contact.id, { nome: event.target.value })} placeholder="Ex.: Paulo" /></Field>
                <Field label="País do contato">
                  <select value={contact.ddi} onChange={(event) => {
                    const country = WHATSAPP_COUNTRIES.find((item) => item.ddi === event.target.value) || WHATSAPP_COUNTRIES[0]
                    updateWhatsappContact(contact.id, country)
                  }}>
                    {WHATSAPP_COUNTRIES.map((country) => <option value={country.ddi} key={country.ddi}>{country.bandeira} {country.pais} ({country.ddi})</option>)}
                  </select>
                </Field>
                <Field label="Contato">
                  <div className="phone-input-group"><span>{contact.bandeira} {contact.ddi}</span><input inputMode="tel" value={contact.telefone} onChange={(event) => updateWhatsappContact(contact.id, { telefone: event.target.value.replace(/[^0-9 ()-]/g, '') })} placeholder="(91) 99999-9999" /></div>
                </Field>
                <button className="inline-icon-button whatsapp-contact-remove" type="button" onClick={() => removeWhatsappContact(contact.id)} aria-label={`Remover contato de ${contact.nome || 'vendedor'}`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        ) : <p className="form-empty-note">Nenhum contato de venda cadastrado.</p>}
      </section>

      {mode === 'create' ? (
        <section className="form-section-card championship-pricing-card">
          <p className="eyebrow">Pacote DropZone · valor estimado</p>
          <p className="empty" style={{ margin: '0 0 12px' }}>
            O campeonato fica <strong>pendente de aprovação</strong> do admin do sistema. O valor abaixo é a
            cotação automática (base + vagas + recursos).
          </p>
          <div className="championship-resource-grid">
            {(
              [
                ['recurso_export', 'Export / Spec'],
                ['recurso_stream', 'Overlays Stream'],
                ['recurso_rulebook', 'Rulebook PDF'],
                ['recurso_stats', 'Tabelas e stats'],
                ['recurso_broadcast', 'Broadcast pack'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="championship-resource-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(value[key])}
                  onChange={(e) => update(key, e.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="championship-quote-box">
            {quoteLoading ? <small>Calculando…</small> : null}
            {quoteError ? <small className="error-text">{quoteError}</small> : null}
            {quote ? (
              <>
                <ul className="championship-quote-lines">
                  {quote.linhas.map((line) => (
                    <li key={`${line.chave}-${line.qtd || 1}`}>
                      <span>
                        {line.rotulo}
                        {line.qtd && line.qtd > 1 ? ` × ${line.qtd}` : ''}
                      </span>
                      <strong>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          line.valor_centavos / 100,
                        )}
                      </strong>
                    </li>
                  ))}
                </ul>
                <div className="championship-quote-total">
                  <span>Total estimado</span>
                  <strong>{quote.valor_total_brl}</strong>
                </div>
              </>
            ) : !quoteLoading && !quoteError ? (
              <small>Informe tipo e vagas para ver a cotação.</small>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="button-row">
        <button className="button" type="button" onClick={onSubmit} disabled={loading}>{mode === 'edit' ? 'Salvar alterações' : 'Criar campeonato'}</button>
        {onCancel ? <button className="button secondary" type="button" onClick={onCancel} disabled={loading}>Cancelar</button> : null}
      </div>
    </div>
  )
}
