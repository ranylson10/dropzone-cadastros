# Plano de correções do DropZone — 21/10/2026

## Regra de segurança
- Alterar apenas cópia dos arquivos até a revisão da entrega.
- Nenhuma migration, exclusão, permissão, dado de usuário ou transação financeira é aplicada no banco de produção sem backup, plano de reversão e ensaio em homologação.
- Garantir testes de regressão para rotas web, mobile, SPEC e inscrições.
- O projeto de produção consultado foi `DropZone`, Supabase. Os dados existentes de vagas/inscrições analisados estavam consistentes.

## R1 — APIs públicas e estabilidade — INICIADA E ENTREGUE LOCALMENTE
- R1.1 Impedir que o proxy público gere URL assinada com service_role caso o objeto/bucket não seja público. **Concluído.**
- R1.2 Reforçar a rota `/api/i18n/translate` com validação de origem, tamanho máximo de body no streaming, limite global por instância e limite de requisições simultâneas ao provedor. **Concluído como defesa em camadas, não como limite distribuído.**
- R1.3 Corrigir exemplo de JSON do SPEC e adicionar regressão local de geração. **Concluído.**
- R1.4 Teste automatizado local sem banco nem credenciais. **Passou.**
- R1.5 Rodar typecheck/lint/build completos em ambiente instalado e teste de CDN e Gemini real. **Pendente — falta instalação completa das dependências e configuração externa.**

## R2 — Inscrições, vagas e reinscrição — PRÓXIMA
- Preparar ambiente de homologação restaurado com cópia segura, sem utilizar registros reais de usuários em testes.
- Executar `docs/sql/20261011_enrollment_preflight_readonly.sql` e comparar com o banco-alvo.
- Ensaiar DBR01 (espelho slot / participação), DBR02 (índice histórico impedindo reinscrição), concorrência e rollback.
- Validar a implantação de `inscricao_recibos` e da função atômica. Conferir os contratos de rotas web/mobile e chaves de ativação.
- Testar dupla inscrição simultânea, timeout depois de consumo do token, cancelamento, troca de grupo, reabertura e idempotência.
- **Não executar scripts SQL candidatos diretamente em produção.** A ordem exata será definida após testes e snapshot.

## R3 — Banco, RLS e performance
- Classificar as 84 tabelas com RLS sem policy: intencionalmente privadas versus exposição Data API.
- Conferir 46 policies, privilégios por coluna, chamadas SECURITY DEFINER, views e Storage.
- Priorizar os 191 avisos de FK sem índice com base nas consultas reais. Evitar criar todos indiscriminadamente.
- Garantir backup e comparar migrations aplicadas com código local. Corrigir status somente com migrações testadas.

## R4 — Painéis e responsividade
- Auditoria visual dos cinco perfis e módulos: produtora, equipe, jogador, manager, admin.
- Tratar abas, cartões, tabelas, forms, modais, responsivo 2560x1080 e telas pequenas.
- Dividir componentes de milhares de linhas de forma incremental. Preservar seletores usados em testes e rotas.

## R5 — Integrações e lançamento
- Cenários com resultados MatchStats, ingestão do DPZ Live Engine, SPEC, editor Electron e overlays.
- Validação de links de inscrição, pagamentos/checkout, permissões reais de contas isoladas.
- Build web, testes Playwright desktop/mobile, teste em Android e empacotamento Windows.
- Nova auditoria de segurança, produção com monitoramento e rollback disponível.

## Execução desta entrega
- **Artefato:** cópia dos arquivos com a Rodada 01 incorporada; não é uma publicação em GitHub ou Vercel.
- **Banco Supabase real:** 0 migrations executadas; 0 registros alterados.
- **Verificado:** `npm run test:security:round1` passou.
- **Bloqueado neste ambiente:** conjunto completo de testes (`next/server` não instalado), Playwright, build e integração com serviços reais; outras suítes pedem `.env.local` e build.
- **Limitação:** limite global em memória vale por instância. Para bloquear múltiplas instâncias da Vercel e abuso distribuído, adicionar rate limiting compartilhado no WAF / Upstash Redis e quotas no provedor Gemini.
