'use client'

import { CHAMPIONSHIP_TYPE_LABELS, CHAMPIONSHIP_TYPES } from '@/lib/dropzone-constants'
import { Field, UploadField } from '@/features/dropzone/components/form-fields'

export type CampeonatoFormValue = {
  nome: string
  tipo: string
  logo_url: string
  premiacao: string
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
  tipo: 'copa',
  logo_url: '',
  premiacao: '',
  divisao_premiacao: '',
  numero_vagas: '',
  formato: '',
  plataforma: '',
  servidor: '',
  tipo_premiacao: '',
  tem_trofeu: false,
  tem_live: false,
  vagas_por_equipe: '',
  jogadores_por_vaga: '',
  permite_troca_jogadores: false,
  data_limite_trocas: '',
  data_limite_inscricao: '',
  aceita_novas_inscricoes_equipes: true,
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
  function update<K extends keyof CampeonatoFormValue>(key: K, next: CampeonatoFormValue[K]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <div className="championship-form-stack">
      <section className="form-section-card">
        <p className="eyebrow">Dados obrigatórios</p>
        <div className="mini-grid three">
          <Field label="Nome do campeonato"><input value={value.nome} onChange={(e) => update('nome', e.target.value)} /></Field>
          <Field label="Tipo">
            <select value={value.tipo} onChange={(e) => update('tipo', e.target.value)}>
              {CHAMPIONSHIP_TYPES.map((type) => <option key={type} value={type}>{CHAMPIONSHIP_TYPE_LABELS[type]}</option>)}
            </select>
          </Field>
          <UploadField label="Logo do campeonato" value={value.logo_url} bucket="campeonato" onChange={(url) => update('logo_url', url)} onUpload={uploadPublicFile} />
        </div>
      </section>

      <section className="form-section-card">
        <p className="eyebrow">Informações do campeonato</p>
        <div className="mini-grid three">
          <Field label="Premiação"><input value={value.premiacao} onChange={(e) => update('premiacao', e.target.value)} /></Field>
          <Field label="Número de vagas"><input type="number" min="1" value={value.numero_vagas} onChange={(e) => update('numero_vagas', e.target.value)} /></Field>
          <Field label="Formato"><input value={value.formato} onChange={(e) => update('formato', e.target.value)} placeholder="Ex.: pontos corridos, grupos + final" /></Field>
          <Field label="Plataforma">
            <select value={value.plataforma} onChange={(e) => update('plataforma', e.target.value)}>
              <option value="">Selecione</option><option value="mobile">Mobile</option><option value="emulador">Emulador</option><option value="misto">Misto</option>
            </select>
          </Field>
          <Field label="Servidor"><input value={value.servidor} onChange={(e) => update('servidor', e.target.value)} placeholder="Ex.: Brasil" /></Field>
          <Field label="Tipo de premiação"><input value={value.tipo_premiacao} onChange={(e) => update('tipo_premiacao', e.target.value)} placeholder="Dinheiro, diamantes..." /></Field>
        </div>
        <Field label="Divisão da premiação"><textarea value={value.divisao_premiacao} onChange={(e) => update('divisao_premiacao', e.target.value)} /></Field>
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
