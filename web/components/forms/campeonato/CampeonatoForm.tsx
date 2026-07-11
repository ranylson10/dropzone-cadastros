'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Dumbbell, Medal, Swords, Trophy } from 'lucide-react'
import { CHAMPIONSHIP_TYPE_LABELS, type ChampionshipType } from '@/lib/dropzone-constants'
import { Field, UploadField } from '@/features/dropzone/components/form-fields'

export type CampeonatoFormValue = {
  nome: string
  tipo: string
  logo_url: string
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
  permite_troca_jogadores: boolean
  data_limite_trocas: string
  data_limite_inscricao: string
  aceita_novas_inscricoes_equipes: boolean
}

export const emptyCampeonatoForm: CampeonatoFormValue = {
  nome: '',
  tipo: '',
  logo_url: '',
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
  permite_troca_jogadores: false,
  data_limite_trocas: '',
  data_limite_inscricao: '',
  aceita_novas_inscricoes_equipes: true,
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
  const [step, setStep] = useState<'type' | 'form'>(mode === 'edit' ? 'form' : value.tipo ? 'form' : 'type')

  const selectedType = useMemo(
    () => TYPE_OPTIONS.find((option) => option.type === value.tipo),
    [value.tipo],
  )

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
          <Field label="Nome do campeonato"><input value={value.nome} onChange={(e) => update('nome', e.target.value)} /></Field>
          <UploadField label="Logo do campeonato" value={value.logo_url} bucket="campeonato" onChange={(url) => update('logo_url', url)} onUpload={uploadPublicFile} />
        </div>
      </section>

      <section className="form-section-card">
        <p className="eyebrow">Estrutura do campeonato</p>
        <div className="mini-grid three">
          <Field label="Número de vagas"><input type="number" min="1" value={value.numero_vagas} onChange={(e) => update('numero_vagas', e.target.value)} /></Field>

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
          <Field label="Divisão da premiação"><textarea value={value.divisao_premiacao} onChange={(e) => update('divisao_premiacao', e.target.value)} placeholder="Ex.: 1º R$ 3.000, 2º R$ 2.000, 3º R$ 1.000" /></Field>
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
          <label><input type="checkbox" checked={value.permite_troca_jogadores} onChange={(e) => update('permite_troca_jogadores', e.target.checked)} /> Permitir troca de jogadores</label>
        </div>
        {value.permite_troca_jogadores ? (
          <Field label="Data limite para troca de jogadores"><input type="datetime-local" value={value.data_limite_trocas} onChange={(e) => update('data_limite_trocas', e.target.value)} /></Field>
        ) : null}
      </section>

      <div className="button-row">
        <button className="button" type="button" onClick={onSubmit} disabled={loading}>{mode === 'edit' ? 'Salvar alterações' : 'Criar campeonato'}</button>
        {onCancel ? <button className="button secondary" type="button" onClick={onCancel} disabled={loading}>Cancelar</button> : null}
      </div>
    </div>
  )
}
