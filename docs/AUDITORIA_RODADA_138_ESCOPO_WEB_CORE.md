# Rodada 138 — Escopo Web Core e baseline Supabase

## Objetivo

Fixar a fronteira do produto DropZone Web antes das próximas rodadas de UX e banco.

O Web é a plataforma responsiva para desktop e celular de:

- competições e vagas;
- equipes, lines, staff e inscrições;
- jogadores e vínculos com equipes;
- agenda, resultados, ranking e estatísticas;
- pagamentos, carteira e operações comerciais ligadas às competições;
- gestão de campeonatos por produtoras/organizadores.

Captura de SPEC, HP, derrubado/morto, operação de OBS, overlays e processamento bruto ao vivo pertencem ao DPZ Live Engine local. O Web pode receber, persistir e exibir dados processados enviados pelo Engine.

## Ajustes desta rodada

1. A experiência normal do site passa a aceitar apenas os perfis `produtora`, `equipe`, `jogador` e `manager`.
2. `broadcast` continua reconhecido apenas como legado técnico para compatibilidade de dados existentes, mas deixa de ser opção de cadastro/navegação do produto Web.
3. O painel da produtora deixa de expor as abas técnicas de Stream e Exportação.
4. A criação de campeonato não oferece nem cobra Export/SPEC, Stream ou Broadcast como recursos do site.
5. O pontuador continua responsável por resultados, Match Result, presença, ranking e estatísticas, mas deixa de escolher jogo/queda “no ar” ou controlar overlays.
6. A Lili deixa de oferecer central de transmissão/OBS e passa a tratar a central competitiva como pontuação e resultados.
7. APIs de integração necessárias ao DPZ Live Engine/desktop foram preservadas. Não houve remoção destrutiva dos contratos de integração nesta rodada.

## Baseline Supabase conectado

Foi verificado o projeto DropZone no Supabase antes de qualquer mudança de schema.

- O projeto está saudável e a organização está no plano Pro.
- Não há branch de desenvolvimento configurada no momento.
- O frontend atual não usa `supabase.channel()` nem `postgres_changes`; portanto Realtime ainda não está implantado no Web.
- O acesso de dados do navegador continua passando pelas APIs do sistema; não foi encontrada consulta direta `supabase.from(...)` no frontend.
- O Advisor sinaliza proteção contra senhas vazadas desativada. Isso deve entrar na rodada de autenticação/segurança.
- O Advisor lista tabelas com RLS ativo e sem policy. Como a arquitetura atual usa backend/service role e não consulta essas tabelas diretamente do navegador, isso não deve ser “corrigido em massa”: RLS sem policy também funciona como deny-all para clientes comuns. Cada policy será criada apenas quando houver necessidade real de acesso direto/realtime.
- O Advisor também lista várias foreign keys sem índice. Não será criado índice em massa. As próximas rodadas devem medir os fluxos/qu queries mais usados e indexar os hot paths comprovados.

## Uso do Supabase Pro nas próximas rodadas

Prioridades propostas:

1. Realtime apenas para estados do produto que melhoram UX: notificações, convites, aprovação de inscrição, escalação, agenda e confirmação de pagamento.
2. Proteção de senha vazada e revisão de autenticação na rodada de Conta/Onboarding.
3. Branch de desenvolvimento antes de mudanças relevantes de schema, após confirmação explícita de custo quando aplicável.
4. Cron para lembretes e mudanças de status que realmente sejam automáticas e idempotentes.
5. Otimização de imagens do Storage quando entrarmos na rodada de performance mobile.

## Dependências externas / open source

Nenhuma dependência nova foi adicionada nesta rodada. Os problemas corrigidos eram de escopo e navegação e não justificavam aumentar o bundle.

Nas rodadas de formulários, tabelas e UX serão avaliadas soluções maduras antes de construir do zero. A adoção dependerá de licença, manutenção, tamanho, segurança e compatibilidade com Next.js/React/Supabase.

## Não remover ainda

Rotas e tabelas técnicas antigas de Stream/Broadcast podem continuar no código como compatibilidade temporária enquanto os contratos do Engine são auditados. Elas não devem reaparecer na experiência normal do usuário. A remoção física só deve ocorrer depois de confirmar que nenhuma versão em uso do Engine depende delas.

## Mapa rápido da superfície atual

A aplicação Web possui 42 rotas de página. A maior parte está dentro do produto definido: diretórios públicos, competição, equipe/jogador, agenda, compra, financeiro, convites e administração.

Rotas técnicas que não devem fazer parte da navegação principal:

- `/broadcast/control/[token]` — legado técnico;
- `/broadcast/obs/[token]` — legado técnico;
- `/campeonatos/[id]/stream` — hoje funciona como ponte/handoff para o Live Local;
- `/auth/mobile-callback` — compatibilidade de autenticação, não é área de produto.

A aplicação também possui 145 rotas de API. Famílias técnicas identificadas para auditoria de compatibilidade antes de eventual remoção física:

- `/api/broadcast/*`;
- `/api/campeonatos/[id]/pontuador/transmissao`;
- `/api/campeonatos/[id]/stream/catalog`, `key` e `pack`;
- `/api/stream/image`.

Contratos que devem continuar porque ligam o site ao Engine/desktop ou fornecem dados consolidados:

- `/api/desktop/auth/google/start`;
- `/api/desktop/campeonatos/[id]/baseline`;
- `/api/desktop/campeonatos/[id]/estatisticas`;
- `/api/desktop/campeonatos/[id]/partidas/[partidaId]/resultado`;
- `/api/stream/editor-data` enquanto houver consumidor PC2/editor;
- `/api/campeonatos/[id]/stream/data` enquanto houver consumidor de dados consolidados.

A regra para a próxima limpeza é simples: primeiro localizar consumidores reais no Engine/overlays; só depois apagar rotas técnicas antigas. Nesta rodada, elas foram retiradas da experiência principal sem quebrar contratos externos por suposição.
