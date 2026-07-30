# Rodada 40 — Testes funcionais principais

Esta rodada adiciona uma suíte Playwright autenticada e não destrutiva.

## Cobertura

- Produtora: abre o formulário de campeonato, envia formulário vazio, valida o retorno da API, preenche dados e cancela sem criar registro.
- Admin: alterna entre Aprovações, Preços e Saques.
- Equipe: abre a edição do perfil e verifica campos sem salvar mudanças.
- Manager: navega pelas áreas principais.
- Jogador: carrega o perfil e valida links internos sem erro 500.
- Execução em desktop e mobile pelos dois projetos já configurados no Playwright.

## Comandos

```bat
set E2E_BASE_URL=https://dropzone-cadastros.vercel.app
npm run test:e2e:auth:prepare
npm run test:e2e:functional
```

Para executar toda a suíte:

```bat
npm run test:e2e:all
```
