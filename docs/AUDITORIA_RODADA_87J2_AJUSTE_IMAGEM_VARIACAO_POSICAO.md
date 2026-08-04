# Rodada 87J2 — Ajuste de imagem e variação de posição

## Alterações

- imagens de fundo passam a usar **Conter** como ajuste padrão;
- **Cobrir** e **Esticar** continuam disponíveis;
- imagens maiores encolhem para caber integralmente na célula quando `Conter` está ativo;
- a coluna de variação das overlays usa:
  - verde para subida;
  - vermelho para queda;
  - amarelo/dourado para manutenção;
- a tabela geral do campeonato recebeu a coluna `Δ`;
- o MVP recebeu a coluna `Δ`;
- a variação nas tabelas do campeonato é calculada em relação à atualização anterior feita na tela.

## Validação rápida

```bat
npm run typecheck
npm run build
```

## Validação visual

1. usar imagem maior que a célula e selecionar `Conter`;
2. confirmar que a imagem aparece inteira;
3. trocar para `Cobrir` e confirmar o recorte;
4. trocar para `Esticar` e confirmar largura e altura completas;
5. atualizar a classificação após mudança de posições;
6. confirmar verde para subida, vermelho para queda e amarelo para posição mantida;
7. repetir a validação na tabela geral, MVP e overlay.
