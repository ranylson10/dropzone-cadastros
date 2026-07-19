# Pagamentos ASAAS + carteira interna

## Visão

| Peça | Função |
|------|--------|
| **ASAAS** | Gera link/fatura (PIX, boleto, cartão) |
| **Carteira** | Saldo interno por produtora / manager (vendedor) |
| **Ledger** | Extrato imutável de créditos/débitos |
| **Saque** | Usuário solicita PIX; admin marca pago/rejeita |

Sem `ASAAS_API_KEY` o sistema **continua normal** — só o botão de pagar retorna 503.

## Variáveis (Vercel)

```env
ASAAS_API_KEY=...          # token da conta ASAAS
ASAAS_ENV=sandbox          # ou production
ASAAS_WEBHOOK_TOKEN=...    # opcional, valida webhook
NEXT_PUBLIC_APP_URL=https://dropzone-cadastros.vercel.app
```

## SQL

```text
database/migrations/20260719_carteira_asaas.sql
Downloads/DOWNLOAD_carteira_asaas.sql
```

Rode **depois** do SQL de aprovação/preços.

## Fluxos

### 1) Produtora paga pacote do campeonato

1. Campeonato criado → `campeonato_cobranca` pendente + cotação  
2. Painel: **Pagar com ASAAS** → `POST /api/pagamentos/campeonato/[id]`  
3. Abre `invoiceUrl` do ASAAS  
4. Webhook `POST /api/webhooks/asaas` → marca cobranca `pago` + credita carteira **sistema**  
5. Admin ainda precisa **aprovar** o campeonato para ir ao ar (ou pode aprovar após pagamento)

### 2) Comissão do vendedor (preparado)

Quando houver pagamento de **inscrição de equipe** (`finalidade=inscricao_equipe`) com meta:

```json
{
  "campeonato_id": "...",
  "produtora_id": "...",
  "vendedor_manager_id": "...",
  "vendedor_auth_user_id": "..."
}
```

O split usa:

- `comissao_vendedor_bps` (default **1000 = 10%**)  
- `comissao_plataforma_bps` (default **500 = 5%**)  

Restante → carteira da **produtora**.  
Ajustável em Admin → Preços (chave `comissao_*_bps`, valor em basis points).

### 3) Saque

1. `GET /api/me/carteira` — saldo + extrato  
2. `POST /api/me/carteira/saque` — debita e cria solicitação  
3. Admin → **Saques** → Marcar pago (você transfere no banco/ASAAS) ou Rejeitar (estorna saldo)

## Webhook ASAAS

URL:

```text
https://dropzone-cadastros.vercel.app/api/webhooks/asaas
```

Eventos úteis: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, etc.

## Segurança

- Tabelas com RLS only **service_role**  
- Ledger com idempotência por `referencia_tipo + referencia_id + tipo`  
- Webhook reconsulta o pagamento na API ASAAS quando possível  
