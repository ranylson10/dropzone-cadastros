# Convites Manager × Campeonato (Correio)

Mesma pegada do convite equipe→manager: **pesquisa → permissões → correio → aceitar/recusar**.

## SQL (obrigatório uma vez)

Arquivo:

`C:\Users\Administrator\Downloads\dropzone_campeonato_manager_convites.sql`

Supabase → SQL Editor → colar → Run.

Cria apenas: `campeonato_manager_convites`  
(usa `notificacoes` já existente do correio)

## Fluxo A — Adm convida manager

1. Painel **Produtora** → campeonato → aba **Vendedores**
2. Buscar manager (@username ou ID)
3. Definir limite de vagas + permissões + validade
4. **Enviar convite no correio**
5. Manager no sininho → **Aceitar / Recusar**
6. Aceite grava `campeonato_vendedores` (status ativo) para **aquele campeonato**

## Fluxo B — Manager pede acesso

1. Painel **Manager** → **Campeonatos** → **Adicionar campeonato**
2. Buscar campeonato por nome
3. Enviar pedido
4. Adm no sininho → **Liberar / Recusar**
5. Liberar grava o mesmo vínculo em `campeonato_vendedores`

## Regras

- Convite é **por campeonato** (não libera a produtora inteira)
- Um pendente por (campeonato, manager, tipo)
- Token link legado continua existindo, mas o fluxo principal é o correio

## APIs

- `GET|POST|DELETE /api/campeonatos/[id]/managers/convites`
- `POST /api/managers/[managerId]/campeonatos/pedidos`
- `GET /api/campeonatos/busca?q=`
- `POST /api/notificacoes/[id]/aceitar|recusar`  
  tipos: `convite_manager_campeonato`, `pedido_manager_campeonato`
