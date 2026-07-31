# Rodada 73 — Agenda, notificações e relatórios

## Cobertura adicionada

- bloqueio da agenda pessoal sem autenticação;
- validação de mês inválido;
- rejeição de horário final anterior ao início;
- criação, listagem, atualização e exclusão de evento temporário;
- bloqueio de notificações sem autenticação;
- leitura autenticada do correio;
- rejeição de status inválido de notificação;
- bloqueio de denúncia sem autenticação;
- rejeição de alvo inválido;
- rejeição de descrição curta;
- bloqueio da moderação sem autenticação;
- rejeição de status administrativo inválido.

## Segurança

Somente um evento temporário da agenda é criado e ele é removido no bloco de
limpeza, inclusive quando alguma validação falha. Nenhuma denúncia real,
notificação ou relatório administrativo é alterado.

## Execução

Use somente:

`npm run testar:tudo`

O total esperado passa de 70 para 72 testes, considerando desktop e mobile.
