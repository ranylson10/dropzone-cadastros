# Rodada 12 — manutenção de vendedores

A API `GET/POST /api/campeonatos/[id]/vendedores` passou a oferecer também:

- `PATCH`: altera limite de vagas, permissões e status do vínculo;
- `DELETE`: cancela convite pendente ou remove o vendedor do campeonato por cancelamento lógico.

A exclusão não apaga histórico. O registro em `campeonato_vendedores` recebe `status = cancelado`, preservando auditoria, vendas e referências existentes.

O scanner CRUD também deixa de tratar pagamentos, captura PayPal, saque, denúncias, convites e ações por token como cadastros comuns que obrigatoriamente precisariam de edição e exclusão.
