# Rodada 49 — Inscrição controlada de equipe

## Objetivo
Validar, com dados temporários reais, o fluxo de uma equipe ocupando uma vaga em campeonato aprovado e a liberação automática dessa vaga no encerramento do teste.

## Fluxo coberto
1. Identifica a equipe autenticada pelo endpoint `/api/me`.
2. Cria um campeonato temporário do tipo Copa.
3. Aprova o campeonato como administrador e marca a cobrança como cortesia.
4. Cria fase, grupo e quatro slots.
5. Inscreve a equipe autenticada no primeiro slot livre.
6. Confirma a participação em `championship_team`.
7. Confirma o slot como ocupado pela equipe.
8. Libera o slot pela API da produtora.
9. Confirma que a participação ativa deixou de existir.
10. Remove grupo, fase e arquiva o campeonato temporário no bloco `finally`.

## Segurança
- Não usa equipes fictícias permanentes.
- Não realiza pagamento.
- Não publica escalação de jogadores.
- Todo registro estrutural criado usa prefixo `[E2E]`.
- A limpeza roda mesmo quando uma asserção falha.

## Execução
```bat
set E2E_BASE_URL=https://dropzone-cadastros.vercel.app
npm run test:e2e:auth:prepare
npm run test:e2e:controlled
npm run test:e2e:all
```

## Total esperado
- Controlados: 6 testes.
- Conjunto completo: 48 testes.
