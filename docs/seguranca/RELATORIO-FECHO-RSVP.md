# Weddy — Relatório de fecho: RSVP, consentimento e plano de publicação
Data: 02/11/2026 · Branch local `v325-import-guests` · **Nada foi publicado, enviado (push), fundido (merge) ou alterado em produção.**

## 1. Comparação dos zips de produção com o código local
- Os `index.js` de `sendRsvpReminders` e `whatsappWebhook` são o mesmo ficheiro (SHA-256 `4e5f5b56…8a15`, 228 855 bytes), idêntico ao de produção de 27/10.
- `sendRsvpReminders`: 21 unidades de que depende, **idênticas** a produção e ao código local.
- `whatsappWebhook`: handler idêntico. Diferenças locais (minhas, A.1–A.3): `recordWhatsappOptOut` (um STOP passa a revogar também `whatsappConsents`, em transação), `consentRevocationPatch`, `WHATSAPP_CONSENT_HISTORY_MAX`.
- A comparação indireta anterior estava correta.
- Facto novo: produção difere do `origin/main` em `APP_BASE_URL` (`/app/` vs `/index.html`) e no `sendContactMessage` (só em produção). Local já tem `/app/`. Publicar o `main` por cima desfaria ambos.
- Efeito de publicar o local: um STOP recebido revoga também o consentimento no servidor (mudança de comportamento desejada, mas só com a tua autorização).

## 2. RSVP Autopilot (`sendRsvpReminders`) — desenho, NÃO implementado
Situação atual (confirmada): email a 7/3/1 dias antes de `rsvpDeadline`; máximo fixo 3; só Premium; não lê `settings.rsvpAutopilot` (um casal que configure "máx. 2" continua a receber o 3.º); contadores atualizados depois do envio e sem transação (duplicação possível em execuções concorrentes).
Desenho (ver `RSVP-AUTOPILOT-SERVIDOR-DESENHO.md`): ler `rsvpAutopilot` com limites 2–30 dias (defeito 5) e 1–10 lembretes (defeito 3); excluir quem já respondeu; respeitar o limite do casal; reserva em transação com registo único por convidado e lembrete (`tx.create`), libertada se o SMTP falhar (no máximo uma vez); nenhum envio WhatsApp automático.
**Decisão tua:** casamentos sem definições mantêm 7/3/1 e máx. 3 (recomendado) ou passam a 5 dias / 3 lembretes?
Testes de emulador previstos: limites, defeitos, respondidos, limite do casal, legado, duas execuções simultâneas, falha SMTP, não-Premium.

## 3. Revogação por STOP — testes (`tests/consent/stop-revocation.test.js`)
Resultado: 35 OK, 0 FAIL, 10 lacunas conhecidas (não falham a suite).
Garantido: STOP revoga `granted` e `pending` no servidor com data e origem (`whatsapp_stop`); STOP repetido é idempotente; mudança de número revoga; `updateGuestPhone` ignora `optedIn:true`; sincronização/dados antigos não reativam; `sendWhatsappRsvpReminder` exige `granted`; um "SIM" não confirma consentimento (a função de confirmação não está ligada).
Lacunas (corrigir só depois da comparação e com autorização): mais variantes (Pare, pára, Cancel, QUIT, END, Remover, "não quero receber mais"); manter a primeira data `optedOutAt` no espelho JSON em STOP repetido; `whatsappInbox` guarda texto/raw/nome (reduzir ao mínimo); comentário obsoleto "DORMENTE".

## 4. Segredos potencialmente expostos (nada aberto, copiado, impresso ou testado; nada rodado)
Exposição **confirmada** só para `OPENAI_API_KEY` (variável com valor no `.env.weddy-app-bd12f`). Os restantes são `defineSecret` (Secret Manager, não vai no zip); sem evidência — a confirmar com comandos que só imprimem nomes.

| Segredo | Serviço / funções | Exposição | Rotação interrompe? |
|---|---|---|---|
| OPENAI_API_KEY | IA: classifyWeddyIntent, generateSeatingProposal, analyzeCompareProposal, generateCompareReport | **Sim** | Só a IA, se revogares antes do deploy; sem corte se criares a nova primeiro |
| SMTP_USER/PASS | sendRsvpReminders, sendContactMessage, sendCoupleEmailDigest, revenueCatWebhook | Sem evidência | Emails param se a antiga for invalidada antes do deploy |
| STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET | createSubscriptionCheckout, stripeWebhook | Sem evidência | Sem corte com a rolagem do Stripe |
| REVENUECAT_WEBHOOK_AUTH | revenueCatWebhook | Sem evidência | Janela curta (401 e repete) |
| GOOGLE_CALENDAR_CLIENT_ID/SECRET | 6 funções googleCalendar* | Sem evidência | Sem corte (2 segredos em simultâneo) |
| GOOGLE_TOKEN_ENCRYPTION_KEY | googleCalendar*, deleteWeddingAccount | Sem evidência | **Sim:** tokens guardados ficam ilegíveis; só com prova de exposição e plano de migração |
| APPLE_SIGNIN_PRIVATE_KEY | deleteWeddingAccount | Sem evidência | Só apagar conta Apple |
| WHATSAPP_VERIFY_TOKEN / APP_SECRET | whatsappWebhook | Sem evidência | APP_SECRET: 403 temporário, a Meta repete |
| WHATSAPP_ACCESS_TOKEN / PHONE_NUMBER_ID | sendWhatsappRsvpReminder | Sem evidência | Envio WhatsApp não ativo |

