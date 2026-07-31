# Rodada 85C — Integração operacional das estruturas avançadas

## Objetivo
Transformar séries e etapas configuradas na Rodada 85B em unidades operacionais com equipes reais, capacidade protegida e vínculo com fases/grupos existentes.

## Entregas
- Nova tabela `campeonato_etapa_equipes` para registrar equipe, etapa, origem e situação.
- Trigger que impede ultrapassar a capacidade e rejeita vínculos entre campeonatos diferentes.
- Distribuição manual de equipes/lines por etapa no painel.
- Origem operacional: venda direta, qualificatória, promoção, convite, manual ou outra etapa.
- Retirada sem apagar histórico.
- Vinculação das fases existentes às etapas avançadas.
- Vinculação dos horários independentes do Diário aos grupos existentes.
- Ocupação e vagas disponíveis por etapa na interface.

## Segurança
As escritas continuam exclusivas da API administrativa, após autorização de owner/manager. A tabela nova usa RLS sem acesso direto e está classificada como `service_role_only`.

## Banco
Executar `database/migrations/20260731_campeonatos_estruturas_avancadas_operacionais.sql` no Supabase antes da validação remota.
