# Rodada 81 — Hotfix da Central do Campeonato

## Falha observada

A rota `GET /api/central-campeonato` respondia com erro para usuários autorizados.

## Causa

A consulta selecionava `numero_vagas` na tabela `campeonatos`. No contrato atual, o limite comercial pertence a `campeonato_configuracoes` e é exposto pelo serviço `getCampeonatoCapacidade`.

## Correção

- removida a seleção inválida de `campeonatos.numero_vagas`;
- mantido `getCampeonatoCapacidade` como fonte única para `limite_vagas`, `slots_criados` e `slots_ocupados`;
- nenhuma migration ou alteração de banco;
- nenhuma permissão foi ampliada.

## Validação esperada

Executar `npm run testar:tudo`. A rota deve responder `200` para produtora e manager autorizados, `401` para visitante e `403` para usuário autenticado sem vínculo.
