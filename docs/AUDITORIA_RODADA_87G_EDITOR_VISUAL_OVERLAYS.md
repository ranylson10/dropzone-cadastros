# Rodada 87G — Editor visual de overlays

## Objetivo

Transformar o editor de overlays em uma ferramenta visual direta, reduzindo a dependência de campos numéricos e aplicando a identidade grafite, cinza e dourado aprovada para o DropZone.

## Alterações

- item selecionado pode ser pressionado e arrastado dentro do próprio bloco;
- setas movem o item em 1 px;
- Shift + setas move o item em 10 px;
- item selecionado recebe quatro alças de redimensionamento;
- imagens e logos preservam proporção por padrão;
- Shift libera o redimensionamento sem proporção;
- posições e dimensões continuam sincronizadas com os campos numéricos;
- botão **Testar cena** executa as transições de todos os blocos;
- botão de parada interrompe o preview atual;
- o preview completo considera tabelas, linhas, cards e camadas;
- painéis laterais receberam cinza médio/claro;
- cabeçalhos e barra superior receberam grafite;
- dourado foi mantido para seleção e ações principais;
- sombras decorativas foram removidas dos painéis.

## Regras preservadas

- zoom e pan não alteram medidas reais;
- arraste respeita os limites do bloco;
- desfazer registra um estado por gesto;
- edição continua local, sem recarregar a página;
- salvamento remoto continua explícito pelo botão Salvar;
- nenhuma tabela ou migration foi alterada.

## Validação

Executar:

```bat
npm run typecheck
npm run build
```

Após publicação, validar visualmente:

1. selecionar um item;
2. arrastar o item;
3. redimensionar pelos quatro cantos;
4. mover com setas e Shift + setas;
5. clicar em **Testar cena** e confirmar que todos os blocos animam;
6. confirmar a nova identidade visual.
