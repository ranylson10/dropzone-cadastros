# R201.1 — fechamento da migração de formulários no editor da Home

A auditoria da R201 identificou 23 ocorrências restantes de `input`, `select` e `textarea` nativos em `web/features/admin/HomePageEditor.tsx`.

Esta correção troca todas elas pelos primitives compartilhados `Input`, `Select` e `Textarea` de `web/components/ui/Field.tsx`, incluindo uploads de arquivo. Não altera regras de negócio, configuração da Home ou fluxo de upload/salvamento.

Validação esperada:

```cmd
npm run audit:form-migration
npx playwright test tests-e2e/controlled/rodada-201-1-form-migration-admin.spec.ts --project=chromium-desktop --project=chromium-mobile --workers=1
```

A R201 só deve ser considerada concluída quando a auditoria global e este teste passarem.
