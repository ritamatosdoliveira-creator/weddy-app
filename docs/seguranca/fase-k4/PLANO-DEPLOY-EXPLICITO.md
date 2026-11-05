# Plano de deploy EXPLÍCITO (preparado, NÃO executado)

Nada aqui foi executado. Os comandos são gerados por `node scripts/deploy-preflight.js` (que só os **imprime**) a partir de `scripts/deploy-plan.json`, e validados por `tests/k4/deploy-plan.test.js`. Quem os corre é a proprietária, um lote de cada vez, **primeiro em staging**.
Complementa `../PLANO-PUBLICACAO.md` e `../PROCEDIMENTO-PUBLICACAO.md` (que **discordam** entre si na ordem das regras; a ordem correta é a da secção 3).

## 1. Garantia contra apagar funções
- `index.js` exporta **45** funções; **32** existem em produção (código recuperado de 2026-10-30) e **13** são novas. **Nenhuma** função de produção desaparece do código local.
- **Nunca** usar `firebase deploy` sem `--only`, nem `--only functions` sem nomes, nem `--force`: a CLI pede para apagar as funções que não estão no código; com nomes explícitos isso não acontece.
- `validateWeddingStateOnWrite` fica **excluída** de propósito (custo por escrita; `STATE_VALIDATE_MODE=off`).
- O pré-verificador falha se: uma função exportada não está num lote nem justificada; um lote cita uma função que não existe; uma função está em dois lotes; `googleCalendarOAuthCallback` e `googleCalendarFinalizeOAuth` ficam em lotes diferentes.
- Antes de qualquer deploy em produção: `firebase functions:list --project weddy-app-bd12f` e comparar com as 45 (uma auditoria anterior citava só 5 funções "oficiais" — por confirmar).

## 2. Pré-requisitos (todos antes de qualquer deploy)
1. Autorização explícita para o **commit** local (nada foi commitado) e `cd tests && npm test` completo e verde.
2. **Exportar as regras implantadas** (Firestore e Storage) para fora do repositório (`firestore.rules.prod`, `storage.rules.prod`). Não existem no repositório; `origin/main` é só a "produção documentada" e **não está provado** que seja o que está implantado.
3. `node scripts/auditar-dados-para-regras.js` em modo só de leitura: `jsonNaoTexto = 0` e `jsonGrande = 0` (as regras novas rejeitam gravações do casamento com `json` inválido).
4. `scripts/backfill-premium-until.js` em **dry-run**; rever à mão os casamentos `active=true` sem `startedAt` e os sem prova de pagamento (não alterar sem decisão).
5. Segredos (só nomes; valores nunca em chat nem em ficheiros): OPENAI_API_KEY (**novo como segredo**; retirar do `.env.weddy-app-bd12f`), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, REVENUECAT_WEBHOOK_AUTH, SMTP_USER, SMTP_PASS, GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_TOKEN_ENCRYPTION_KEY, APPLE_SIGNIN_PRIVATE_KEY, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN. Parâmetros sem valor por omissão: SMTP_HOST, SMTP_FROM. Confirmar `GOOGLE_CALENDAR_REDIRECT_URI` (o valor por omissão aponta para o projeto de **teste**), `STRIPE_REFUND_POLICY=record_only`, `WHATSAPP_API_ENABLED=false`, `NOTIFY_EMAIL_ENABLED=false`, `STATE_VALIDATE_MODE=off`.
6. Deploy **só a partir da raiz deste ramo** (o `functions.ignore` do `firebase.json` só aí protege `.env`, scripts e `*.bak`); `package-lock.json` na raiz **ainda não existe** (build não reprodutível: gerar e versionar antes do deploy).
7. Pages: passar a origem do GitHub Pages para "GitHub Actions" **antes** de qualquer merge que traga `docs/`, `tests/`, `scripts/` ou `recuperado-producao/` para o ramo publicado (secção 6).
8. Eventarc/Storage/Scheduler: confirmar a localização do Firestore e do bucket (compatível com `europe-west1`) e os papéis dos agentes de serviço (Eventarc, Pub/Sub, Storage→Firestore para as regras).

