# Documento 1 — Auditoria técnica (Fase 0)

Data: 2026-11-17 · Branch: `feature/weddy-planning` (`44daf28` = `origin/main` `59a8399` + backend `30111d7`, integração aprovada a 16/11) · Só leitura: nada foi alterado na app, nas regras, nas funções ou no Firebase.

## 1. Pasta, Git e estado

| Item | Estado |
|---|---|
| Pasta de trabalho | `~/weddy-producao/planning` — worktree do repositório `weddy-app` (o mesmo de `web/` e `servidor/`). Movido de `~/weddy-planning` para dentro de `weddy-producao/` (regra 1.1). Não é uma cópia nem um segundo repositório |
| Base da branch | `integracao/app-servidor` (= `main` atual + backend). **Desvio consciente do ponto 1.2 ("a partir da main")**: o `main` não tem o backend (`index.js`, regras, testes), e sem ele a Planning não se pode construir nem testar. Contém o `origin/main` atual (verificado após `git fetch`; o `main` não avançou desde 59a8399) |
| Alterações locais | Nenhuma em `planning/`, `web/` (branch `fix-header-ios`) ou `servidor/` (só o `package-lock.json` não rastreado, que já existia) |
| Push / merge / deploy | Nenhum |

## 2. Estrutura do projeto

```
weddy-producao/
├── web/        worktree · site + app publicada (GitHub Pages, branch main)
├── servidor/   worktree · regras + Cloud Functions (branch feat/convites-envio-backend)
├── planning/   worktree · feature/weddy-planning (esta fase)
├── scripts/    publicar-regras.sh, publicar-funcoes.sh, estado.sh (só aceitam servidor/ + feat/convites-envio-backend)
├── ios-app/    invólucro Capacitor 8 (pt.weddy.ios): RevenueCat, Sign in with Apple; www/ é uma cópia antiga da app
├── copias-seguranca/, pacote-convites/, pre-visualizacao/   artefactos locais (não versionados)
```

Repositório (raiz = site público):

| Caminho | O que é |
|---|---|
| `index.html`, `site.html`, `sobre.html`, `contactos.html`, `suporte.html`, `privacidade.html`, `demonstracao.html`, `demo-app.html`, `promo-video.html`, `404.html` | Site institucional e demonstração |
| `app/index.html` (~33 000 linhas), `app/sw.js`, `app/manifest.json`, `app/invedit.js` | **Weddy Couples** (SPA única, PWA). `invedit.js` = editor de convites |
| `rsvp.html` | RSVP do convidado (token individual/família) |
| `memorias.html` | Upload de fotos dos convidados (Weddy Memories) |
| `convite.html`, `weddyinvite*.js`, `convites8/` | Convites digitais públicos (8 modelos) |
| `weddysite.js`, `/c/<slug>` via `404.html` | Wedding website público |
| `index.js` (~8 000 linhas), `package.json` | Cloud Functions v2 (Node 22), uma só codebase |
| `firestore.rules`, `storage.rules`, `firebase.json`, `.firebaserc` | Regras e configuração (`prod` = `weddy-app-bd12f`, `teste` = `weddy-premium-teste`) |
| `tests/` | 50 suites Node/emulador + 26 de interface (Playwright), `run-all.js` |
| `docs/` | Segurança, produto, design (`docs/design/DESIGN-SYSTEM.md`), integração |
| `scripts/` | `build-public.js` (allowlist do site), migrações e preflight |

## 3. Tecnologias

| Camada | Tecnologia |
|---|---|
| Cliente | HTML/CSS/JS sem framework nem build; Firebase JS SDK **10.12.2 compat** (app, auth, firestore, storage, functions, app-check) por CDN |
| Nativo | iOS: Capacitor 8 + RevenueCat + Sign in with Apple. Android: TWA (`.well-known/assetlinks.json`) |
| Servidor | Cloud Functions v2, `europe-west1`, Node 22; `firebase-admin` 12, `firebase-functions` 5, `nodemailer`, `stripe` |
| IA | OpenAI (Secret Manager `OPENAI_API_KEY`, `store:false`): Copilot (`classifyWeddyIntent`), Compare, AI Seating |
| Pagamentos | Stripe (web) e RevenueCat (Apple); Premium por casamento |
| Email | SMTP via nodemailer (contacto, convites, lembretes, resumo — este desligado por omissão) |
| WhatsApp | Meta Cloud API (desligada por omissão, `WHATSAPP_API_ENABLED=false`) + links manuais `wa.me` |
| Calendário | Google Calendar (OAuth no servidor) |
| Push (FCM) | **Não existe.** Só notificações locais (`registration.showNotification`) |
| App Check | Fase de medição (não aplicado: `enforceAppCheck` não é usado) |
| Publicação | Site: GitHub Pages (branch). Backend: scripts com confirmação `PUBLICAR` |

