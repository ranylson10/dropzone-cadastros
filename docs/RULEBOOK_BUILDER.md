# Rulebook Builder Inteligente

Sistema que gera regulamentos profissionais de Free Fire a partir de um fluxo de perguntas com dependências, perfis e templates de texto.

## Referências de estrutura (inspiração)

Análise de regulamentos reais de Free Fire / esports (estrutura e tipificações comuns, **sem copiar textos oficiais da Garena**):

| Fonte | Elementos aproveitados |
|-------|-------------------------|
| FFMC / rulebooks regionais Garena | Capítulos: general rules, integrity, equipment, network, punctuality, disciplinary action, team structure |
| Game Space / Campus Party FF | Conduta, hack, fire impostor, apostas, ghosting, direitos de imagem |
| eJIF Free Fire | Artigos numerados, elegibilidade, reservas, atraso/W.O., pontuação, desempate, casos omissos |
| Prática comunitária BR (LBFF-like) | Lobby, Discord, check-in, delay de transmissão, remake, premiação |

## Fluxo de criação (otimizado)

0. **Perfil** — comunitário | semiprofissional | profissional | personalizado  
1. **Configuração** (~25 perguntas) — define módulos ativos  
2. **Regras** — só módulos habilitados  
3. **Infrações** — campos obrigatórios por tipificação  
4. **Revisão** — alertas + publicação  

### Atalhos do fluxo

- **Seed do campeonato:** na 1ª criação, respostas vêm pré-preenchidas de `tem_live`, premiação, taxa, plataforma, formato, titulares/reservas e tipo do campeonato (`rulebook.seed.ts`).
- **Auto-save (~850ms):** ao responder, o backend regenera módulos + documento sem botão obrigatório.
- **Prévia no final:** o assistente foca só nas perguntas; a prévia completa aparece na etapa **Revisão** e no modo **Prévia do documento** (evita espremer formulário + regulamento).
- **Validação por etapa:** “Continuar” bloqueia se houver obrigatórias vazias e destaca os cards.
- **Barra de progresso:** obrigatórias respondidas / total + % da etapa atual.
- **Alertas com “Corrigir”:** volta à etapa da pergunta pendente.

## Outputs

- Documento web com capítulos, artigos numerados, sumário e busca  
- Impressão / salvar PDF via navegador  
- Página pública: `/campeonatos/[id]/regulamento` (apenas se `status = publicado`)  
- Espelho em `campeonatos.regras_url` ao publicar  

## Arquivos

| Camada | Caminho |
|--------|---------|
| Migration | `database/migrations/20260717_campeonato_rulebook.sql` |
| Backend | `backend/src/campeonatos/rulebook/` |
| API | `web/app/api/campeonatos/[id]/rulebook/` |
| UI admin | `web/features/campeonatos/rulebook/` + aba **Regulamento** no painel |
| Público | `web/app/campeonatos/[id]/regulamento/page.tsx` |

## Banco

Tabela `campeonato_rulebooks` (1 por campeonato):

- `perfil`, `etapa_atual`, `respostas` (jsonb)  
- `modules_ativos`, `infracoes`, `alertas`, `confirmacoes_alertas`  
- `documento` (jsonb estruturado), `status`, `versao`, `publicado_em`  

**Obrigatório:** rodar a migration no Supabase antes de usar.

## Alertas que bloqueiam publicação

- Pergunta obrigatória sem resposta  
- Infração habilitada incompleta / sem punição  
- Nenhuma infração habilitada  
- Sem competência de julgamento  
- Taxa sem política de reembolso  
- Recursos sem prazo  

Alertas de **warning** podem ser confirmados explicitamente pelo organizador.

## Capítulos fixos (ordem)

1 Disposições Gerais → 20 Disposições Finais (manager, coach, check-in, desconexões, remakes, recursos, premiação e imagem só entram se o módulo estiver ativo).

## Catálogo 1.1.0+

- **Etapa Regras agrupada por seção** (equipes, partidas, bugs/integridade, pontuação…).
- **Módulo de bugs (estilo LBFF/BR):** exemplos configuráveis, penalidade 1ª/2ª ocorrência, obrigação de reportar.
- **Pontuação com tabela explícita** (padrão BR 12/9/8… + kills e critérios de desempate).
- **Código de conduta** nas disposições gerais.
- **PDF / impressão:** janela isolada com **somente** logo + nome do campeonato e o texto do regulamento (não imprime painel da produtora). Capítulos em sequência (sem página em branco entre seções).
- `documento.logoUrl` vem de `campeonatos.logo_url` a cada regeneração.
- **Tipo/formato do cadastro** (`tipo`, `formato` — ex.: Liga / pontos corridos, Copa / eliminatória) entram no Art. de formato do evento.
