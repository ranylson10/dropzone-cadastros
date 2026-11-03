# DropZone — Redesign Arena UI (R20–R24)

**Base de trabalho:** ZIP enviado pelo usuário em 31/10/2026 (`dropzone-cadastros-ENVIO(2).zip`), que passou na auditoria R19 V3. **Objetivo:** reduzir tempo até a ação, dar navegação tipo aplicativo no celular e preservar todos os recursos avançados. **Não alterar schemas, pagamentos, permissões ou APIs ao redesenhar.**

## R20 — Navegação e hierarquia (implementada neste pacote)

- Navegação global explícita: Início, Campeonatos, Equipes, Jogadores, Mais.
- Mobile: bottom navigation com 5 destinos também nas páginas públicas, botão flutuante de ações no painel autenticado e menu lateral com conta e ferramentas.
- Painéis de produtora, equipe e jogador: 2–3 áreas principais, restantes em menu expansível; manager mantém as três áreas operacionais, edição de perfil em menu secundário.
- Campeonato selecionado: atalhos para Dados, Estrutura, Equipes, Jogos, preservando as abas completas já existentes.
- Identidade Arena UI: cabeçalho grafite com detalhes violeta/ouro, microinterações rápidas e respeito a `prefers-reduced-motion`.
- Mudanças de **interface** somente. Criação de campeonato ainda usa o formulário já existente e suas validações.

## R21 — Criar primeiro, configurar depois (implementada no pacote R21)

- Produtora: escolha formato → cadastro rápido (nome, logo, vagas, gratuito/pago) → revisão e cotação → criar pendente. Botão **Configurar campeonato** aparece após a criação. Assistente completo para modelos/seasons/estrutura permanece disponível; as validações atuais continuam.
- Equipe: cadastro inicial com nome, @usuário e tag exigidos pelo backend; logo e localização em seção opcional. Após criar, organizar lines e elenco no painel.
- Jogador: nick, @usuário e ID de jogo exigidos; função, foto e localização ficam na área opcional. Edição posterior preservada.
- Não criar linhas incompletas no banco: se faltar algum campo tecnicamente obrigatório, exigir apenas esse campo.

## R22 — Painéis por papel e tarefas

- Produtora: campeonatos e inscrições pendentes, com ações relevantes por estado.
- Equipe: escalar, vagas, convites, jogos do dia.
- Jogador: equipe, competições, convites.
- Manager e vendedor: convites, comissões, campanhas; sem confundir permissões do manager com poderes de produtora.
- Estado vazio sempre mostra próximo passo.

## R23 — Mobile e animação

- Ajustar detalhes de 360, 390, 430 e 768 px, toque, barras seguras, sheets e rolagem.
- Aplicar Motion for React **após** verificar compatibilidade/impacto no bundle; GSAP já está no projeto e deve ficar para efeitos especiais.
- Usar `prefers-reduced-motion`, animações curtas e evitar movimentos nas tabelas críticas.
- Testar layouts em diferentes perfis com dados sintéticos.

## R24 — Homologação da experiência

- Testes E2E autenticados e acessibilidade por perfil, navegação reversível, formulário rápido e validação em telefone.
- TypeScript, lint e build Next.js integral.
- Regressão dos fluxos de banco/transações de R01–R19 e publicar **apenas após aprovação de homologação**.

## Critérios comuns

1. Função avançada não pode desaparecer: mover para `Mais`/Ferramentas, mantendo rota e autorização.
2. Sempre destacar o que o usuário **pode** fazer no papel ativo, não o que não possui permissão.
3. Não acrescentar componentes prontos genéricos sem identidade DropZone.
4. Para mobile, redesenhar hierarquia e interação; não apenas reduzir tamanhos do desktop.
5. Criar pacotes completos acumulados e patch isolado por rodada, com testes e limites explicitados.