## 4. Firebase Authentication

- Métodos: **email + palavra-passe** (`createUserWithEmailAndPassword`, `sendEmailVerification`), **Google** e **Apple** (`signInWithCredential` no nativo).
- **Email verificado é obrigatório** em todas as regras de dados do casamento.
- Identidade nas regras = **email** (`request.auth.token.email in ownerEmails`) e, opcionalmente, `uid` (`ownerUids`).
- Sem custom claims, sem papéis. Um utilizador = conta Firebase; os casamentos encontram-se por `where('ownerEmails','array-contains', email)`; o casamento ativo fica em `userPrefs/{uid}.activeWeddingId`.

## 5. Modelo do casamento (o ponto mais importante)

Documento `weddings/{weddingId}`:

| Campo | Notas |
|---|---|
| `ownerEmails: string[]` | **Donos**. Leem e escrevem tudo. **Qualquer dono pode acrescentar ou remover emails** (`arrayUnion` em Definições → Convidar). Não há papéis |
| `ownerUids: string[]` | Opcional, alternativa ao email |
| `creatorEmail` | Protegido: não muda; o criador não pode ser removido por outro dono |
| `json: string` | **Todo o estado do casamento num único texto JSON** (≤ 900 000 caracteres nas regras) |
| `settings` | Definições (fundidas por chave) |
| `subscription` | Premium (`active`, `premiumUntil`); o cliente só pode desativar |

Chaves de topo do `json` (de `seedData()`): `budget, categories, guests, confirmed, expenses, seating, daySchedule, checklistDone, checklistPersonal, dressChecklistDone, dressVisits, dressStyle, cake, vows, stationery, stationeryCustom, stationeryHidden, stationeryDesign, favoriteVisitId, suppliers, todos, todoCategories, todoNotes, honeymoon, payments, weddingDocuments, compares` + chaves acrescentadas por módulos (convites, notificações, site, etc.).

Gravação: transação com **fusão a três vias por chave de topo** (`writeWeddingPayloadSafely` + `mergeIncomingWeddingState`): se outro dispositivo alterou o documento, as chaves que o cliente não mexeu ficam com o valor do servidor. Validação adicional no servidor (`validateWeddingStateOnWrite`) com quarentena.

Subcoleções: `snapshots` (cópias de segurança, donos), `activity` (registo de atividade), `integrations` (Google Calendar; escrita só servidor).

**Consequências para a Planning**
1. O planner **não pode** entrar por `ownerEmails` (teria acesso total e poderia remover o casal).
2. As regras não conseguem dar permissões por secção dentro do `json` (é um só campo). Permissões por secção têm de ser aplicadas no servidor.
3. Escritas do planner feitas no servidor por chave de topo são compatíveis com a fusão do cliente. Fica um risco: edição simultânea da **mesma** chave (ex.: `guests`), em que prevalece a do cliente que grava por último com a chave "suja".

## 6. Coleções Firestore (inventário)

Cliente + regras: `weddings` (+`snapshots`, `activity`, `integrations`), `guests/{token}` (RSVP), `memories`, `memoryQuota`, `feedback`, `creators/{uid}`, `userPrefs/{uid}`, `_incident_log`, `weddingSites`, `publicWeddingSites/{slug}`, `siteSlugs`, `publicInvitations/{slug}`, `weddingInvitations`, `invitationSlugs`, `whatsappConsents`, `invitationDeliveries`.

Só servidor (negação nas regras ou sem regra): `aiUsage`, `guestPhoneIndex`, `siteRateLimits`, `privateIntegrations`, `oauthStates`, `memoryQuotaPending/CleanupQueue/Orphans`, `stripePayments`, `stripeEvents`, `whatsapp*` (RateLimit, DailyUsage, MessageStatus, Inbox), `weddingStateQuarantine`, `notifState`, `invitationQuota`, `rsvpReminderSends`, `seatingRuns`, `downloadTokenRevocations`, `events`.

**Não existe** nenhuma coleção de organizações, membros, papéis, clientes, leads, propostas, contratos ou conversas.

## 7. Storage

