# Rodada 57 — Ignorar artefatos do navegador na auditoria

A comparação entre schema e código agora ignora diretórios gerados pelos testes e pelo navegador, incluindo `tests-e2e/.chrome-auth-profile` e `tests-e2e/.auth`.

Esses diretórios não pertencem ao código do DropZone. Extensões do Chrome continham chamadas `.from(...)` próprias e geravam falsos positivos para `browser_versions`, `profiles`, `trial_cards` e `user_devices`.

Nenhuma tabela, migration ou regra de banco foi alterada.
