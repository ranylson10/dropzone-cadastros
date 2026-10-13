# R196 — Fundação de UI compartilhada

Objetivo: parar de criar controles básicos página por página. Esta rodada cria uma camada oficial em `web/components/ui` e a carrega uma única vez no layout raiz.

Componentes iniciais: Button, IconButton, Surface, Badge, SectionHeader, EmptyState, Field/Input/Select/Textarea.

Primeira integração real: `SystemModal` deixa de possuir um botão de fechar próprio e usa `IconButton` compartilhado. As próximas rodadas devem migrar componentes existentes para esta fundação, em vez de duplicar HTML/CSS.

R197 será responsável por um único `ChampionshipCard` global, usado por Home, catálogo e vagas.
