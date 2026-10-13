# R155 — Fundação visual

Objetivo: unificar a linguagem do site sem reconstruir a aplicação.

## Direção
- Fundo principal cinza claro/off-white, evitando preto chapado fora das áreas de impacto.
- Grafite para cabeçalhos e heróis.
- Amarelo DropZone para ação, seleção e estado ativo.
- Texturas locais leves (halftone, speed lines e brush), sem imagens de IA.
- Bordas e raios contidos; hierarquia por contraste, não por excesso de efeitos.

## Implementação
- `web/app/dropzone-refresh.css` virou a última camada global de acabamento.
- `web/public/ui/texture-halftone.svg`
- `web/public/ui/texture-brush.svg`
- `web/public/ui/texture-speedlines.svg`
- `web/app/layout.tsx` importa a camada por último e atualiza metadata.
- Header público e header interno receberam a mesma linguagem.
