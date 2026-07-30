# Rodada 61 — Convites e permissões controlados

Adiciona cobertura E2E real para o fluxo de staff de equipe:

- equipe convida um manager real;
- convite aparece no correio do destinatário;
- jogador não consegue aceitar convite de outro perfil;
- manager aceita o convite;
- permissões iniciais são verificadas;
- dono da equipe altera permissões;
- manager não consegue alterar as próprias permissões;
- dono remove o vínculo;
- teste confirma que o manager não permanece ativo no staff;
- lock local evita colisão entre desktop e mobile;
- limpeza automática é executada no bloco `finally`.

O teste é incluído automaticamente em `npm run testar:tudo` porque fica em `tests-e2e/controlled`.
