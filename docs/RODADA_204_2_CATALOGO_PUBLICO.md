# R204.2 — catálogo público desacoplado da autenticação

## Problema
`/vagas` aguardava `CommerceProvider.loading === false` antes de chamar `/api/vagas`.
Uma inicialização lenta/abortada da sessão podia deixar o marketplace sem cards, mesmo sendo uma página pública.

## Correção
O catálogo agora faz a primeira carga imediatamente com `accessToken = null`.
Se a autenticação terminar depois e fornecer um token, a mesma carga é repetida para enriquecer dados personalizados.
Favoritos, carrinho, vendedor e checkout continuam no `CommerceProvider` compartilhado.
