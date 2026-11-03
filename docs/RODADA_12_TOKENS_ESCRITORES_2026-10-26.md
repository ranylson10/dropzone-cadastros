# DropZone R12 — Escritores de convites de jogador e vendedor

**26/10/2026.** Base: versão segura acumulada R01–R11. **Código alterado, banco de produção intacto, site não publicado.**

## Problemas confirmados

1. O aceite `/api/equipes/convites-elenco/[token]` escrevia elenco, line e formação **antes** do `UPDATE` de uso do token. A atualização não exigia `usado=false`, permitindo que dois solicitantes produzissem efeitos e recebessem sucesso.
2. O aceite `/api/vendedores/convite/[token]` marcava um token como usado sem `WHERE status='ativo' AND usado=false`. Dois managers poderiam disputar o mesmo convite.
3. A renovação/cancelamento de `/api/equipes/convites-elenco` lia o estado antes de gravar e executava o `UPDATE` apenas pelo `id`, podendo sobrescrever um convite consumido entre a leitura e a gravação.
4. A pesquisa de convites da Lili usava `ilike` mesmo com tokens sensíveis a maiúsculas e minúsculas.

## Ajustes

- Novo `backend/src/campeonatos/invites/one-time-claims.ts`, com `UPDATE ... WHERE id, tipo, status='ativo', usado=false, validade ... RETURNING`, sem escrita para destinatários derrotados. Um retry só é autorizado para o **mesmo destinatário**.
- Convite de jogador: token reclamado **antes** do cadastro no elenco; se o cadastro falhar depois do claim, o mesmo jogador pode retomar por **30 minutos**. O GET volta a exibir o convite já consumido apenas para o jogador autenticado que o reclamou e dentro do prazo de retomada. Terceiros não podem continuar esse convite.
- Convite de vendedor: token protegido pela mesma semântica. Caso o servidor falhe depois do claim, o mesmo manager pode repetir os upserts de cadastro, recuperando a operação. Uma atualização de vendedor que falhar agora retorna erro em vez de ser ignorada.
- Renovação e cancelamento do convite de elenco: `UPDATE` com filtros de `equipe_id`, `tipo`, `status`, `usado`; uma atualização obsoleta é rejeitada.
- Consulta da Lili: cinco pesquisas de token passaram a usar comparação exata `eq`, preservando letras maiúsculas/minúsculas.
- A resposta de aceite de vendedor mantém o objeto `vendedor` com campos preexistentes, adicionando `repetida` como indicador de retry; o `GET` expõe `retomada` quando aplicável.

## Verificações realizadas

- `node scripts/testes/test-round12-token-writers.mjs` → **95 verificações de mocks/contratos aprovadas**, com simulação de dois destinatários disputando um token, proteção de renovação/cancelamento e reabertura do convite pelo dono.
- `npm run test:rounds` → regressões R01–R11 e R12 aprovadas no ambiente local (ver logs de entrega).
- Parser TypeScript para arquivos alterados; sem erro sintático.
- **Não executados**: build Next completo, Playwright conectado, duas conexões PostgreSQL, deploy em Vercel.

## Limitações que impedem declarar homologação final

O consumo do token agora é uma operação condicional indivisível, mas **elenco, formação, vendedor, contato e token NÃO são gravados na mesma transação**. Se a operação falhar no meio, pode deixar progresso parcial, embora o retry pelo mesmo titular possa reparar parte do fluxo. O limite de 30 minutos para convites de jogador implica recuperação manual depois desse prazo. Duas requisições do mesmo destinatário ainda podem disputar a criação do elenco; o banco precisa impor unicidade adequada.

A solução definitiva requer migrations verificadas e RPCs transacionais para consumo + gravações de perfil, reserva, inscrição e vendas em **uma transação**, com idempotência persistida; homologação no PostgreSQL real com duas sessões. Não ativar flags `DROPZONE_*_MODE=atomic` por conta da R12.

## Segurança do pacote

Nenhuma credencial, sessão `.auth` ou arquivo `.env.local` faz parte do ZIP. Execute `npm ci` e `TESTAR_RODADA_12.bat` no Windows. O script `scripts/release/empacotar-fonte.mjs` controla a exportação de fontes sem segredos.
