# Rodada 65 — Identidade sem perfil manager

## Diagnóstico

O teste usava a sessão `jogador` para tentar aceitar o convite de vendedor. Essa conta também possui um perfil `manager`, e a API autoriza pela identidade autenticada e pelos perfis reais vinculados ao usuário — não apenas pelo cabeçalho visual `x-profile-type`.

Por isso, a aceitação foi válida e o teste produziu um falso negativo.

## Correção

O cenário negativo agora usa a sessão `equipe`, pertencente a uma identidade sem perfil manager. Assim, o teste confirma corretamente que uma conta sem perfil manager não consegue aceitar o convite.

Nenhuma rota, regra de autorização, migration ou dado do sistema foi alterado.
