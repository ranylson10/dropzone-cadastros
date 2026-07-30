# Rodada 41 — Ajuste dos testes funcionais

Correções:

- o botão **Novo campeonato** passa a ser procurado no painel autenticado `/`, onde realmente existe;
- o formulário é limitado ao modal correto, evitando seletores ambíguos;
- o teste do manager deixa de exigir botões inexistentes no diretório público `/managers`;
- o manager agora navega pelas áreas reais `/campeonatos`, `/equipes` e `/jogadores`;
- há fallback por URL para o menu recolhido no mobile.

Nenhum teste cria ou altera dados permanentes.
