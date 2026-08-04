# Rodada 87H — Texto e imagem livres no editor de overlays

## Objetivo

Permitir que a produtora adicione texto livre e imagem livre diretamente pela área principal do editor, sem precisar criar primeiro um bloco vazio e depois inserir a camada.

## Alterações

- botão **+ Texto** ao lado de Bloco e Tabela;
- botão **+ Imagem** ao lado de Bloco e Tabela;
- texto livre nasce selecionado e pronto para digitação;
- imagem livre nasce selecionada e pronta para upload;
- ambos aparecem imediatamente no canvas e na lista de camadas;
- ambos podem ser arrastados e redimensionados;
- ambos participam do comando **Testar cena**;
- imagem usa `contain` por padrão para evitar corte inicial;
- campos numéricos e edição detalhada continuam disponíveis.

## Regras preservadas

- nenhuma migration;
- nenhuma alteração de API;
- nenhum recarregamento do editor;
- salvamento continua explícito;
- animação completa continua percorrendo todos os blocos visíveis.

## Validação

```bat
npm run typecheck
npm run build
```

Depois da publicação:

1. clicar em **+ Texto**;
2. digitar conteúdo e mover no canvas;
3. clicar em **+ Imagem**;
4. fazer upload e redimensionar;
5. executar **Testar cena**.
