# Rodada 150 — auditoria final da fase privada/marketplace

## Escopo

A R150 não cria um novo módulo. Ela fecha inconsistências encontradas após as rodadas R145–R149 e reforça navegação, segurança, acessibilidade e auditoria.

## Correções funcionais

- O perfil ativo passa a ser persistido por `profile_type` **e** `profile_id` em todos os shells relevantes. Isso evita abrir a produtora errada quando uma mesma conta participa de mais de um workspace de produtora.
- Lili e Login respeitam `perfil_id` e o workspace salvo.
- Logout também remove `dropzone_active_profile_id`.
- Ações rápidas de Produtora, Equipe e Jogador levam diretamente para as áreas privadas corretas.
- O workspace da Produtora aceita deep links para `visao`, `campeonatos`, `financeiro`, `equipe` e `configuracoes`, preservando subabas do campeonato quando `campeonato=<id>` estiver presente.
- Lili não oferece mais criação pública de Produtora. O texto deixa explícito que workspaces são liberados somente por convite administrativo.
- Mensagem comum de campeonato pendente deixa de expor "chave Stream"; integrações de transmissão continuam existindo apenas como ponte técnica/legada.

## Segurança e acessibilidade

- Cabeçalhos globais: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` e `Permissions-Policy` sem câmera/microfone/geolocalização no Web.
- Não foi introduzida CSP rígida nesta rodada para não quebrar Supabase, autenticação, pagamentos, mídia e integrações existentes sem uma matriz completa de origens.
- Foi incluído link "Pular para o conteúdo" com foco de teclado.

## Auditoria interna

- `api/account/username` foi classificada explicitamente como consulta pública de disponibilidade: retorna apenas `username` e `available`.
- `api/me/account` foi classificada como escrita autoescopada: bearer obrigatório e `updateUserById(user.id)`.
- O scanner CRUD agora entende `api/produtora/convites/[token]` como fluxo por token, não como recurso CRUD incompleto.

## Banco

Nenhuma migration e nenhuma alteração de schema foram necessárias na R150. O modelo privado de Produtora e o Financeiro Gerencial permanecem como definidos nas R146/R148.
