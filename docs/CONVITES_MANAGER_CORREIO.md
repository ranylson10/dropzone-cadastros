# Convites Manager + Correio

Feature **aditiva**: equipe convida manager pelo app; manager recebe no correio (sininho).

## SQL (obrigatório uma vez)

Arquivo:

`C:\Users\Administrator\Downloads\dropzone_convites_manager_correio.sql`

Supabase → SQL Editor → colar → Run.

Cria apenas:
- `equipe_manager_convites`
- `notificacoes`

Não altera login, tokens de campeonato nem `manager_equipe` (só grava vínculos no aceite).

## Fluxo

1. Painel **Equipe** → aba **Staff**
2. Buscar manager (@username ou ID)
3. Definir permissões e validade → **Enviar convite no correio**
4. Manager vê **sininho** no header → Aceitar / Recusar
5. Aceite grava linha em `manager_equipe`

## Limites

- 5 managers ativos / equipe  
- 10 convites pendentes / equipe  
- Validade 1–30 dias (default 7)  
- Só dono da equipe convida  

## APIs

- `GET /api/managers/busca?q=`
- `GET|DELETE /api/equipes/[id]/staff`
- `POST|DELETE /api/equipes/[id]/staff/convites`
- `GET|PATCH /api/notificacoes`
- `POST /api/notificacoes/[id]/aceitar`
- `POST /api/notificacoes/[id]/recusar`

## Rollback

Remover a aba Staff e o `NotificationBell`; tabelas novas podem ficar vazias.
