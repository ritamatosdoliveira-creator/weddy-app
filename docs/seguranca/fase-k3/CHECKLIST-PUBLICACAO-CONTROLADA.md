# Checklist de publicação controlada (proposta — NADA publicado)

A publicação exige **autorização separada, expressa e específica** da Rita. Esta lista só prepara a proposta. Beta **não** está declarada pronta.

## A. Antes de qualquer publicação
- [ ] Validação externa no projeto de teste concluída (App Check monitor, TTL, rotação OpenAI, Storage real, Stripe modo teste) — hoje **nenhuma** executada.
- [x] Quotas **decididas**: 20 por convite / 500 QR público / 2.000 por casamento / 5 GB. Reembolsos: **review manual, `STRIPE_REFUND_POLICY=record_only`** (decidido).
- [ ] Decisão sobre retenção de registos financeiros (contabilista) e sobre eliminação de conta × `stripePayments`/`stripeEvents`.
- [ ] Backup/exportação do estado atual de produção (Rita).

## B. Ficheiros a publicar (ordem sugerida, tudo em teste primeiro)
1. `firestore.rules` (esquema `_incident_log`, `memoryQuota`, regra de álbum cheio) — **antes** da app nova para não recusar escritas; mas clientes antigos perdem telemetria de incidentes (aceitável).
2. `index.js` (functions): novas `getWhatsappApiStatus`, `revokeDownloadTokensOnOwnerRemoval`, `memoryQuotaOn*` (4), reembolsos Stripe, `WHATSAPP_API_ENABLED=false`, `STRIPE_REFUND_POLICY=record_only`.
3. `app/index.html` (helper WhatsApp, `incidentAdd`).
4. Stripe: ativar no webhook os eventos `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
5. TTL do `_incident_log.expireAt` só depois de aprovação jurídica.

## C. Validação em Stripe modo teste (Rita)
Chaves de **teste** no projeto de teste; checkout com cartão de teste `4242…` (documentação Stripe); reembolso total e parcial no painel (modo teste); conferir `stripePayments`, `stripeEvents` e que o Premium **não** muda com `record_only`. Repetir um evento (reenviar no painel) → sem duplicação.

## D. Reversão
Regras: republicar versão anterior (guardada no git). Functions: redeploy do commit `ea85a2e`. Parâmetros: remover/definir `false`. Triggers de quota: apagar as 4 funções não afeta fotos existentes.

## E. Não está autorizado até nova instrução
Deploy, push, merge, regras/secrets/TTL/flags/App Check em produção, WhatsApp em produção, migrações.
