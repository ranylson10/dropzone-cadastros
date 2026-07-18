import type { InfracaoConfig, InfracaoTemplate, RulebookModuleId } from './rulebook.types'

/**
 * Catálogo de infrações com campos obrigatórios.
 * Inspirado em tipificações comuns de Free Fire competitivo
 * (hack, smurfing, ghosting, teaming, etc.) — textos originais DropZone.
 */
export const INFRACAO_TEMPLATES: InfracaoTemplate[] = [
  {
    codigo: 'hack_softwares',
    titulo: 'Uso de aplicativos de terceiros e cheats',
    gravidade: 'gravissima',
    requiresModules: ['hack'],
    defaults: {
      definicao:
        'Utilização de aplicativos, softwares, scripts, macros, APKs modificados, ferramentas externas ou qualquer recurso destinado a conceder vantagem competitiva indevida.',
      condicoes:
        'Configura infração a instalação, execução ou uso durante partidas oficiais, independentemente de resultado obtido. A mera presença de ferramenta de vantagem no dispositivo utilizado na partida pode ser considerada, após análise.',
      provas_aceitas:
        'Gravações de tela, análise de dispositivo, denúncia fundamentada, investigação da organização, logs e demais meios lícitos de comprovação.',
      competencia:
        'Organização do campeonato e, quando houver, comissão disciplinar designada.',
      penalidade_inicial:
        'Banimento permanente da competição e desclassificação da equipe, sem prejuízo de medidas administrativas adicionais.',
      penalidade_reincidencia:
        'Banimento permanente estendido a eventos futuros da mesma organização, a critério da organização.',
      direito_defesa: true,
      direito_recurso: true,
      prazo: '24 horas para apresentar defesa escrita após notificação.',
      observacoes:
        'A integridade competitiva é princípio fundamental. Casos duvidosos serão analisados com base no conjunto probatório.',
    },
  },
  {
    codigo: 'ghosting',
    titulo: 'Ghosting',
    gravidade: 'grave',
    requiresModules: ['ghosting'],
    defaults: {
      definicao:
        'Transmitir ou compartilhar informações privilegiadas sobre o andamento da partida com participantes que ainda estejam em jogo, independentemente do meio utilizado.',
      condicoes:
        'Inclui comunicação por voz, mensagens, plataformas de comunicação, transmissões ao vivo sem delay adequado e qualquer meio destinado a fornecer vantagem competitiva.',
      provas_aceitas:
        'Prints, gravações de voz/vídeo, clips de transmissão, testemunhos e investigação da organização.',
      competencia: 'Organização / comissão disciplinar.',
      penalidade_inicial:
        'Advertência grave com perda de pontos da rodada ou desclassificação da partida, conforme gravidade.',
      penalidade_reincidencia: 'Desclassificação da equipe da competição.',
      direito_defesa: true,
      direito_recurso: true,
      prazo: '24 horas para defesa e/ou recurso.',
      observacoes:
        'Managers, coaches e espectadores vinculados à equipe podem ser responsabilizados quando habilitados neste regulamento.',
    },
  },
  {
    codigo: 'smurfing',
    titulo: 'Smurfing / uso de conta de terceiro (Fire Impostor)',
    gravidade: 'gravissima',
    defaults: {
      definicao:
        'Participar com conta de outra pessoa, permitir que terceiro jogue na própria conta, ou utilizar multi-contas para fraudar elegibilidade ou ranking.',
      condicoes:
        'Basta a comprovação de que o jogador em partida não corresponde ao titular cadastrado, ou que a mesma pessoa opera múltiplas contas no mesmo evento.',
      provas_aceitas:
        'Comparação de cadastro, ID do jogo, gravações, análise de conta e demais provas.',
      competencia: 'Organização / comissão disciplinar.',
      penalidade_inicial: 'Desclassificação imediata do jogador e da equipe.',
      penalidade_reincidencia: 'Banimento de eventos futuros da organização.',
      direito_defesa: true,
      direito_recurso: true,
      prazo: '24 horas.',
      observacoes: 'Cada atleta deve utilizar exclusivamente a conta informada no cadastro.',
    },
  },
  {
    codigo: 'teaming',
    titulo: 'Teaming / conluio',
    gravidade: 'gravissima',
    defaults: {
      definicao:
        'Acordo entre equipes ou jogadores de equipes distintas para favorecer ou prejudicar terceiros, dividir resultados ou obter vantagem ilícita.',
      condicoes:
        'Inclui acordos para não se eliminar, dividir prêmios, forjar resultados ou manipular colocações.',
      provas_aceitas: 'VODs, denúncias, padrões de jogo anômalos e investigação.',
      competencia: 'Organização / comissão disciplinar.',
      penalidade_inicial: 'Desclassificação das equipes envolvidas e perda de premiação.',
      penalidade_reincidencia: 'Banimento em eventos futuros.',
      direito_defesa: true,
      direito_recurso: true,
      prazo: '24 horas.',
      observacoes: 'A análise considera o conjunto de condutas e o contexto da partida.',
    },
  },
  {
    codigo: 'bug_abuse',
    titulo: 'Abuso de bugs e exploits',
    gravidade: 'grave',
    requiresModules: ['bug_abuse'],
    defaults: {
      definicao:
        'Utilizar intencionalmente falhas, glitches ou exploits do jogo para obter vantagem competitiva indevida — inclusive clip de colisão, posições inacessíveis, atravessar terreno, invulnerabilidade indevida, loot duplicado ou qualquer movimento/efeito impossível no cliente normal.',
      condicoes:
        'Configura infração o uso deliberado da falha, a manutenção da posição/benefício após perceber o bug, ou a reincidência após comunicação da organização. A mera ocorrência acidental, se o jogador sair imediatamente da posição e reportar, pode ser mitigada a critério da arbitragem.',
      provas_aceitas:
        'Clipes de tela, VOD da transmissão, denúncia fundamentada, gravação de espectador autorizado e análise da arbitragem.',
      competencia: 'Organização / admin de partida / comissão disciplinar.',
      penalidade_inicial:
        'Perda dos pontos da queda e impedimento de disputar a queda seguinte; se for a última queda do dia, anulação e subtração de pontos, conforme o regulamento.',
      penalidade_reincidencia: 'Desclassificação da equipe do campeonato e perda de premiação, se houver.',
      direito_defesa: true,
      direito_recurso: true,
      prazo: '24 horas.',
      observacoes:
        'A lista de exemplos do regulamento é ilustrativa, não exaustiva. Bugs que impeçam o jogo normal devem ser reportados imediatamente; abusar da falha é punível. Casos são analisados com provas antes da aplicação de sanções.',
    },
  },
  {
    codigo: 'desconexao_intencional',
    titulo: 'Desconexão intencional',
    gravidade: 'media',
    requiresModules: ['desconexoes'],
    defaults: {
      definicao:
        'Desconectar-se propositalmente da partida sem autorização da organização, prejudicando o andamento ou o fair play.',
      condicoes:
        'Inclui fechamento forçado do aplicativo, desligamento intencional de rede e abandono sem justificativa aceita.',
      provas_aceitas: 'Relato de admin, logs, gravações e padrões de comportamento.',
      competencia: 'Admin de partida / organização.',
      penalidade_inicial: 'Advertência e/ou perda de pontos da queda.',
      penalidade_reincidencia: 'Desclassificação da rodada ou da equipe.',
      direito_defesa: true,
      direito_recurso: false,
      prazo: '12 horas para defesa em punições graves.',
      observacoes:
        'Problemas legítimos de rede devem ser comunicados imediatamente; a responsabilidade pela conexão é, em regra, do participante.',
    },
  },
  {
    codigo: 'atraso',
    titulo: 'Atraso injustificado',
    gravidade: 'leve',
    requiresModules: ['atrasos'],
    defaults: {
      definicao:
        'Não comparecer ao lobby ou ao check-in dentro do horário oficial e da tolerância prevista neste regulamento.',
      condicoes:
        'Após o tempo de tolerância, a equipe poderá iniciar incompleta, perder a partida por W.O. ou sofrer penalidade de pontos, conforme decisão da organização.',
      provas_aceitas: 'Registro de horário do lobby, check-in e comunicação oficial.',
      competencia: 'Admin de partida / organização.',
      penalidade_inicial: 'Advertência e/ou perda de pontos da rodada.',
      penalidade_reincidencia: 'W.O. da rodada ou desclassificação, conforme gravidade.',
      direito_defesa: false,
      direito_recurso: false,
      prazo: 'Não aplicável a atrasos rotineiros; decisões de W.O. são imediatas.',
      observacoes: 'A organização não é obrigada a atrasar o início da rodada para acomodar equipes atrasadas.',
    },
  },
  {
    codigo: 'conduta_toxico',
    titulo: 'Conduta antidesportiva e linguagem ofensiva',
    gravidade: 'media',
    defaults: {
      definicao:
        'Uso de linguagem ofensiva, discriminatória, assédio, ameaças ou qualquer conduta que viole o respeito entre participantes, staff e público.',
      condicoes:
        'Aplica-se em partidas, canais oficiais, transmissões e redes sociais vinculadas ao evento, quando a conduta estiver relacionada à competição.',
      provas_aceitas: 'Prints, gravações, denúncias e registros de canais oficiais.',
      competencia: 'Organização / comissão disciplinar.',
      penalidade_inicial: 'Advertência formal; em casos graves, suspensão de partidas.',
      penalidade_reincidencia: 'Desclassificação e possível banimento de eventos futuros.',
      direito_defesa: true,
      direito_recurso: true,
      prazo: '24 horas.',
      observacoes: 'Não será tolerado abuso a moderadores, adversários ou staff.',
    },
  },
  {
    codigo: 'emulador',
    titulo: 'Uso indevido de emulador ou dispositivo proibido',
    gravidade: 'grave',
    requiresModules: ['emulador_proibido'],
    defaults: {
      definicao:
        'Participar com emulador, tablet ou dispositivo não autorizado quando o regulamento restringe a plataforma.',
      condicoes: 'A detecção em qualquer partida oficial configura a infração.',
      provas_aceitas: 'Análise técnica, gravações e verificação de dispositivo.',
      competencia: 'Organização.',
      penalidade_inicial: 'Desclassificação da equipe.',
      penalidade_reincidencia: 'Banimento em eventos futuros da organização.',
      direito_defesa: true,
      direito_recurso: true,
      prazo: '24 horas.',
      observacoes: 'A plataforma permitida está definida na configuração deste campeonato.',
    },
  },
  {
    codigo: 'stream_sniping',
    titulo: 'Stream sniping / uso indevido de transmissão',
    gravidade: 'grave',
    requiresModules: ['transmissao'],
    defaults: {
      definicao:
        'Utilizar transmissão oficial ou de terceiros para obter informações em tempo real sobre adversários ainda em jogo, fora das regras de delay.',
      condicoes:
        'Inclui assistir à própria transmissão sem delay permitido e comunicar posições obtidas por stream.',
      provas_aceitas: 'Clips, horários de transmissão, denúncias e investigação.',
      competencia: 'Organização / comissão.',
      penalidade_inicial: 'Perda de pontos e/ou desclassificação da partida.',
      penalidade_reincidencia: 'Desclassificação da competição.',
      direito_defesa: true,
      direito_recurso: true,
      prazo: '24 horas.',
      observacoes: 'Quando houver delay obrigatório, o descumprimento agrava a conduta.',
    },
  },
]

export const INFRACAO_CAMPOS_OBRIGATORIOS: Array<keyof InfracaoConfig> = [
  'definicao',
  'condicoes',
  'provas_aceitas',
  'competencia',
  'penalidade_inicial',
  'penalidade_reincidencia',
  'prazo',
  'observacoes',
]

export function buildDefaultInfracoes(modules: RulebookModuleId[]): InfracaoConfig[] {
  return INFRACAO_TEMPLATES.filter((t) => {
    if (!t.requiresModules?.length) return true
    return t.requiresModules.some((m) => modules.includes(m))
  }).map((t) => ({
    codigo: t.codigo,
    enabled: true,
    titulo: t.titulo,
    gravidade: t.gravidade,
    ...t.defaults,
  }))
}

export function isInfracaoCompleta(inf: InfracaoConfig): boolean {
  if (!inf.enabled) return true
  for (const campo of INFRACAO_CAMPOS_OBRIGATORIOS) {
    const v = inf[campo]
    if (typeof v === 'string' && !v.trim()) return false
    if (v === null || v === undefined) return false
  }
  // boolean fields must be explicitly set
  if (typeof inf.direito_defesa !== 'boolean') return false
  if (typeof inf.direito_recurso !== 'boolean') return false
  return true
}
