# Lili

A rota Next.js `web/app/api/lili/chat/route.ts` lê o JSON, executa `runLiliChat` e traduz o resultado/erro para HTTP. Ela não contém consultas ou regras de pagamento.

- `chat-service.ts`: normalização de entrada, idioma e retomada da etapa da conversa.
- `dispatch.ts`: registro dos 88 comandos em 19 handlers de domínio.
- `handlers/`: agenda, contas, campeonatos, equipes, convites, inscrições e pagamentos. As verificações de usuário, equipe e compra ficam junto da operação que protegem.
- `helpers/`: composição de mensagens e ações; adaptação dos endpoints existentes de convite/escalação.
- `internal-api.ts`: permite encaminhar a sessão somente às origens configuradas da aplicação, recusa redirects e limita a espera a dez segundos.
- `tools/`: consultas e apresentação de cards divididas por domínio.
- `locale.ts` e `types.ts`: dados/tipos compartilháveis com o cliente. Não importam banco ou provedores privados.
- `localize-response.ts` e `intent-router.ts`: integração de servidor com tradução e reconhecimento de intenção.

As fachadas de `web/features/lili` preservam imports existentes. Novos serviços de servidor devem importar `@backend/lili` diretamente. Código do cliente deve usar apenas tipos e `locale.ts`.

No desenvolvimento, configure `NEXT_PUBLIC_APP_URL` ou `APP_URL` com a origem local e a porta corretas. Em previews da Vercel, os endereços de `VERCEL_URL` e `VERCEL_BRANCH_URL` também são aceitos; o domínio recebido na requisição não cria autorização.

Validação: `npm run test:security` inclui os comandos anônimos da Lili, os gates privados e a recusa de origem externa antes de encaminhar credenciais. Billing e banco usam fixtures; não são testes de cobrança real.
