# Como atualizar a documentação

Ao finalizar uma rodada:

1. Atualize a data e o estado em `PROJECT_CONTEXT.md`.
2. Mova itens concluídos da seção “próxima etapa” para “estado atual”.
3. Registre arquivos e decisões em `docs/CHANGELOG.md`.
4. Registre testes em `docs/TESTES_E_VALIDACOES.md`.
5. Atualize `docs/BANCO_DE_DADOS.md` somente com informações confirmadas por SQL ou código.
6. Caso uma decisão arquitetural mude, explique o motivo em `docs/ARQUITETURA.md`.

Nunca apagar histórico importante apenas para deixar o documento menor. Resumir e manter a decisão final e sua justificativa.
