# Histórico de alterações

## 10 de julho de 2026 — Fundação da nova arquitetura

### Alterado

- criado `backend/` para regras de servidor;
- movida aplicação Next.js para `web/`;
- criada pasta `app/` para aplicativo futuro;
- movidos scripts SQL para `database/supabase/`;
- criadas estruturas de formulários reutilizáveis;
- criadas estruturas de produtoras, equipes, jogadores, managers e campeonatos;
- criadas áreas de fases, grupos e jogos;
- ajustados aliases TypeScript;
- criados documentos permanentes do projeto.

### Mantido temporariamente

- painel legado em `web/features/dropzone`;
- API genérica em `web/app/api/dropzone/route.ts`;
- route handlers dentro do Next.js.

### Próximo

- validar build;
- extrair formulário de campeonato;
- extrair formulário de equipe;
- criar gerenciamento de fases/grupos/jogos;
- automatizar slots no backend.

## 2026-07-10 — Cabeçalho global e faixa visual dos painéis

- Criado `web/components/layout/AppHeader.tsx`.
- Criado `web/components/layout/PanelHero.tsx`.
- Adicionado menu superior com logo DropZone, navegação principal e perfil do usuário.
- Movida a ação de sair para o menu do perfil.
- Adicionada faixa visual com textura, título, descrição, imagem do perfil e ação de atualização.
- Aplicado o novo layout aos painéis de produtora, equipe, jogador e manager por meio do componente principal.
- Adicionado comportamento responsivo para telas menores.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.

## 2026-07-10 — Configurações e administração de campeonatos

- criado formulário reutilizável `web/components/forms/campeonato/CampeonatoForm.tsx`;
- dados básicos obrigatórios: nome, logo e tipo;
- dados informativos e de controle passaram a usar `campeonato_configuracoes`;
- adicionados filtros por tipo: diário, copa, liga, xtreino e confronto;
- adicionada edição do campeonato e de suas configurações;
- adicionada exclusão lógica com `deleted_at` e status `excluido`;
- criação e edição exigem perfil de produtora e validação de propriedade no backend;
- a interface atualiza a lista local sem recarregar toda a página após criar, editar ou excluir.

## Modal global e correção do resumo de campeonato

- Criado `web/components/layout/SystemModal.tsx` como padrão reutilizável do sistema.
- Cadastro e edição de campeonato agora abrem sobre a página com fundo desfocado.
- Modal fecha ao clicar fora, no botão fechar ou ao pressionar `Esc`.
- A rolagem fica restrita ao formulário e a página de fundo permanece travada.
- Corrigido o grid dos indicadores de equipes, jogadores, fases, grupos e jogos.

## 2026-07-10 — Subaba Equipes por vagas

- A subaba Equipes foi extraída para `web/features/campeonatos/equipes`.
- Criada grade de vagas livres, reservadas e ocupadas.
- Adição manual permite escolher equipe e line ou criar uma nova line.
- Convites agora ficam vinculados a uma vaga e identificam equipe e line.
- Criadas ações para copiar mensagem, renovar e cancelar convite.
- Criada página pública `/convite/equipe/[token]`.
- Permissões são verificadas no backend para dono da produtora e managers autorizados.
- Uma mesma equipe pode ocupar várias vagas por meio de lines diferentes.

## 2026-07-10 — Lista compacta de vagas

- Subaba Equipes alterada de cards para lista compacta expansível.
- Adicionados filtros: Todas, Livres, Reservadas e Preenchidas.
- Resumo de vagas reduzido para indicadores discretos.
- Ações administrativas aparecem somente ao expandir uma vaga.
- Cabeçalho grande da subaba removido para melhorar o aproveitamento do espaço.

## 2026-07-10 — Lines e escalações por participação
- A aba Jogadores passou a consumir participações válidas (`campeonato_equipe_id` + `line_id` + `vaga_id`).
- A listagem agora é organizada por line, mostra vaga, equipe principal, quantidade de jogadores e situação da escalação.
- Lines sem jogadores permanecem válidas e aparecem como escalação pendente.
- A pesquisa de equipes informa quais lines já estão inscritas no campeonato e bloqueia sua seleção.
- A API de entrada manual valida novamente a duplicidade de line no backend.
- Adicionada migração para criar line principal nas equipes antigas e criar automaticamente a primeira line em novas equipes.
