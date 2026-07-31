# Rodada 74 — Uploads e arquivos: segurança, formatos e limites

## Cobertura adicionada

- bloqueio de upload assinado sem autenticação;
- rejeição de bucket inexistente;
- rejeição de formato não suportado;
- limite de 5 MB para imagens de perfil;
- bloqueio de vídeo fora do bucket campeonato;
- bloqueio de escalada entre perfis;
- exigência de campeonato ou intenção explícita;
- geração válida de URL assinada para a própria produtora;
- sanitização do nome do arquivo;
- rejeição de upload direto vazio;
- validação da assinatura real de arquivo PNG.

## Segurança

O cenário válido apenas gera uma URL assinada, sem enviar bytes para o Storage.
Os demais casos são rejeitados antes de criar qualquer objeto. Nenhum arquivo,
perfil, campeonato ou dado real é alterado.

## Execução

Use somente:

`npm run testar:tudo`

O total esperado passa de 72 para 74 testes, considerando desktop e mobile.
