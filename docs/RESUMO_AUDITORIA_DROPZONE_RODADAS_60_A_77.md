# Resumo da auditoria DropZone — Rodadas 60 a 77

A suíte automatizada consolidada cobre os principais fluxos públicos,
autenticados, administrativos e financeiros do DropZone.

## Áreas cobertas

- autenticação e sessões multiperfil;
- campeonatos, fases, grupos, jogos, quedas e pontuação;
- equipes, jogadores, lines, escalações, staff e managers;
- vendedores, vagas e catálogos;
- carteira, pagamentos, ASAAS e PayPal;
- regulamentos, exportações e súmulas;
- Lili e suas centrais privadas;
- broadcast, Stream e overlays;
- agenda, notificações e denúncias;
- uploads, formatos, limites e permissões;
- páginas públicas, buscas, mapas e ranking;
- webhooks e rotas internas de debug;
- concorrência moderada, repetição de requisições e estabilidade.

## Comando oficial de validação

`npm run testar:tudo`

Esse comando executa qualidade, compilação, auditoria de banco e segurança,
geração automática das sessões E2E e toda a suíte Playwright.

## Critério de aprovação

A auditoria só é considerada aprovada quando o resumo termina com:

`Resultado: TUDO APROVADO.`

Os avisos da auditoria devem continuar documentados e acompanhados, mas não
representam falha enquanto o relatório indicar zero erros.