## 3. Ordem de deploy (reconcilia os três documentos anteriores)
Depende do que as regras novas fazem ao cliente antigo e do que o cliente novo exige das regras (ver `REVISAO-REGRAS-COMPATIBILIDADE.md`):
1. **Staging completo** (secção 5) com a mesma ordem.
2. **Functions** lotes 1 → 2 → 3 → 4 (os callables `getGuestWhatsappConsent`/`setGuestWhatsappConsent` têm de existir antes do `rsvp.html` novo; lote 3 fora das 09:00 de Lisboa).
3. **Regras Firestore** — antes do cliente novo: o `rsvp.html` novo envia `logistics`, que as regras antigas recusam. É compatível com o `rsvp.html`/`memorias.html` antigos.
4. **Cliente (GitHub Pages por allowlist)** com `CACHE_NAME` novo (`weddy-v326-k4`; mudar em cada deploy de cliente).
5. **Regras Storage** — depois do cliente (evita registos de documentos sem ficheiro e mensagens enganadoras no cliente antigo).
6. **Functions lote 5 (quota K.4)** — só depois de validadas em staging.
7. Verificar (secção 4) e monitorizar 24–48 h.
Observação: o PWA antigo em cache só atualiza quando a pessoa toca em "Atualizar agora"; **cancelar a subscrição no PWA antigo falha** com as regras novas (falha segura, sem corromper nada) — decisão da proprietária.

### Comandos — staging (`weddy-premium-teste`; confirmar primeiro que é mesmo staging)
```
# lote 1-ia-contacto
firebase deploy --only functions:classifyWeddyIntent,functions:generateSeatingProposal,functions:analyzeCompareProposal,functions:generateCompareReport,functions:sendContactMessage --project weddy-premium-teste
# lote 2-apoio-calendario-site-whatsapp-eliminacao
firebase deploy --only functions:googleCalendarStartOAuth,functions:googleCalendarOAuthCallback,functions:googleCalendarFinalizeOAuth,functions:googleCalendarListCalendars,functions:googleCalendarConnectCalendar,functions:googleCalendarSync,functions:googleCalendarListEvents,functions:googleCalendarCreateEvent,functions:googleCalendarDeleteEvent,functions:googleCalendarDisconnect,functions:getGuestWhatsappConsent,functions:setGuestWhatsappConsent,functions:getWhatsappApiStatus,functions:updateGuestPhone,functions:whatsappWebhook,functions:sendWhatsappRsvpReminder,functions:saveWeddingSiteDraft,functions:checkWeddingSiteSlug,functions:publishWeddingSite,functions:unpublishWeddingSite,functions:refreshWeddingSite,functions:reactivateWeddingSite,functions:syncWeddingSiteLifecycle,functions:deleteWeddingAccount,functions:migrateFamilyGuestIds,functions:migrateMemoriesGuestId,functions:revokeDownloadTokensOnOwnerRemoval --project weddy-premium-teste
# lote 3-lembretes-e-resumos
firebase deploy --only functions:sendRsvpReminders,functions:cleanupActivityLog,functions:sendCoupleEmailDigest,functions:unsubscribeNotify --project weddy-premium-teste
# lote 4-pagamentos
firebase deploy --only functions:createSubscriptionCheckout,functions:stripeWebhook,functions:revenueCatWebhook --project weddy-premium-teste
# lote 5-quota-fotos-k4
firebase deploy --only functions:memoryQuotaOnDocCreated,functions:memoryQuotaOnObjectFinalized,functions:memoryQuotaOnDocDeleted,functions:memoryQuotaOnObjectDeleted,functions:memoryQuotaReconcile --project weddy-premium-teste
firebase deploy --only firestore:rules --project weddy-premium-teste
firebase deploy --only storage --project weddy-premium-teste
```
### Comandos — produção (`weddy-app-bd12f`) — só com autorização explícita
```
# lote 1-ia-contacto
firebase deploy --only functions:classifyWeddyIntent,functions:generateSeatingProposal,functions:analyzeCompareProposal,functions:generateCompareReport,functions:sendContactMessage --project weddy-app-bd12f
# lote 2-apoio-calendario-site-whatsapp-eliminacao
firebase deploy --only functions:googleCalendarStartOAuth,functions:googleCalendarOAuthCallback,functions:googleCalendarFinalizeOAuth,functions:googleCalendarListCalendars,functions:googleCalendarConnectCalendar,functions:googleCalendarSync,functions:googleCalendarListEvents,functions:googleCalendarCreateEvent,functions:googleCalendarDeleteEvent,functions:googleCalendarDisconnect,functions:getGuestWhatsappConsent,functions:setGuestWhatsappConsent,functions:getWhatsappApiStatus,functions:updateGuestPhone,functions:whatsappWebhook,functions:sendWhatsappRsvpReminder,functions:saveWeddingSiteDraft,functions:checkWeddingSiteSlug,functions:publishWeddingSite,functions:unpublishWeddingSite,functions:refreshWeddingSite,functions:reactivateWeddingSite,functions:syncWeddingSiteLifecycle,functions:deleteWeddingAccount,functions:migrateFamilyGuestIds,functions:migrateMemoriesGuestId,functions:revokeDownloadTokensOnOwnerRemoval --project weddy-app-bd12f
# lote 3-lembretes-e-resumos
firebase deploy --only functions:sendRsvpReminders,functions:cleanupActivityLog,functions:sendCoupleEmailDigest,functions:unsubscribeNotify --project weddy-app-bd12f
# lote 4-pagamentos
firebase deploy --only functions:createSubscriptionCheckout,functions:stripeWebhook,functions:revenueCatWebhook --project weddy-app-bd12f
# lote 5-quota-fotos-k4
firebase deploy --only functions:memoryQuotaOnDocCreated,functions:memoryQuotaOnObjectFinalized,functions:memoryQuotaOnDocDeleted,functions:memoryQuotaOnObjectDeleted,functions:memoryQuotaReconcile --project weddy-app-bd12f
firebase deploy --only firestore:rules --project weddy-app-bd12f
firebase deploy --only storage --project weddy-app-bd12f
```
(A ordem real é a da secção 3: lotes 1–4, regras Firestore, cliente, regras Storage, lote 5.)

