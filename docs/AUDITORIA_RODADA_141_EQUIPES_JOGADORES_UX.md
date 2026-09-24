# Rodada 141 — Equipes e Jogadores: hierarquia e fluxo de uso

## Objetivo
Reduzir a complexidade percebida nos painéis de Equipe e Jogador sem remover funcionalidades, mantendo o DropZone Web focado em gestão competitiva.

## Ajustes
- Painel de Equipe: 8 abas de primeiro nível foram reorganizadas em 5 áreas: Início, Elenco, Competições, Desempenho e Mais.
- Jogadores, Lines e Convites agora são ferramentas internas de Elenco.
- Staff e Configurações ficam em Mais.
- Início da Equipe ganhou acessos rápidos para Agenda, Elenco e campeonatos com vagas.
- Painel de Jogador passa a ter Início, Equipe, Desempenho e Perfil.
- Busca/entrada em equipe, lines e token de escalação saem da página inicial e ficam dentro da área Equipe.
- Início do Jogador prioriza Agenda, Equipe e descoberta de campeonatos.
- Usuário sem equipe recebe próximo passo explícito.
- Busca de jogador/equipe passa a disparar automaticamente após 2 caracteres, com debounce de 420 ms.

## Supabase Pro / Realtime
Foi verificado o banco publicado antes de ativar qualquer assinatura. As tabelas de elenco consultadas possuem políticas SELECT para usuários autenticados, mas nenhuma delas está hoje na publicação `supabase_realtime`; `notificacoes` também não possui policy SELECT pública para o navegador. Não alteramos isso nesta rodada. A próxima implementação de atualização instantânea deve usar canais privados/Broadcast com autorização por usuário/equipe, em vez de abrir tabelas só para facilitar a UI.

## Sem dependência nova
Os componentes existentes de React/Next/Lucide atendem a reorganização; adicionar biblioteca seria peso sem benefício nesta rodada.
