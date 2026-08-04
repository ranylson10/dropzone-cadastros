# Rodada 87H1 — elementos livres no canvas

## Correção

Texto livre e imagem livre deixaram de nascer dentro de um bloco pequeno.

O editor agora cria ou reutiliza um canvas transparente com o mesmo tamanho do frame do overlay. Cada texto ou imagem recebe posição, largura, altura e ordem próprias dentro desse frame completo.

## Resultado esperado

- texto pode ser movido para qualquer ponto da arte;
- imagem pode ser movida para qualquer ponto da arte;
- ambos podem ser redimensionados sem o limite do antigo bloco pequeno;
- novos elementos livres reutilizam o mesmo canvas transparente;
- vínculo de dados existente das camadas continua disponível;
- salvamento permanece compatível com overlays anteriores.

## Escopo posterior

Cronômetro/countdown e páginas automáticas com loop e transições serão implementados em subrodadas próprias, pois alteram execução ao vivo e persistência do overlay.

## Validação

```bat
npm run typecheck
npm run build
```
