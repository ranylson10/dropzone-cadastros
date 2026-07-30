# Rodada 60 — Jogadores e MVP controlados

Adiciona um cenário E2E real e autolimpável para o núcleo individual do campeonato.

## Cobertura

- cria e aprova campeonato temporário;
- cria fase, grupo, slot e jogo;
- inscreve equipe e line;
- gera link real de escalação;
- autentica o perfil jogador e entra na line;
- confirma o jogador na listagem pública do campeonato;
- lança abates, dano, assistências e revives;
- valida ranking MVP e colocação;
- finaliza a queda e confirma bloqueio de edição;
- reabre a queda;
- remove jogador, encerra link e limpa toda a estrutura temporária.

## Execução

```bat
npm run testar:tudo
```

Total esperado: 54 testes Playwright, contando desktop e mobile.
