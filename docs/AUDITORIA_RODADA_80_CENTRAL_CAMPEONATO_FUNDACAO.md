# Rodada 80 — Fundação da Central do Campeonato

## Escopo
- rota `/central-campeonato` responsiva e mobile-first;
- seleção apenas entre campeonatos vinculados à produtora, manager ou vendedor autorizado;
- endpoint somente leitura `/api/central-campeonato`;
- cards iniciais de vagas, equipes, grupos, jogos, resultados, pagamentos e regulamento;
- loading, vazio, erro e alertas operacionais iniciais;
- teste controlado de visitante, produtora, manager e usuário sem vínculo.

## Segurança
- autenticação por Bearer token;
- autorização reutiliza `getCampeonatoPermission`;
- nenhuma tabela, migration ou contrato novo;
- nenhuma mutação nesta rodada.

## Validação obrigatória
```bat
npm run testar:tudo
```
A rodada termina somente com `Resultado: TUDO APROVADO.`
