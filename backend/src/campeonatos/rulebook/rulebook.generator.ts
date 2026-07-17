import { RULEBOOK_CHAPTERS, PERFIL_LABELS } from './rulebook.chapters'
import type {
  AnswersMap,
  GeneratedArticle,
  GeneratedChapter,
  GeneratedDocument,
  InfracaoConfig,
  RulebookChapterId,
  RulebookModuleId,
  RulebookPerfil,
} from './rulebook.types'

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (value == null || value === '') return []
  return [String(value)]
}

function labelMapas(codes: string[]): string {
  const map: Record<string, string> = {
    bermuda: 'Bermuda',
    purgatorio: 'Purgatório',
    kalahari: 'Kalahari',
    alpine: 'Alpine',
    nexterra: 'Nexterra',
  }
  return codes.map((c) => map[c] || c).join(', ')
}

function labelFerramentas(codes: string[]): string {
  const map: Record<string, string> = {
    scripts: 'scripts',
    apk_mod: 'APKs modificados',
    macro: 'macros',
    softwares: 'softwares externos',
    memoria: 'alteração de memória',
    perifericos: 'periféricos que alterem os controles do jogo',
  }
  return codes.map((c) => map[c] || c).join(', ')
}

function article(
  chapterId: RulebookChapterId,
  id: string,
  title: string,
  body: string,
  extra?: Partial<GeneratedArticle>,
): GeneratedArticle {
  return {
    id,
    number: '', // preenchido depois
    title,
    body,
    chapterId,
    ...extra,
  }
}

