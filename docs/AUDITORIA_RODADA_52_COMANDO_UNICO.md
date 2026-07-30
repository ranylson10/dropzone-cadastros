# Rodada 52 — teste completo com um único comando

## Comando

```bat
npm run testar:tudo
```

## Etapas automáticas

1. ESLint
2. TypeScript
3. Build de produção
4. Auditoria completa do DropZone
5. Geração automática das cinco sessões E2E
6. Todos os testes Playwright públicos, autenticados, funcionais e controlados

O endereço E2E padrão é `https://dropzone-cadastros.vercel.app`. Para testar outro endereço, basta definir `E2E_BASE_URL` antes do comando.

O processo para na primeira falha, mostra a etapa exata e encerra com código diferente de zero. Quando tudo passa, imprime `Resultado: TUDO APROVADO.`
