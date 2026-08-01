# Rodada 86E — Hotfix da fixture de configuração do catálogo

## Diagnóstico confirmado

O diagnóstico controlado confirmou que o campeonato temporário era criado e aprovado, possuía banner e vínculo ativo com o vendedor, porém não tinha uma configuração comercial elegível no momento da consulta pública:

- `campeonato_encontrado: true`
- `status: ativo`
- `aprovacao_status: aprovado`
- `banner_presente: true`
- `vinculos_vendedor_ativos: 1`
- `configuracao_encontrada: false`
- `motivo_exclusao: configuracao_ausente_ou_inscricoes_fechadas`

## Correção

O teste controlado agora consolida explicitamente a configuração comercial do campeonato pela própria API oficial de edição antes de criar a fase, o grupo e o vínculo do vendedor.

A fixture valida imediatamente:

- `aceita_novas_inscricoes_equipes = true`;
- `numero_vagas = 4`.

Isso impede que o fluxo prossiga com uma fixture incompleta e elimina o falso negativo no catálogo público.

## Escopo

- Nenhuma regra comercial foi flexibilizada.
- Nenhuma migration foi criada.
- A API pública continua exigindo configuração ativa e inscrições abertas.
- O diagnóstico controlado permanece disponível durante o fechamento da rodada.