export function generateDocument(input: {
  answers: AnswersMap
  modules: RulebookModuleId[]
  infracoes: InfracaoConfig[]
  perfil: RulebookPerfil
  campeonatoNome: string
  catalogVersion: string
}): GeneratedDocument {
  const { answers: a, modules, infracoes, perfil, campeonatoNome, catalogVersion } = input
  const byChapter = new Map<RulebookChapterId, GeneratedArticle[]>()

  const push = (art: GeneratedArticle) => {
    const list = byChapter.get(art.chapterId) || []
    list.push(art)
    byChapter.set(art.chapterId, list)
  }

  const formato =
    a.formato_evento === 'presencial'
      ? 'presencial'
      : a.formato_evento === 'hibrido'
        ? 'híbrido (etapas online e, quando aplicável, presenciais)'
        : 'online (remoto)'

  const modalidade =
    a.modalidade === 'duo' ? 'Duo' : a.modalidade === 'solo' ? 'Solo' : 'Squad'

  // 1. Disposições Gerais
  push(
    article(
      'disposicoes_gerais',
      'dg_objeto',
      'Objeto e abrangência',
      `Este regulamento estabelece as regras oficiais do campeonato de Free Fire intitulado ${campeonatoNome}, organizado por meio da plataforma DropZone. Ao se inscrever e participar, equipes, jogadores, managers e demais envolvidos declaram ciência e integral aceitação das normas aqui previstas.`,
    ),
  )
  push(
    article(
      'disposicoes_gerais',
      'dg_formato',
      'Formato do evento',
      `O campeonato será realizado de forma ${formato}, na modalidade ${modalidade}, conforme configuração definida pela organização. O perfil de regras adotado para este regulamento é o ${PERFIL_LABELS[perfil] || perfil}.`,
    ),
  )
  push(
    article(
      'disposicoes_gerais',
      'dg_fair_play',
      'Integridade competitiva',
      'É esperado que todos os participantes disputem com empenho, honestidade e respeito. Qualquer conduta que comprometa a integridade da competição poderá ser investigada e sancionada pela organização, inclusive nos casos não tipificados de forma exaustiva neste documento, sempre com base nos princípios de fair play e razoabilidade.',
    ),
  )

  // 2. Organização
  push(
    article(
      'organizacao',
      'org_poderes',
      'Competência da organização',
      'A organização é responsável pela condução do campeonato, pela aplicação deste regulamento, pela arbitragem das partidas e pela decisão de casos omissos. Decisões técnicas e disciplinares visam preservar a justiça da competição e o bom andamento do evento.',
    ),
  )
  if (modules.includes('discord') && a.usa_discord === true) {
    push(
      article(
        'organizacao',
        'org_discord',
        'Canais oficiais de comunicação',
        'O Discord oficial indicado pela organização será o principal meio de comunicação operacional durante o campeonato. Managers e capitães são responsáveis por acompanhar os avisos e repassar as orientações aos demais membros da equipe. Comunicações também poderão ser feitas por outros canais oficiais da plataforma, quando informados.',
      ),
    )
  }
  if (modules.includes('transmissao') && a.possui_transmissao === true) {
    const delayOn = a.delay_obrigatorio === true
    const delaySec = Number(a.delay_segundos || 0)
    const assistir = a.assistir_propria_transmissao === true
    push(
      article(
        'organizacao',
        'org_transmissao',
        'Transmissão oficial',
        `Haverá transmissão oficial das partidas ou de parte delas. ${
          delayOn
            ? `É obrigatório o respeito ao delay mínimo de ${delaySec || '—'} segundos na transmissão, a fim de preservar a integridade competitiva.`
            : 'A organização poderá definir regras adicionais de delay e cobertura conforme a fase do evento.'
        } ${
          assistir
            ? 'É permitido assistir à transmissão oficial durante a partida, desde que não configure ghosting ou stream sniping.'
            : 'É proibido assistir à própria transmissão oficial (ou de adversários) durante a partida enquanto o participante ou sua equipe ainda estiver em jogo, sob pena das sanções previstas neste regulamento.'
        }`,
        {
          penalty:
            'O descumprimento poderá resultar em perda de pontos, desclassificação da partida ou medidas mais graves, conforme a infração de stream sniping/ghosting.',
        },
      ),
    )
  }

  // 3. Participação
  push(
    article(
      'participacao',
      'part_compromisso',
      'Compromisso de participação',
      'Ao ser confirmada a inscrição, a equipe compromete-se a comparecer às etapas e partidas para as quais estiver classificada ou convocada, sujeitando-se às penalidades previstas em caso de ausência injustificada, inclusive W.O. e desclassificação.',
    ),
  )
  push(
    article(
      'participacao',
      'part_unica_equipe',
      'Vínculo a uma única equipe',
      'Salvo regra expressa em contrário da organização, cada jogador poderá integrar o elenco de apenas uma equipe neste campeonato. A participação simultânea em múltiplos elencos poderá resultar em desclassificação.',
    ),
  )

  // 4. Elegibilidade
  if (modules.includes('idade') && a.limite_idade === true) {
    const idade = Number(a.idade_minima || 0)
    const auth = a.autorizacao_responsavel === true
    const docs = asList(a.documentos_idade).join(', ')
    push(
      article(
        'elegibilidade',
        'el_idade',
        'Idade mínima',
        `Somente poderão participar atletas com idade mínima de ${idade || '—'} anos na data de início do campeonato. ${
          auth
            ? 'Participantes menores de idade deverão apresentar autorização do responsável legal quando solicitado pela organização.'
            : 'A organização poderá solicitar comprovação de idade a qualquer momento.'
        } Documentos aceitos para comprovação: ${docs || 'conforme indicação da organização'}.`,
      ),
    )
  } else {
    push(
      article(
        'elegibilidade',
        'el_geral',
        'Condições gerais de elegibilidade',
        'Poderão participar jogadores e equipes que cumpram os requisitos de inscrição definidos pela organização, que aceitem este regulamento e que estejam em situação regular na plataforma. A organização poderá solicitar documentos ou comprovações adicionais para validar a elegibilidade.',
      ),
    )
  }
  push(
    article(
      'elegibilidade',
      'el_conta',
      'Contas de jogo',
      'Cada atleta deverá utilizar exclusivamente a conta de Free Fire informada no cadastro. É proibido o uso de conta de terceiros, multi-contas para fraudar o evento ou qualquer forma de smurfing. A conta poderá ser vinculada ao campeonato pelo ID de jogo cadastrado.',
      {
        penalty: 'Desclassificação do jogador e da equipe, conforme tipificação de smurfing.',
      },
    ),
  )

  // 5. Equipes
  const titulares = Number(a.qtd_titulares || 4)
  push(
    article(
      'equipes',
      'eq_composicao',
      'Composição do elenco',
      `Cada equipe deverá ter ${titulares} jogador(es) titular(es) em partida, conforme a modalidade. A organização poderá recusar nomes de equipe ou nicks ofensivos, discriminatórios ou que violem direitos de terceiros.`,
    ),
  )
  if (modules.includes('reservas') && a.permite_reservas === true) {
    const reservas = Number(a.qtd_reservas || 1)
    const sub = a.substituicao_entre_quedas === true
    push(
      article(
        'equipes',
        'eq_reservas',
        'Reservas e substituições',
        `É permitido o cadastro de até ${reservas} jogador(es) reserva(s). ${
          sub
            ? 'A substituição entre titular e reserva poderá ocorrer entre quedas da mesma rodada, desde que comunicada à organização no prazo e forma definidos.'
            : 'Substituições só poderão ocorrer entre rodadas, salvo autorização expressa da organização.'
        } Não é permitida substituição durante uma queda em andamento.`,
      ),
    )
  }

  // 6. Jogadores
  push(
    article(
      'jogadores',
      'jog_conduta',
      'Deveres dos jogadores',
      'Os jogadores devem manter conduta respeitosa, cumprir horários, utilizar a conta cadastrada, seguir orientações dos admins e reportar incidentes relevantes. São responsáveis por seus dispositivos, atualização do jogo, bateria e conexão à internet, salvo quando a organização fornecer infraestrutura específica e assumir responsabilidade expressa.',
    ),
  )

  // 7. Manager
  if (modules.includes('manager') && a.permite_manager === true) {
    push(
      article(
        'manager',
        'mgr_papel',
        'Manager da equipe',
        'É permitido o cadastro de manager responsável pela comunicação oficial com a organização, gestão de elenco e cumprimento de prazos. O manager não substitui o atleta em partida, salvo se também estiver cadastrado como jogador elegível. Informações oficiais enviadas ao manager consideram-se comunicadas à equipe.',
      ),
    )
  }

  // 8. Coach
  if (modules.includes('coach') && a.permite_coach === true) {
    push(
      article(
        'coach',
        'coach_papel',
        'Coach',
        'É permitido o cadastro de coach vinculado à equipe. O coach deve observar as regras de comunicação e anti-ghosting. Em etapas presenciais, a presença em área técnica observará as orientações da organização. Em etapas online, o coach não poderá fornecer informações de vantagem ilícita a jogadores ainda em partida.',
      ),
    )
  }

  // 9. Cadastro
  push(
    article(
      'cadastro',
      'cad_inscricao',
      'Inscrição',
      'A inscrição será realizada pelos meios oficiais definidos pela organização (links, convites ou painel da plataforma). Dados cadastrais devem ser verdadeiros e atualizados. Informações falsas podem gerar desclassificação.',
    ),
  )
  if (modules.includes('taxa_inscricao') && a.possui_taxa === true) {
    push(
      article(
        'cadastro',
        'cad_taxa',
        'Taxa de inscrição',
        `Este campeonato possui taxa de inscrição: ${String(a.valor_taxa || 'conforme informado pela organização')}. A confirmação da vaga poderá depender da comprovação do pagamento nos prazos estabelecidos.`,
      ),
    )
    push(
      article(
        'cadastro',
        'cad_reembolso',
        'Política de reembolso',
        String(a.politica_reembolso || 'A política de reembolso será informada pela organização.'),
      ),
    )
  }

  // 10. Check-in
  if (modules.includes('check_in') && a.exige_check_in === true) {
    const mins = Number(a.check_in_minutos || 10)
    push(
      article(
        'check_in',
        'ci_regra',
        'Check-in',
        `As equipes deverão realizar o check-in com antecedência mínima de ${mins} minutos em relação ao horário oficial da rodada, no canal ou ferramenta indicada pela organização. O não cumprimento poderá ser tratado como atraso ou ausência, com as consequências previstas neste regulamento.`,
      ),
    )
  }

  // 11. Partidas
  const mapas = asList(a.mapas_permitidos)
  push(
    article(
      'partidas',
      'prt_geral',
      'Condução das partidas',
      `As partidas serão disputadas em salas personalizadas ou formato definido pela organização, nos mapas ${
        mapas.length ? labelMapas(mapas) : 'definidos pela organização'
      }. Os horários oficiais serão divulgados com antecedência razoável. A organização poderá alterar ordem de mapas ou horários por motivo de força maior ou integridade do evento, comunicando as equipes.`,
    ),
  )
  if (modules.includes('online') || modules.includes('lobby')) {
    const canais = asList(a.canal_convite_sala)
    push(
      article(
        'partidas',
        'prt_lobby',
        'Lobby e convites',
        `Nas etapas online, as equipes deverão ingressar no lobby no horário estabelecido. Os convites da sala personalizada poderão ser enviados por: ${
          canais.length ? canais.join(', ') : 'canais oficiais da organização'
        }. É dever da equipe manter-se disponível nos canais oficiais para recebimento do convite.`,
      ),
    )
  }
  if (modules.includes('atrasos') && a.permite_atraso === true) {
    const tol = Number(a.atraso_maximo_minutos || 10)
    push(
      article(
        'partidas',
        'prt_atraso',
        'Atrasos',
        `As equipes deverão comparecer ao lobby dentro do horário estabelecido pela organização. Será tolerado atraso máximo de ${tol} minutos, contado a partir do horário oficial informado para início da rodada. Após esse período, poderão ser aplicadas as penalidades previstas neste regulamento, incluindo início incompleto, perda de pontos ou W.O.`,
        {
          penalty: 'Conforme tipificação de atraso injustificado e decisão da arbitragem.',
        },
      ),
    )
  }
  if (modules.includes('emulador_proibido') && a.emulador_proibido === true) {
    push(
      article(
        'partidas',
        'prt_emulador',
        'Restrição de plataforma',
        'Não é permitido jogar em emuladores de PC ou dispositivos expressamente proibidos pela organização. A detecção poderá resultar em desclassificação da equipe.',
        { penalty: 'Desclassificação, conforme tipificação correspondente.' },
      ),
    )
  }

  // 12. Pontuação
  const killPts = Number(a.pontos_kill ?? 1)
  const tabela = String(a.tabela_colocacao || 'simples')
  push(
    article(
      'pontuacao',
      'pts_modelo',
      'Sistema de pontuação',
      `A pontuação das partidas considerará colocação e abates (kills). Cada abate vale ${killPts} ponto(s), salvo disposição específica de fase. Modelo de colocação adotado: ${
        tabela === 'padrao_br'
          ? 'tabela padrão BR definida/publicada pela organização para o evento'
          : tabela === 'custom'
            ? 'modelo personalizado informado pela organização'
            : 'modelo simples (ex.: 1º=10, 2º=8, 3º=7… + pontos por kill)'
      }. Critérios de desempate padrão: maior número de Booyahs (vitórias), maior número de abates, melhor colocação no confronto direto mais recente e, se necessário, partida extra a critério da organização.`,
    ),
  )

  // 13. Desconexões
  if (modules.includes('desconexoes') && a.politica_desconexao === true) {
    const resp =
      a.ping_responsabilidade === 'organizacao_se_fornecida'
        ? 'O participante é responsável pela própria conexão, exceto quando a organização fornecer a rede do evento e houver falha generalizada comprovada nessa infraestrutura.'
        : a.ping_responsabilidade === 'compartilhada'
          ? 'A responsabilidade pela conexão será analisada caso a caso, considerando se a falha é individual ou generalizada.'
          : 'O participante e sua equipe são exclusivamente responsáveis pela qualidade da conexão, dispositivo e estabilidade da internet.'
    push(
      article(
        'desconexoes',
        'dc_geral',
        'Política de desconexões',
        `${resp} Em caso de desconexão involuntária, o jogador deve tentar reconectar enquanto a partida estiver em andamento. Em regra, não há direito automático a pause ou remake por desconexão individual ou ping alto.`,
      ),
    )
    if (a.desconexao_intencional === true) {
      push(
        article(
          'desconexoes',
          'dc_intencional',
          'Desconexão intencional',
          'É proibido causar desconexão intencional durante a partida. A conduta será tratada como infração disciplinar.',
          { penalty: 'Conforme tipificação de desconexão intencional.' },
        ),
      )
    }
  }

  // 14. Remakes
  if (modules.includes('remakes') && a.permite_remake === true) {
    const cond = asList(a.remake_condicoes)
    const labels: Record<string, string> = {
      servidor: 'falha no servidor do jogo',
      massiva: 'desconexão massiva de vários jogadores',
      bug_grave: 'bug que impede o jogo de forma normal',
      erro_org: 'erro operacional da organização',
      criterio_org: 'demais hipóteses a critério exclusivo da organização',
    }
    push(
      article(
        'remakes',
        'rm_condicoes',
        'Remake de partidas',
        `A organização poderá autorizar remake apenas em hipóteses excepcionais, tais como: ${
          cond.length
            ? cond.map((c) => labels[c] || c).join('; ')
            : 'falhas graves de servidor ou erro operacional'
        }. O pedido deve ser feito de imediato aos admins. A decisão final é da organização e não gera direito automático à nova partida.`,
      ),
    )
  }

  // 15–16. Infrações e Penalidades
  push(
    article(
      'infracoes',
      'inf_procedimento',
      'Denúncias e apuração',
      `As denúncias de infração deverão ser apresentadas no prazo de ${
        String(a.prazo_denuncia || '24 horas')
      } após a partida, pelos canais oficiais, acompanhadas das provas disponíveis. Denúncias fora do prazo poderão ser arquivadas, salvo determinação contrária da organização em casos graves que afetem a integridade do campeonato.`,
    ),
  )

  for (const inf of infracoes.filter((i) => i.enabled)) {
    push(
      article(
        'infracoes',
        `inf_${inf.codigo}`,
        inf.titulo,
        `${inf.definicao}\n\nCondições: ${inf.condicoes}\n\nProvas aceitas: ${inf.provas_aceitas}\n\nCompetência: ${inf.competencia}`,
        {
          penalty: `Penalidade inicial: ${inf.penalidade_inicial}\nReincidência: ${inf.penalidade_reincidencia}`,
          observations: inf.observacoes,
          notes: `Direito de defesa: ${inf.direito_defesa ? 'sim' : 'não'}. Direito de recurso: ${
            inf.direito_recurso ? 'sim' : 'não'
          }. Prazo: ${inf.prazo}. Gravidade: ${inf.gravidade}.`,
        },
      ),
    )
  }

  // Templates específicos de hack/ghosting já vêm das infrações; reforço textual se módulo ativo
  if (modules.includes('hack') && a.proibe_hack === true) {
    const ferramentas = asList(a.hack_ferramentas)
    push(
      article(
        'infracoes',
        'inf_hack_texto',
        'Uso de aplicativos de terceiros',
        `É proibida a utilização de aplicativos, softwares, ${
          ferramentas.length ? labelFerramentas(ferramentas) : 'scripts, macros, APKs modificados e ferramentas externas'
        } ou qualquer outro recurso destinado a conceder vantagem competitiva indevida durante as partidas. Essa prática compromete a integridade da competição e será tratada como infração gravíssima.\n\nA identificação da infração poderá ocorrer por meio de investigação da organização, análise de evidências ou outras formas de comprovação previstas neste regulamento.`,
        {
          penalty:
            'O participante poderá ser banido permanentemente da competição, sem prejuízo de outras medidas administrativas cabíveis.',
        },
      ),
    )
  }

  if (modules.includes('ghosting') && a.proibe_ghosting === true) {
    const quem = asList(a.ghosting_quem)
    push(
      article(
        'infracoes',
        'inf_ghosting_texto',
        'Ghosting',
        `É proibido transmitir ou compartilhar informações privilegiadas sobre o andamento da partida com participantes que ainda estejam em jogo, independentemente do meio utilizado para essa comunicação.\n\nSão consideradas formas de ghosting, entre outras: comunicação por voz; mensagens; plataformas de comunicação; transmissões ao vivo; qualquer outro meio destinado a fornecer vantagem competitiva.\n\nPodem ser responsabilizados: ${
          quem.length ? quem.join(', ') : 'jogadores e membros da comissão técnica'
        }.`,
        {
          penalty: 'Conforme tipificação de ghosting definida neste regulamento.',
        },
      ),
    )
  }

  const competencia =
    a.competencia_julgamento === 'comissao'
      ? 'a comissão disciplinar designada'
      : a.competencia_julgamento === 'arbitro'
        ? 'o árbitro/admin de partida'
        : a.competencia_julgamento === 'misto'
          ? 'o admin de partida, com revisão da organização'
          : 'a organização do campeonato'

  push(
    article(
      'penalidades',
      'pen_escala',
      'Escalas de penalidades',
      `As penalidades poderão incluir, isolada ou cumulativamente: advertência; perda de pontos; W.O.; desclassificação de partida, fase ou campeonato; perda de premiação; e banimento de eventos futuros da organização. A gradação observará a gravidade, a reincidência e as circunstâncias do caso. Compete a ${competencia} aplicar as sanções previstas.`,
    ),
  )
  if (a.direito_defesa_geral === true) {
    push(
      article(
        'penalidades',
        'pen_defesa',
        'Direito de defesa',
        'Antes da aplicação de punições graves (como desclassificação do campeonato ou banimento), será assegurado ao envolvido o direito de apresentar defesa escrita no prazo indicado na notificação, salvo urgência justificada para preservação da integridade da rodada em andamento, hipótese em que a defesa poderá ser posterior com revisão da decisão.',
      ),
    )
  }

  // 17. Recursos
  if (modules.includes('recursos_disciplinares') && a.permite_recursos === true) {
    push(
      article(
        'recursos',
        'rec_prazo',
        'Recurso',
        `Das decisões disciplinares caberá recurso no prazo de ${
          String(a.prazo_recurso || '24 horas')
        } contado da ciência da decisão, dirigido ao canal oficial indicado pela organização. O recurso deverá ser fundamentado e acompanhado das provas pertinentes. A interposição de recurso não suspende automaticamente os efeitos da decisão, salvo determinação expressa da organização.`,
      ),
    )
  }

  // 18. Premiação
  if (modules.includes('premiacao') && a.possui_premiacao === true) {
    let premiacaoBody = String(a.descricao_premiacao || '')
    if (!premiacaoBody || a.divisao_premiacao_json) {
      const parts: string[] = []
      if (a.premiacao_total) {
        parts.push(`A premiação total deste campeonato é de R$ ${String(a.premiacao_total)}.`)
      }
      try {
        const items = JSON.parse(String(a.divisao_premiacao_json || '[]'))
        if (Array.isArray(items) && items.length) {
          parts.push('A distribuição por colocação será:')
          for (const it of items) {
            const nome = String(it?.nome || 'Colocação')
            const valor = Number(it?.valor || 0)
            parts.push(
              `• ${nome}: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            )
          }
        }
      } catch {
        // ignore
      }
      if (a.descricao_premiacao) parts.push(String(a.descricao_premiacao))
      if (parts.length) premiacaoBody = parts.join('\n')
    }
    push(
      article(
        'premiacao',
        'prm_valores',
        'Premiação',
        premiacaoBody || 'A premiação será divulgada pela organização.',
      ),
    )
    push(
      article(
        'premiacao',
        'prm_pagamento',
        'Pagamento',
        `O pagamento ou entrega da premiação ocorrerá ${
          String(a.prazo_pagamento_premio || 'nos prazos informados pela organização')
        }, mediante envio da documentação solicitada. Premiações poderão ser retidas em caso de investigação disciplinar pendente ou descumprimento deste regulamento.`,
      ),
    )
  }

  // 19. Direitos de imagem
  if (modules.includes('direitos_imagem') && a.direitos_imagem === true) {
    push(
      article(
        'direitos_imagem',
        'img_cessao',
        'Cessão de imagem',
        'Ao participar do campeonato, os envolvidos autorizam a organização a utilizar nome, nick, imagem, voz, marca da equipe e demais elementos de participação em transmissões, materiais promocionais, redes sociais e registros do evento, sem remuneração adicional, pelo prazo necessário à divulgação do campeonato e de suas edições correlatas, respeitada a legislação aplicável.',
      ),
    )
  }

  // 20. Disposições Finais
  push(
    article(
      'disposicoes_finais',
      'df_omissos',
      'Casos omissos',
      'Os casos omissos e as interpretações deste regulamento serão resolvidos pela organização, com base nos princípios de fair play, boa-fé e isonomia. A organização poderá atualizar este documento, comunicando alterações materiais aos participantes pelos canais oficiais.',
    ),
  )
  push(
    article(
      'disposicoes_finais',
      'df_aceitacao',
      'Aceitação',
      'A inscrição, o check-in ou a participação em qualquer partida implica aceitação integral deste regulamento e das decisões legítimas da organização tomadas com base nele.',
    ),
  )

  // Monta capítulos e numera artigos
  let articleCounter = 0
  const chapters: GeneratedChapter[] = RULEBOOK_CHAPTERS.map((ch) => {
    const requireOk =
      !ch.requireAnyModule?.length
      || ch.requireAnyModule.some((m) => modules.includes(m as RulebookModuleId))
    const arts = byChapter.get(ch.id) || []
    const included = requireOk && arts.length > 0
    const numbered = included
      ? arts.map((art) => {
          articleCounter += 1
          return { ...art, number: `Art. ${articleCounter}º` }
        })
      : []
    return {
      id: ch.id,
      order: ch.order,
      title: ch.title,
      articles: numbered,
      included,
    }
  })

  const includedChapters = chapters.filter((c) => c.included)

  return {
    title: `Regulamento — ${campeonatoNome}`,
    subtitle: `Rulebook gerado automaticamente · Perfil ${PERFIL_LABELS[perfil] || perfil}`,
    campeonatoNome,
    perfil,
    generatedAt: new Date().toISOString(),
    catalogVersion,
    chapters: includedChapters,
    summary: includedChapters.map((c) => ({
      chapterId: c.id,
      title: `${c.order}. ${c.title}`,
      order: c.order,
    })),
    articleCount: articleCounter,
  }
}
