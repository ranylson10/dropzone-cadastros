/**
 * Pré-preenche respostas do rulebook a partir dos dados já cadastrados no campeonato.
 * Reduz retrabalho no fluxo de criação.
 */
import type { AnswersMap } from './rulebook.types'

export type CampeonatoSeedSource = {
  nome?: string | null
  tipo?: string | null
  premiacao?: string | null
  divisao_premiacao?: string | null
  descricao_premiacao?: string | null
  valor_inscricao?: string | number | null
  tipo_premiacao?: string | null
  tem_live?: boolean | null
  tem_trofeu?: boolean | null
  plataforma?: string | null
  formato?: string | null
  vagas_por_equipe?: string | number | null
  jogadores_por_vaga?: string | number | null
  // tabela campeonato_configuracoes ou campos soltos
  [key: string]: unknown
}

function moneyText(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/r\$/i.test(raw)) return raw
  const n = Number(String(raw).replace(/[^\d.,]/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return raw
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function parsePositiveInt(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

/**
 * Gera respostas iniciais apenas com o que o campeonato já define com segurança.
 * Não sobrescreve chaves já presentes em `current`.
 */
export function seedAnswersFromCampeonato(
  camp: CampeonatoSeedSource | null | undefined,
  current: AnswersMap = {},
): { respostas: AnswersMap; campos: string[] } {
  const respostas: AnswersMap = { ...current }
  const campos: string[] = []

  const setIfEmpty = (id: string, value: AnswersMap[string], label: string) => {
    if (respostas[id] !== undefined && respostas[id] !== null && respostas[id] !== '') return
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value) && value.length === 0) return
    respostas[id] = value
    campos.push(label)
  }

  if (!camp) return { respostas, campos }

  // Transmissão
  if (typeof camp.tem_live === 'boolean') {
    setIfEmpty('possui_transmissao', camp.tem_live, 'Transmissão (tem_live)')
  }

  // Premiação
  const tipoPremio = String(camp.tipo_premiacao || '').toLowerCase()
  if (tipoPremio === 'sem_premiacao') {
    setIfEmpty('possui_premiacao', false, 'Sem premiação')
  } else if (tipoPremio && tipoPremio !== 'sem_premiacao') {
    setIfEmpty('possui_premiacao', true, 'Possui premiação')
    const partes: string[] = []
    if (camp.premiacao) partes.push(`Premiação: ${moneyText(camp.premiacao)}`)
    if (camp.divisao_premiacao) partes.push(String(camp.divisao_premiacao))
    if (camp.descricao_premiacao) partes.push(String(camp.descricao_premiacao))
    if (camp.tem_trofeu) partes.push('Inclui troféu.')
    if (partes.length) {
      setIfEmpty('descricao_premiacao', partes.join('\n'), 'Descrição da premiação')
    }
  } else if (camp.premiacao || camp.divisao_premiacao || camp.descricao_premiacao) {
    setIfEmpty('possui_premiacao', true, 'Possui premiação')
    const partes = [
      camp.premiacao ? moneyText(camp.premiacao) : '',
      camp.divisao_premiacao ? String(camp.divisao_premiacao) : '',
      camp.descricao_premiacao ? String(camp.descricao_premiacao) : '',
    ].filter(Boolean)
    setIfEmpty('descricao_premiacao', partes.join('\n'), 'Descrição da premiação')
  }

  // Taxa de inscrição
  const taxa = moneyText(camp.valor_inscricao)
  if (taxa) {
    const numeric = Number(String(camp.valor_inscricao).replace(/[^\d.,]/g, '').replace(',', '.'))
    if (Number.isFinite(numeric) && numeric > 0) {
      setIfEmpty('possui_taxa', true, 'Taxa de inscrição')
      setIfEmpty('valor_taxa', taxa, 'Valor da taxa')
    } else if (String(camp.valor_inscricao).trim()) {
      // valor textual sem número claro
      setIfEmpty('possui_taxa', true, 'Taxa de inscrição')
      setIfEmpty('valor_taxa', String(camp.valor_inscricao), 'Valor da taxa')
    }
  }

  // Plataforma
  const plat = String(camp.plataforma || '').toLowerCase()
  if (plat.includes('emul') && plat.includes('mobile')) {
    setIfEmpty('plataforma', ['ambos'], 'Plataforma')
    setIfEmpty('emulador_proibido', false, 'Emulador permitido')
  } else if (plat.includes('emul') || plat.includes('pc')) {
    setIfEmpty('plataforma', ['emulador'], 'Plataforma')
    setIfEmpty('emulador_proibido', false, 'Emulador')
  } else if (plat.includes('mobile') || plat.includes('android') || plat.includes('ios')) {
    setIfEmpty('plataforma', ['mobile'], 'Plataforma')
    setIfEmpty('emulador_proibido', true, 'Emulador proibido')
  }

  // Formato do evento (online / presencial / híbrido)
  const formato = String(camp.formato || '').toLowerCase()
  if (formato.includes('hibr') || formato.includes('híbr')) {
    setIfEmpty('formato_evento', 'hibrido', 'Formato do evento')
  } else if (formato.includes('presenc') || formato.includes('lan') || formato.includes('offline')) {
    setIfEmpty('formato_evento', 'presencial', 'Formato do evento')
  } else if (formato.includes('online') || formato.includes('remoto')) {
    setIfEmpty('formato_evento', 'online', 'Formato do evento')
  }

  // Titulares / reservas a partir de jogadores_por_vaga e vagas_por_equipe
  const porVaga = parsePositiveInt(camp.jogadores_por_vaga)
  const vagas = parsePositiveInt(camp.vagas_por_equipe)
  if (porVaga) {
    // Em Free Fire squad costuma ser 4 titulares; se jogadores_por_vaga >= 4, usa 4 e resto reserva
    if (porVaga >= 4) {
      setIfEmpty('qtd_titulares', 4, 'Titulares')
      setIfEmpty('modalidade', 'squad', 'Modalidade Squad')
      if (porVaga > 4) {
        setIfEmpty('permite_reservas', true, 'Reservas')
        setIfEmpty('qtd_reservas', Math.min(4, porVaga - 4), 'Qtd. reservas')
      }
    } else if (porVaga === 2) {
      setIfEmpty('qtd_titulares', 2, 'Titulares')
      setIfEmpty('modalidade', 'duo', 'Modalidade Duo')
    } else if (porVaga === 1) {
      setIfEmpty('qtd_titulares', 1, 'Titulares')
      setIfEmpty('modalidade', 'solo', 'Modalidade Solo')
    } else {
      setIfEmpty('qtd_titulares', porVaga, 'Titulares')
    }
  } else if (vagas && vagas >= 4) {
    setIfEmpty('qtd_titulares', 4, 'Titulares')
    if (vagas > 4) {
      setIfEmpty('permite_reservas', true, 'Reservas')
      setIfEmpty('qtd_reservas', Math.min(4, vagas - 4), 'Qtd. reservas')
    }
  }

  // Tipo de campeonato → nível / fases
  const tipo = String(camp.tipo || '').toLowerCase()
  if (tipo === 'liga' || tipo === 'copa') {
    setIfEmpty('nivel_campeonato', tipo === 'liga' ? 'circuito' : 'oficial_parceiro', 'Nível do campeonato')
    setIfEmpty('fase_classificatoria', true, 'Fase classificatória')
  } else if (tipo === 'diario' || tipo === 'xtreino') {
    setIfEmpty('nivel_campeonato', 'comunitario', 'Nível comunitário')
    setIfEmpty('fase_classificatoria', false, 'Sem classificatória longa')
  } else if (tipo === 'confronto') {
    setIfEmpty('fase_eliminatoria', true, 'Fase eliminatória')
  }

  return { respostas, campos }
}
