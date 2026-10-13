# Fixtures históricas de regressão

Estes arquivos preservam implementações anteriores apenas para testes isolados. Não são handlers da aplicação nem código de produção. As suítes substituem autenticação e acesso ao banco por dados e transporte fictícios.

Os snapshots ficavam em `relatorios-testes`, pasta ignorada pelo Git. Foram copiados sem mudar seus bytes para manter as regressões reproduzíveis em checkout limpo e no CI. Não importe estas implementações nos módulos da aplicação.

Os atributos desta pasta preservam os bytes dos snapshots, sem conversão de finais de linha, inclusive a linha vazia final capturada na origem. Essa exceção de whitespace vale somente para as fixtures históricas `.ts`.
