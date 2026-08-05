# Rodada 87M — Correção do assistente de criação

## Objetivo

Corrigir o layout do formulário de criação em todos os tipos de campeonato, principalmente a etapa de origem e a seleção de campeonato usado como modelo ou temporada anterior.

## Alterações

- opções de origem transformadas em três cards separados;
- textos com espaçamento e hierarquia visual;
- estado selecionado destacado em dourado;
- lista de modelos em grid responsivo;
- rolagem limitada à lista de modelos;
- logos limitadas a 72 × 72 px;
- imagens usam `object-fit: contain` e não ampliam o card;
- nome, descrição e ação do modelo ficam separados;
- modal largo para evitar conteúdo espremido;
- layout mobile em uma coluna;
- cabeçalho e rodapé do modal continuam preservados.

## Validação rápida

```bat
npm run typecheck
npm run build
```

## Validação visual

1. abrir criação de Diário, Copa, Liga, Xtreino e Confronto;
2. conferir os três cards de origem;
3. escolher **Usar como modelo**;
4. confirmar logos pequenas e inteiras;
5. rolar somente a lista de modelos;
6. selecionar um modelo e avançar;
7. repetir com **Criar nova season**.