`memories/{weddingId}/{token}/{file}` (convidados, Premium, sem substituição), `invitations/{weddingId}/{file}`, `sites/{weddingId}/{file}`, `public-sites/{slug}/{file}`, `documents/{weddingId}/{file}` (donos + Premium), `feedback/{weddingId}/{feedbackId}/{file}`.

## 8. Cloud Functions (53, `europe-west1`)

| Tipo | Funções |
|---|---|
| Callable (38) | Compare (2), Copilot, AI Seating, checkout Stripe, eliminação de conta, website (7), convites (6), WhatsApp (5), Google Calendar (9), migrações (2), `updateGuestPhone` |
| HTTP (6) | `stripeWebhook`, `revenueCatWebhook`, `whatsappWebhook`, `googleCalendarOAuthCallback`, `sendContactMessage`, `unsubscribeNotify` |
| Agendadas (6) | lembretes RSVP, email-resumo, ciclo de vida de convites e sites, reconciliação de quotas, limpeza de atividade |
| Triggers (7) | `validateWeddingStateOnWrite`, `revokeDownloadTokensOnOwnerRemoval`, quotas de Memories (5) |

Padrões reutilizáveis: verificação de dono (email verificado + `ownerEmails`) em todas as callables, Premium no servidor, quotas, rate limiting, idempotência de webhooks, registos de incidentes minimizados, email com anti-injeção.

## 9. Regras (síntese)

Negação por omissão nas coleções do servidor; dono = email verificado em `ownerEmails`; Premium (`premiumOn`) em Memories, Documentos e convites; RSVP com validação campo a campo; `weddings` não se apagam pelo cliente. Detalhe na auditoria de segurança da integração (`docs/integracao/B-auditoria-seguranca.md`).

**Lacuna relevante para a Planning:** a regra de `update` em `weddings` deixa qualquer dono alterar **qualquer** campo exceto `subscription` e `creatorEmail`. Um campo novo como `planningLink` tem de ficar protegido nas regras, senão o casal poderia forjar ou apagar a ligação.

## 10. Funcionalidades existentes (Weddy Couples)

Convidados (lados, categorias, famílias, crianças, staff, importação Excel/CSV, convite físico), RSVP individual e familiar com logística (transporte, alojamento, alimentação, acessibilidade), consentimento WhatsApp, Autopilot de lembretes, Mesas e AI Seating, Orçamento, Gastos, Pagamentos, Fornecedores, Weddy Compare (IA), To-do, Checklists, Programa do dia, Health, Vestido (visitas), Bolo, Papelaria, Votos, Lua-de-mel, Documentos, Memories, Wedding Website, Convites Digitais (8 modelos, publicação, envio por email/WhatsApp), Google Calendar, Copilot/Concierge, notificações in-app, PT/EN, Premium (Stripe/Apple).

## 11. Dependências

Cliente: Firebase 10.12.2 compat (CDN), `xlsx-js-style`, `jspdf` + `autotable`, `pdf.js` (CDN). Servidor: `firebase-admin ^12.1`, `firebase-functions ^5`, `nodemailer ^6.9`, `stripe ^17`. Testes: `firebase-tools ^13`, `playwright ^1.45`. iOS: Capacitor 8, RevenueCat 13, apple-sign-in 7.

## 12. Riscos identificados

| # | Risco | Gravidade |
|---|---|---|
| R1 | `app/index.html` monolítico (33 k linhas): qualquer alteração tem alto risco de regressão e de conflitos | Alta |
| R2 | Estado num único campo `json` (limite 900 KB): sem permissões por secção nas regras; casamentos grandes perto do limite | Alta |
| R3 | `ownerEmails` editável por qualquer dono: um modelo de papéis não pode assentar nele | Alta |
| R4 | GitHub Pages publica a raiz do `main`: merge da Planning exporia backend/docs (decisão pendente) | Alta |
| R5 | Sem FCM: notificações de mensagens (Conversations) exigem infraestrutura nova (web push + APNs) | Média |
| R6 | `index.js` monolítico (8 k linhas, um só pacote): funções da Planning devem ir para codebase própria | Média |
| R7 | Sem passo de build no site: uma app Planning modular exige decidir entre ES modules sem build ou build em GitHub Actions (ligado a R4) | Média |
| R8 | App Check não aplicado | Média |
| R9 | Edição simultânea da mesma chave do estado por planner e casal | Média |
| R10 | Scripts de publicação presos a `servidor/` + `feat/convites-envio-backend` | Informativo |
