# Rodada 86E — Hotfix do limite de consulta do catálogo

## Causa confirmada

A criação do campeonato grava `campeonato_configuracoes` por upsert, mas a rota pública carregava configurações, fases, grupos, slots, jogos e compras por consultas globais. Em bases maiores, a resposta do PostgREST pode ser truncada pelo limite de linhas, fazendo um campeonato recém-criado aparecer na consulta principal e sua configuração não aparecer no mapa auxiliar.

## Correção

Para catálogo de vendedor e diagnóstico administrativo, a rota agora recarrega diretamente os campeonatos vinculados usando filtros por `campeonato_id`, mescla os resultados sem duplicidade e também busca relações de jogos pelos IDs correspondentes.

## Segurança

- Nenhuma alteração de banco.
- Nenhuma mudança de permissão.
- Nenhuma distribuição automática.
- Diagnóstico continua restrito ao administrador do sistema.
