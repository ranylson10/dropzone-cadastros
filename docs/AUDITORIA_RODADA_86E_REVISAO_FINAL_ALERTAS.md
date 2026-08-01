# Auditoria — Rodada 86E — Revisão final dos Alertas Inteligentes

## Objetivo

Encerrar a Rodada 86 validando em conjunto as entregas 86A, 86B, 86C e 86D, sem introduzir novas regras operacionais nem automações destrutivas.

## Escopo revisado

- ciclo persistente `novo → lido → resolvido/dispensado → reaberto`;
- prioridades, categorias, escopos e ordenação;
- alertas por campeonato, jogo e equipe;
- prazos gerais e específicos por jogo;
- filtros, busca textual e período;
- ação em massa limitada a 200 alertas;
- exportações CSV de alertas e histórico;
- histórico imutável com responsável, e-mail e data;
- migrations, inventário publicado e classificação RLS;
- ausência de distribuição ou correção automática destrutiva.

## Arquivo de regressão adicionado

`tests-e2e/controlled/rodada-86e-revisao-final-alertas.spec.ts`

O teste final verifica os contratos estáticos essenciais da Rodada 86 e protege contra remoção acidental dos estados, histórico, filtros, exportações e classificações de banco.

## Validação oficial de fechamento

Executar somente após substituir os arquivos desta entrega:

```bash
npm run testar:tudo
```

A Rodada 86 só deve ser considerada encerrada quando o comando terminar com:

```text
Resultado: TUDO APROVADO.
```
