# Testes e validações

## Registro

| Data | Teste | Resultado | Observação |
|---|---|---|---|
| 10/07/2026 | `npm run typecheck` antes da reorganização | aprovado | TypeScript sem erros no projeto recebido |
| 10/07/2026 | `npm run build` antes da reorganização | não concluído | executável `next` do ZIP sem permissão no ambiente Linux; não foi classificado como erro de código |
| 10/07/2026 | `npm run typecheck` após reorganização | aprovado | imports entre `web` e `backend` validados |
| 10/07/2026 | `npm run build` após reorganização | aprovado | Next.js compilou e gerou todas as rotas |

## Checklist mínimo por rodada

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] confirmar que rotas principais abrem
- [ ] confirmar login e recuperação
- [ ] confirmar upload
- [ ] confirmar criação alterada na rodada
- [ ] revisar permissões
- [ ] atualizar `PROJECT_CONTEXT.md`
- [ ] atualizar `docs/CHANGELOG.md`

## 2026-07-10 — Header e hero dos painéis

- TypeScript: aprovado com `npm run typecheck`.
- Build Next.js: aprovado com `npm run build`.
- Rotas existentes preservadas durante o build.

## 2026-07-10 — Campeonatos e configurações

- Migração do banco validada com dois campeonatos existentes.
- Dados de premiação copiados para `campeonato_configuracoes`.
- `npm run typecheck`: aprovado após formulário, filtros, edição e exclusão.

## Modal global e resumo do campeonato

Validar após copiar os arquivos para o projeto completo:

- abrir cadastro de campeonato;
- fechar clicando fora do modal;
- fechar pressionando `Esc`;
- confirmar que clicar dentro do formulário não fecha;
- abrir edição e salvar normalmente;
- verificar os cinco indicadores em uma linha abaixo do cabeçalho;
- executar `npm run typecheck` e `npm run build`.

## Subaba Equipes por vagas — 2026-07-10

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- Rotas novas reconhecidas pelo Next.js:
  - `/api/campeonatos/[id]/equipes`
  - `/api/campeonatos/[id]/equipes/busca`
  - `/api/campeonatos/[id]/convites-equipe`
  - `/api/campeonatos/[id]/convites-equipe/[tokenId]`
  - `/api/campeonatos/[id]/convites-equipe/[tokenId]/renovar`
  - `/api/convites/equipe/[token]`
  - `/convite/equipe/[token]`

## Lista compacta da subaba Equipes

Alteração preparada para validação local com:

```cmd
npm run typecheck
npm run build
```

Validar visualmente filtros, expansão das linhas e abertura dos modais de adicionar/convidar.

## Fluxo de convites de equipes (2026-07-16)

Doc: `docs/FLUXO_CONVITES_EQUIPES.md`.

### Pré-requisito
- [ ] Rodar `database/migrations/20260716_links_soft_delete_e_consumo_atomico.sql` no Supabase.

### Admin (aba Links)
- [ ] Criar link com nome interno, limite ≤ vagas livres e **sem** equipes esperadas.
- [ ] Criar link colando lista no textarea (linhas / vírgulas); não exigir N nomes = limite.
- [ ] Filtros por status (Ativos, Pausados, Esgotados…) e contadores.
- [ ] Pausar / reativar; reabrir esgotado sem zerar histórico.
- [ ] Excluir: some da lista; URL ainda abre acompanhamento.

### Público — link de grupo `/convite/grupo/[token]`
- [ ] Token ativo + deslogado: login **ou** só acompanhar.
- [ ] Login no fluxo: **não** pede confirmar equipe de novo.
- [ ] Já logado ao abrir: pede confirmar / trocar equipe.
- [ ] Só lines livres + criar nova (usa na hora).
- [ ] Confirmar sem escolher slot (auto-slot).
- [ ] Token esgotado/pausado: acompanhamento; clique em equipe mostra jogadores.
- [ ] CTA “Escalar minha equipe” só quando o link ainda aceita inscrição.

### Público — link único `/convite/equipe/[token]`
- [ ] Mesmo padrão de acompanhamento quando usado/expirado.
- [ ] Aceite com line + auto-slot se for modo grupo.

### Concorrência
- [ ] Dois POSTs quase simultâneos no mesmo link com limite 1: só um entra.

## Lines e aba Jogadores
- [ ] Executar `database/migrations/20260710_lines_principais_automaticas.sql`.
- [ ] Confirmar que toda equipe possui ao menos uma line.
- [ ] Pesquisar equipe no modal e confirmar que line já inscrita aparece bloqueada.
- [ ] Adicionar outra line da mesma equipe em vaga diferente.
- [ ] Confirmar que a aba Jogadores lista a line, e não a equipe bruta.
- [ ] Confirmar que line com zero jogadores aparece como `Pendente`.
- [ ] Confirmar que jogadores são agrupados por `campeonato_equipe_id`.