## 4. Verificação depois de cada passo
Logs sem erros novos durante 30 min; registo → casamento → convidado → RSVP (com logística); upload de foto de convidado (aceite, recusa por limite, sem Premium); apagar uma foto; eliminação de conta de teste; checkout **em modo de teste**; webhook com falha simulada deve devolver 5xx e o retry deve ativar; `_incident_log`, `memoryQuotaCleanupQueue`, `memoryQuotaPending` e `memoryQuotaOrphans` com `giveUp:true`; custos.

## 5. Staging (condições)
Antes de qualquer operação: confirmar o ID do projeto e que é de testes; listar serviços (Firestore, Storage, Eventarc, Functions, Scheduler, Secret Manager), recursos criados (as funções do plano), custos potenciais (invocações, Cloud Build, Scheduler horário) e dados (apenas sintéticos); definir a limpeza (apagar casamentos/objetos de teste, repor regras). Validar: Storage real (upload, metadata, delete, falhas); Eventarc (duplicação, atraso, ordem); Scheduler (execução, recuperação, `memoryQuotaReconcile`); transações/contenção do contador com 50/100/200 convidados; TTL de `expireAt`; regras implantadas; permissão Storage→Firestore; webhooks com eventos de teste (Stripe em modo de teste; RevenueCat sandbox). **Nada disto foi executado.**

## 6. GitHub Pages — publicação por allowlist
`scripts/build-public.js` constrói `_site/` só com 78 ficheiros explícitos; `tests/k4/public-artifact.test.js` falha se entrar algo privado, se aparecer um ficheiro novo na raiz sem classificação ou se uma página pública referir um ficheiro que não está no artefacto. `.github/workflows/pages.yml` é uma **proposta local** (não ativa) que constrói, verifica e publica só `_site/` — passos da proprietária: definições do repositório → Pages → origem "GitHub Actions". Até lá, **não fazer merge** das pastas privadas para o ramo publicado. `promo-video.html` (ferramenta interna, não referenciada) está na allowlist por não mudar o comportamento atual — retirar se for para ficar privada.

## 7. Rollback
- **Functions:** `gcloud run services update-traffic <nome-em-minúsculas> --to-revisions=<revisão-anterior>=100 --region europe-west1 --project weddy-app-bd12f` (anotar as revisões antes do deploy). Funções **novas**: apagar só se necessário e uma a uma; a quota K.4 são **5** funções (não 4): `memoryQuotaOnDocCreated`, `memoryQuotaOnObjectFinalized`, `memoryQuotaOnDocDeleted`, `memoryQuotaOnObjectDeleted`, `memoryQuotaReconcile`.
- **Regras:** repor `firestore.rules.prod` / `storage.rules.prod` (as exportadas no passo 2.2) com `firebase deploy --only firestore:rules` / `--only storage`.
- **Cliente:** reverter o commit publicado (ou o artefacto anterior) e subir o `CACHE_NAME`.
- **Stripe/RevenueCat:** nenhuma configuração, preço, produto ou política é alterada neste plano; um webhook que devolva 5xx é repetido pelo fornecedor.
- **Dados:** nenhuma migração de dados foi criada; o backfill de `premiumUntil` só corre com decisão e cópia de segurança.
