# Rodada 85F — escolha manual de grupos

## Objetivo

Manter a classificação entre etapas sem distribuir equipes automaticamente nos grupos. O grupo é escolhido pelo administrador ou pela própria equipe quando a fase estiver aberta para escolha.

## Entregas

- configuração por fase para abrir ou fechar a escolha;
- opção para permitir ou bloquear trocas;
- distribuição manual pelo administrador;
- endpoint autenticado para a equipe escolher entre grupos com vagas;
- reserva concorrente do primeiro slot livre;
- liberação do slot anterior após troca concluída;
- bloqueio de grupo lotado e de troca não autorizada;
- histórico com grupo/slot anterior, novo, origem e usuário responsável;
- painel com contagem de vagas livres por grupo;
- nenhum algoritmo de distribuição automática.

## Banco

- `campeonato_grupo_escolha_configuracoes`;
- `campeonato_grupo_escolha_historico`.

## Contrato operacional

A progressão define somente quais equipes avançaram. Ela não define grupo nem slot. O administrador pode alocar manualmente, ou abrir a escolha para as equipes em uma fase específica.

## Validação esperada

- inventário com 96 tabelas base;
- auditoria sem avisos ou erros;
- Playwright com quatro novos casos considerando desktop e mobile.
