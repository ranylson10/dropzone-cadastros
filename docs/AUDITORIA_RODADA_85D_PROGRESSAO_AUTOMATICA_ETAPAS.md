# Rodada 85D — Progressão automática entre etapas

## Escopo

- Prévia da classificação antes de qualquer escrita.
- Leitura da fase vinculada à etapa de origem.
- Seleção por faixa de posições ou quantidade configurada na regra.
- Validação da capacidade livre na etapa de destino.
- Aplicação manual e idempotente pela produtora.
- Registro da etapa e posição de origem em `campeonato_etapa_equipes`.
- Atualização do estado da participação na origem e no destino.
- Identificação de equipes já promovidas para impedir duplicidade.

## Segurança

As ações reutilizam a autorização do campeonato e exigem `canManage`. A regra, a etapa de origem e a etapa de destino precisam pertencer ao mesmo campeonato.

## Banco

Nenhuma migration nova foi necessária. A rodada reutiliza a tabela operacional criada na 85C e sua chave única `(etapa_id, campeonato_equipe_id)`.

## Testes

Foram adicionados contratos E2E para a prévia, capacidade, idempotência e controles do painel.
