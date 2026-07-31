# Rodada 76 — Webhooks e rotas de debug em produção

## Cobertura adicionada

- status público mínimo do webhook ASAAS;
- ausência de tokens e segredos na resposta de status;
- rejeição de webhook ASAAS sem token;
- rejeição de webhook ASAAS com token falso;
- status público mínimo do webhook PayPal;
- ausência de credenciais na resposta de status;
- rejeição de webhook PayPal sem assinatura;
- bloqueio das rotas internas de diagnóstico em produção;
- ausência de dados de managers e tokens nas respostas;
- confirmação de que o antigo endpoint de criação de manager segue desabilitado.

## Segurança

Todos os identificadores usados são fictícios. Nenhum pagamento, manager,
convite, token ou registro real é criado ou alterado.

## Execução

Use somente:

`npm run testar:tudo`

O total esperado passa de 78 para 82 testes, considerando os dois cenários
executados em desktop e mobile.
