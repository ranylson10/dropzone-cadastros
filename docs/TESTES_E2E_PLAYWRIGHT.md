# Robô funcional DropZone — Playwright

## Rodada 33

Esta primeira etapa instala a base do robô funcional e valida os fluxos públicos sem alterar dados reais.

Cobertura inicial:

- disponibilidade da API `/api/ping`;
- abertura das páginas públicas em desktop e celular;
- captura de erros JavaScript do navegador;
- verificação do fluxo visual da página de login;
- descoberta e validação de até 40 links internos públicos;
- relatório HTML, screenshot, vídeo e trace quando houver falha.

## Instalação

Na raiz do projeto:

```bat
npm install
npm run test:e2e:install
```

## Execução local

```bat
npm run test:e2e
```

O Playwright inicia `npm run dev` automaticamente quando não existe `E2E_BASE_URL`.

## Execução visual

```bat
npm run test:e2e:ui
```

## Testar um deploy de homologação

No CMD:

```bat
set E2E_BASE_URL=https://SEU-DEPLOY-DE-TESTE.vercel.app
npm run test:e2e
```

O robô não deve ser apontado para produção quando as próximas rodadas começarem a criar, editar ou excluir dados.

## Relatório

```bat
npm run test:e2e:report
```

Os artefatos ficam em `relatorios-testes/playwright-report` e `relatorios-testes/playwright-resultados`.

## Próximas etapas

A próxima rodada adicionará sessões separadas para administrador, produtora, manager, equipe e jogador. Depois serão implementados os fluxos encadeados de campeonato, convites, inscrição, escalação e permissões.
