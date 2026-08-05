# Rodada 87L2 — Mapa territorial interativo de calls

## Objetivo

Substituir o cadastro simples de calls do Xtreino por um editor visual no qual as calls são demarcadas como territórios sobre o mapa.

## Implementado

- mapa ocupa a área principal da aba;
- criação de regiões por polígono, clicando ponto a ponto;
- pontos armazenados proporcionalmente para manter o desenho responsivo;
- seleção de uma ou várias calls;
- aplicação manual de equipe/line nas regiões selecionadas;
- escolha de cor e opacidade;
- logo e nome da equipe sobre a região;
- legenda lateral com calls livres e ocupadas;
- renomear, excluir e limpar vínculos;
- uma equipe pode receber mais de uma call no mesmo mapa;
- nenhuma distribuição automática;
- calls antigas sem polígono ficam numa área de conversão.

## Migration obrigatória

Executar no Supabase:

```text
database/migrations/20260805_xtreino_calls_mapas_interativas.sql
```

A migration adiciona geometria, posição de legenda, cor e opacidade e remove a restrição antiga que impedia uma equipe de ocupar mais de uma call principal no mesmo mapa.

## Limite desta subrodada

As delimitações não são inventadas automaticamente. O administrador desenha as áreas reais de acordo com a divisão usada pela organização. Assim, o sistema não presume limites incorretos ou nomes universais para as calls.

## Validação rápida

```bat
npm run typecheck
npm run build
```

## Contrato visual

1. Selecionar um mapa com imagem cartográfica.
2. Clicar em **Desenhar call**.
3. Marcar pelo menos três pontos e salvar.
4. Criar outras regiões.
5. Selecionar uma ou várias regiões.
6. Escolher equipe, cor e opacidade.
7. Aplicar e confirmar cor translúcida, logo e nome.
8. Limpar, renomear e excluir.