Ordem: 1) OpenAI; 2) verificar nomes no `.env` e padrões nos backups/scripts; 3) SMTP; 4) Stripe e RevenueCat (fora de horas de compra); 5) Google Calendar secret, WhatsApp, Apple; 6) GOOGLE_TOKEN_ENCRYPTION_KEY só com plano de migração. Depois, apagar zips locais com `.env`. Detalhe e comandos: `SEGREDOS-INVENTARIO.md`.

## 5. Auditoria Firestore e Storage
Não consegui ler as regras realmente implantadas (precisam do teu login); a base é o `origin/main`. Comandos de exportação em `AUDITORIA-REGRAS.md`.
1. `weddings` create/update: `json` tem de ser texto ≤ 900 000 caracteres. Risco baixo; se existir casamento com `json` nulo/não-texto, todas as escritas nele seriam negadas.
2. `subscription` pelo cliente: só pode desligar (`active`, `updatedAt`). PWA antigo em cache que cancela escrevendo o mapa inteiro falha até recarregar.
3. `integrations/*`: `write: false`. Risco nulo (cliente só lê).
4. `memories` (Firestore) e 5. Storage `memories`: criação exige Premium. **Decisão de produto:** casais gratuitos que usam Memories perdem o carregamento de fotos dos convidados.
6. Storage `documents`: criar/atualizar exige Premium; ler e apagar continuam permitidos. **Decisão de produto.**
7. Coleções novas só de servidor (`whatsappConsents`, `whatsappConsentRateLimit`, `notifState`, `weddingStateQuarantine`).
Dados antigos/nulos: sem `premiumUntil` vale `active`; `premiumUntil: null` explícito falha fechado (nega); sem `subscription` nega. Avisos do emulador nas linhas 55 e 70 de `storage.rules` são pré-existentes e desejados.
Antes de publicar: exportar regras de produção e correr `scripts/auditar-dados-para-regras.js` (só leitura; não corrido).

## 6. Plano de publicação e rollback (resumo; detalhe em `PLANO-PUBLICACAO.md`)
Projeto `weddy-app-bd12f`; sempre `--only` e `--project`; nunca `firebase deploy` global (`.firebaserc` não tem projeto por defeito).
Ordem: 1) Segredos → 2a) Functions lote 1 (IA + contacto: classifyWeddyIntent, generateSeatingProposal, analyzeCompareProposal, generateCompareReport, sendContactMessage) → 2b) lote 2 (getGuestWhatsappConsent, setGuestWhatsappConsent, sendCoupleEmailDigest [desligada], unsubscribeNotify, updateGuestPhone, whatsappWebhook, sendWhatsappRsvpReminder, stripeWebhook, revenueCatWebhook, deleteWeddingAccount, googleCalendarOAuthCallback) → 3) Site GitHub Pages (app/index.html, app/sw.js, rsvp.html; PR e merge só por ti) → 4) Firestore Rules → 5) Storage Rules.
Site antes das regras porque o PWA antigo cancela a subscrição de forma que as regras novas recusam.
Fora do plano: `validateWeddingStateOnWrite` (custo por escrita; `STATE_VALIDATE_MODE` fica off) e `sendRsvpReminders` (aguarda implementação e autorização).
Rollback: functions — repor o tráfego para a revisão anterior (`gcloud run services update-traffic … --to-revisions=<anterior>=100`); regras — redeploy do ficheiro exportado ou histórico na Consola; site — revert do commit e subir a versão da cache do `sw.js`; segredos — desativar a versão nova (uma chave revogada na OpenAI não se restaura, cria-se outra).

## 7. Suite completa
23 suites. Primeira execução 22/23: o teste "20 pedidos em paralelo → exatamente 8 passam" do formulário de contacto falhou uma vez sob carga. Isolado passou 3/3 e na segunda execução completa passou **23/23**. Causa não investigada (provável contenção de transações no emulador); a vigiar.

## 8. Ficheiros alterados e commits (todos locais)
Commits: `9c5faa5` (fecho RSVP/consentimento), `d926279`, `8d7e1bb`, `49d1dbb`, `d057353`, `93493fe`, `ff4d02a`, `0606434`, `1a2b68d`, `1d67f0b`, `8f3a059`, `e38061e`, `b1e0b4d`… sobre `origin/main` (`b9d2fd25`).
Novos nesta fase: `docs/seguranca/{SEGREDOS-INVENTARIO,AUDITORIA-REGRAS,PLANO-PUBLICACAO,RSVP-AUTOPILOT-SERVIDOR-DESENHO,RELATORIO-FECHO-RSVP}.md`, `scripts/auditar-dados-para-regras.js`, `tests/consent/stop-revocation.test.js`; alterado `tests/run-all.js` e `COMPARACAO-RSVP-WEBHOOK.md`. **Nenhuma função foi alterada nesta fase.**

## Pendente de ti
Decisão do calendário para casamentos sem definições; decisão Memories/Documentos Premium; autorização para implementar B e as correções de STOP; rotação da chave OpenAI; exportar regras de produção e correr a auditoria de dados; autorização explícita para qualquer publicação.
