# Rodada 66 — Identidades E2E distintas

## Problema encontrado

A seleção automática passou a escolher `blackxl.santos@gmail.com` tanto para produtora quanto para manager. Como uma mesma identidade possuía vários perfis, três testes deixaram de representar usuários diferentes:

- convite de manager era interpretado como auto-convite;
- uma sessão de jogador também conseguia responder como manager;
- o vendedor também era proprietário da produtora e conseguia alterar o próprio limite.

## Correção

- O gerador de sessões agora exige que o perfil `manager` use uma identidade diferente de `admin` e `produtora`.
- Quando não há e-mail fixado, ele percorre os managers disponíveis até encontrar uma conta distinta.
- Caso não exista uma conta compatível, informa claramente para configurar `E2E_MANAGER_EMAIL`.
- O teste negativo de convite de staff usa a identidade da equipe, que não é a destinatária da notificação, em vez da conta compartilhada de jogador.

Nenhuma regra da aplicação, tabela ou migration foi alterada.
