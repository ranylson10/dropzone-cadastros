# Rodada 87J — Imagem em todos os fundos

## Objetivo

Permitir imagem de fundo nos mesmos pontos em que o editor já oferece cor de fundo, sem remover a compatibilidade com cores sólidas, degradês ou transparência.

## Alterações

- o editor de fundo continua oferecendo sem fundo, cor sólida e degradê;
- todos os `BoxStyle` passam a oferecer também imagem;
- imagem pode ser enviada do computador ou informada por URL;
- opções de ajuste: cobrir, conter e esticar;
- opções de posição: centro, topo, base, esquerda e direita;
- repetição: nenhuma, completa, horizontal ou vertical;
- cor de segurança usada enquanto a imagem carrega ou caso falhe;
- controle de opacidade e escurecimento preservados;
- cabeçalho, linha padrão, coluna, bloco, camada, texto e número usam o mesmo editor de fundo;
- linhas alternadas agora aceitam estilo completo, inclusive imagem;
- linhas individuais da tabela agora aceitam estilo completo, inclusive imagem;
- valores antigos de cor continuam compatíveis.

## Validação rápida

```bat
npm run typecheck
npm run build
```

## Validação visual

1. selecionar um bloco e escolher fundo por imagem;
2. testar cobrir, conter e esticar;
3. selecionar cabeçalho e linha padrão da tabela;
4. configurar imagem na linha alternada;
5. selecionar uma linha individual e aplicar imagem;
6. selecionar uma coluna e aplicar imagem;
7. abrir a Browser Source e confirmar que a imagem aparece igual ao editor.
