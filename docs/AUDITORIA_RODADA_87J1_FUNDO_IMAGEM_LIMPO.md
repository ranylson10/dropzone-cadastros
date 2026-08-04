# Rodada 87J1 — Fundo de imagem limpo

## Problema corrigido

Imagens PNG com transparência exibiam preto nas áreas transparentes porque a cor de segurança preta era aplicada automaticamente atrás da imagem. Isso também deixava texturas com aparência pesada e diferente do arquivo original.

## Alterações

- imagem de fundo passa a preservar transparência por padrão;
- uploads novos iniciam sem cor de apoio;
- escurecimento continua em 0 por padrão;
- a antiga cor de segurança foi transformada em **cor de apoio opcional**;
- a cor só aparece atrás da imagem quando **Usar cor de apoio** estiver marcado;
- configurações antigas com fallback preto deixam de forçar preto automaticamente;
- comportamento aplicado no editor, preview e execução ao vivo por meio das funções de estilo compartilhadas.

## Validação rápida

```bat
npm run typecheck
npm run build
```

## Validação visual

1. usar um PNG com transparência como fundo de linha ou tabela;
2. confirmar que as áreas transparentes mostram o fundo do overlay, sem preto;
3. confirmar que a textura não recebe escurecimento automático;
4. ativar **Usar cor de apoio** e confirmar que a cor aparece somente quando escolhida.
