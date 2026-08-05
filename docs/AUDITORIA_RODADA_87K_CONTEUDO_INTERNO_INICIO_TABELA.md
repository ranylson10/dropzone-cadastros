# Rodada 87K — Conteúdo interno e início da tabela

## Objetivo

Permitir reposicionar texto/imagem dentro da própria caixa sem mover o fundo e garantir que tabelas possam começar em qualquer posição dos dados.

## Alterações

- cada camada possui deslocamentos independentes `Conteúdo X` e `Conteúdo Y`;
- texto ou imagem se move dentro da caixa enquanto o fundo permanece parado;
- botão **Centralizar conteúdo** redefine os deslocamentos;
- o campo da tabela foi renomeado para **Começar na posição**;
- o número de slots foi renomeado para **Quantidade de linhas**;
- fontes que não possuem uma coluna explícita de posição agora também respeitam o início configurado;
- exemplo: posição inicial 2 e 9 linhas renderiza TOP 2 ao TOP 10.

## Compatibilidade

Camadas antigas não possuem os novos campos e continuam centralizadas, pois o deslocamento padrão é zero.

## Validação rápida

```bat
npm run typecheck
npm run build
```
