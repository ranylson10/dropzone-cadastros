# Auditoria de Service Role e RLS

A Service Role ignora as policies do Supabase. Por isso, toda rota que usa `supabaseAdmin` precisa validar o usuário e o vínculo com a entidade antes de ler ou alterar dados.

O robô gera dois arquivos:

- `relatorios-testes/matriz-service-role-rotas.json`
- `relatorios-testes/matriz-service-role-rotas.csv`

A matriz classifica cada rota em:

- **protegida**: autenticação e autorização foram localizadas;
- **pública/token/webhook**: acesso público intencional com token, assinatura ou segredo;
- **revisar autenticação**: escrita administrativa sem autenticação evidente no próprio arquivo;
- **revisar autorização**: usuário autenticado, mas sem validação clara de dono, manager, produtora ou campeonato;
- **leitura administrativa**: leitura com Service Role sem autenticação local evidente.

O scanner é conservador. Uma rota pode ser protegida por um helper importado que não foi reconhecido. Esses casos devem ser revisados antes de alterar o código.

## Regra para tabelas com RLS e sem policies

Uma tabela sem policy pode permanecer assim quando todo acesso ocorre exclusivamente por backend autenticado com Service Role. Não se deve criar policy pública apenas para eliminar um aviso do robô.

Antes de criar policy, confirme:

1. quem precisa acessar;
2. se o acesso acontece pelo navegador ou pelo backend;
3. qual entidade precisa ser validada;
4. quais operações são necessárias: SELECT, INSERT, UPDATE ou DELETE;
5. se dados financeiros, tokens, auditoria ou moderação devem continuar exclusivamente no backend.
