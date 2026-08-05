# Rodada 87L1 — Calls por mapa no Xtreino

## Objetivo

Permitir que o administrador do Xtreino cadastre calls em cada mapa e escolha manualmente em qual call cada equipe ou line poderá cair.

## Entrega

- nova aba **Calls**, exibida apenas em campeonatos do tipo Xtreino;
- catálogo de mapas ativos já existente no sistema;
- cadastro, edição e exclusão de calls por mapa;
- vínculo e remoção manual de equipe/line;
- nenhuma distribuição automática;
- uma call principal por equipe em cada mapa;
- exclusão em cascata quando o campeonato, call ou participação for removido;
- autorização pelo mesmo contrato usado para organizar a estrutura do campeonato;
- imagem do mapa exibida como referência quando cadastrada no catálogo.

## Banco

Migration:

```text
database/migrations/20260805_xtreino_calls_mapas.sql
```

Tabelas:

- `xtreino_mapa_calls`
- `xtreino_mapa_call_equipes`

A migration precisa ser executada no Supabase antes da validação visual.

## Limite desta subrodada

A Rodada 87L1 entrega o CRUD e o vínculo manual. O desenho de polígonos clicáveis sobre o mapa será implementado em uma subrodada própria, preservando os dados cadastrados aqui.

## Validação rápida

```bat
npm run typecheck
npm run build
```

## Contrato CRUD

1. criar uma call;
2. visualizar a call;
3. renomear a call;
4. vincular uma equipe;
5. trocar a equipe;
6. remover o vínculo;
7. excluir a call.
