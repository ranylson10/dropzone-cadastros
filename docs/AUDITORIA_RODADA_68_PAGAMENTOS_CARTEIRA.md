# Rodada 68 — Pagamentos e carteira em modo seguro

Esta rodada adiciona testes E2E que não criam cobrança real e não simulam confirmação de pagamento.

Cobertura adicionada:

- bloqueio de cotação sem autenticação;
- cotação autenticada e conferência matemática do total;
- normalização de tipo inválido e limite máximo de vagas;
- consulta autenticada da carteira e seus históricos;
- bloqueio de carteira sem autenticação;
- bloqueio de saque abaixo do valor mínimo;
- bloqueio de cobrança de inscrição sem participação válida;
- bloqueio de consulta de pagamento sem identificador;
- saúde pública dos webhooks ASAAS e PayPal;
- rejeição de webhook ASAAS com token inválido ou serviço não configurado.

Não são usados cartões, PIX real, captura PayPal, confirmação ASAAS ou alteração de saldo.
