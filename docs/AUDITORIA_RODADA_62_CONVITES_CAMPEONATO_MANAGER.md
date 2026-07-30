# Rodada 62 — Convites de manager por campeonato

Adiciona um cenário E2E controlado que cobre os dois fluxos reais de vínculo entre manager e campeonato:

- produtora convida o manager pelo correio;
- bloqueio de convite pendente duplicado;
- bloqueio de aceite por perfil incorreto;
- manager aceita e recebe acesso somente ao campeonato convidado;
- validação de limite de vagas e permissões restritas;
- bloqueio de pedido duplicado enquanto o vínculo está ativo;
- remoção do vendedor;
- manager solicita acesso ao mesmo campeonato;
- bloqueio de autoaprovação;
- produtora aprova o pedido pelo correio;
- remoção do vínculo e arquivamento automático dos dados temporários.

O teste usa um lock para impedir conflito entre desktop e mobile e mantém o comando único `npm run testar:tudo`.
