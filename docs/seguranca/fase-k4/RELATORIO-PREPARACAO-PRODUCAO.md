# Preparação para produção — consolidação (2026-11-04/05)

**Estado do código:** ramo `v325-import-guests`, HEAD `04fefc7` + alterações K.4 e correções pós-auditoria **só na working tree (sem commit)**.
**Nada foi executado em staging nem em produção.** Todos os testes correram em emulador local (Firestore/Auth) com Storage, Stripe, SMTP e OpenAI simulados.
Auditoria do site publicado (`weddy.pt`): **não verificado ao vivo** (o URL não pôde ser lido por mim); só análise local do código.

## 1. Veredicto
**READY WITH CONDITIONS** — ver §7. Não há P0 confirmado, mas há condições que têm de estar cumpridas antes de publicar e validações críticas ainda não feitas em serviços reais.

## 2. Achados consolidados (seis auditorias independentes, só leitura)
Legenda: **corrigido** = alterado na working tree e testado; **decisão** = precisa da tua aprovação (toca em billing, regras ou dados); **externo** = depende de configuração/serviço real.

### P0
Nenhum confirmado.

### P1
| # | Área | Problema | Estado |
|---|---|---|---|
| 1 | Segurança | Email de lembrete de RSVP: o link (ID do convidado, escolhido pelo cliente) entrava em bruto no HTML → phishing com o remetente da Weddy (`index.js` `reminderEmailHtml`/`sendReminderEmail`) | **corrigido** (escape + `encodeURIComponent`; teste `k4-email-injection`). Reforço opcional nas regras (formato do ID de convidado) — **decisão**, pode afetar IDs existentes |
| 2 | Release/Website | O GitHub Pages serve a raiz do repositório (há `CNAME` e `.nojekyll`): um merge levaria `docs/`, `tests/`, `scripts/` e `recuperado-producao/` (incl. inventário de segredos, riscos abertos, código de produção) para público. `index.js` e as regras já estão públicos em `main` (sem segredos encontrados) | **decisão/condição**: não fazer merge dessas pastas para o ramo publicado, ou publicar o Pages por allowlist |
| 3 | K.4 | Itens de quota legados (K.3) sem dono: apagar a foto deixava o objeto e a quota (regressão face ao K.3) | **corrigido** (A2) + teste |
| 4 | K.4 | Marcador "casamento eliminado" gravado a meio: se a eliminação falhasse com o casamento vivo, a quota deixava de ser aplicada | **corrigido** (A1: o marcador é removido; verificação estática — a callable não é executável isolada) |
| 5 | Pagamentos | `stripeWebhook`/`revenueCatWebhook` respondem 200 quando a gravação da ativação falha → o cliente paga e não fica Premium, sem reentrega | **decisão** (altera comportamento de billing; correção mínima: responder 500 nesse ramo — a idempotência já existe) |
| 6 | Pagamentos | Ativação Stripe↔Apple substitui o mapa `subscription` inteiro; um REFUND Apple antigo pode desativar um Premium pago por Stripe | **decisão** (billing) |
| 7 | Pagamentos | Casamentos `active=true` sem `startedAt`/`premiumUntil` são Premium para sempre (servidor e regras); pode haver casos da falha de regras de Out 2026 | **externo**: correr `scripts/backfill-premium-until.js` em dry-run em produção e rever à mão |
| 8 | Pagamentos | Android usa Stripe Checkout dentro da app nativa (política da Google Play para bens digitais) | **decisão/jurídico** |
| 9 | Infra | `OPENAI_API_KEY` passa de variável (`.env`) a segredo; deploy falha se o segredo não existir ou se a variável continuar no `.env` | **condição** (procedimento em `PLANO-PUBLICACAO.md` §1) |
| 10 | Infra | Diretório de deploy: só a partir da raiz deste ramo (o `functions.ignore` só protege aí) | **condição** |
| 11 | Infra | Lotes do `PLANO-PUBLICACAO.md` incompletos (falta `googleCalendarFinalizeOAuth`, funções K.3/K.4, `getWhatsappApiStatus`…); cita `recordWhatsappOptOut`, que não é export | **corrigido em documentação**: lista única em §5 |
| 12 | Infra | Produção real por confirmar (a auditoria anterior cita só 5 funções listadas) → um `deploy --only functions` sem nomes pode pedir para apagar funções | **condição**: `firebase functions:list --project weddy-app-bd12f` e deploy sempre com `--only functions:<nomes>` |
| 13 | Infra | Primeiro deploy de triggers Eventarc (Storage/Firestore) em produção; localização do bucket/Firestore não documentada | **externo**: validar em staging primeiro |
| 14 | Funcional | Service worker: `CACHE_NAME` não mudava há ~58 commits → PWA instaladas ficam presas ao `index.html` antigo | **corrigido** (`weddy-v326-k4`); lembrar de o mudar em cada deploy de cliente |
| 15 | Funcional/Release | Cliente e Functions têm de sair juntos: funções K.4 sem o filtro `quotaState` na galeria mostram fotos "em falta" | **condição** (commit + publicar cliente antes/juntamente) |
| 16 | RGPD [J+T] | Política de privacidade promete mais do que o código faz (retenção, OpenAI recebe PDFs/imagens no Comparador, subcontratantes e categorias em falta); contradiz a política da app (WhatsApp/Meta, idade 16 vs 18) e tem a mesma data | **decisão jurídica** — texto e prazos são tuas/do jurista |
| 17 | RGPD [J+T] | "Co-dono" que é só um convite: se A elimina a conta, o casamento fica guardado sem dono ativo | **decisão** (altera regra de eliminação de dados) |
| 18 | Website/Legal [J] | Não existe página de Termos nem política de cookies no site; o texto dos termos da app fala em "subscrição" e "cancelar", o site/loja vendem pagamento único; faltam entidade/NIF/morada, Livro de Reclamações e RAL | **decisão jurídica** (pendência #1/#2/#12 já registada) |

### P2 (resumo; ver relatórios dos auditores)
Eliminação de conta sem autenticação recente; `feedback`/`snapshots` sem limites (custo); álbum público inundável por quem conhece o `weddingId` (App Check em monitor, sem rate limit); `rsvpReminderSends`, `whatsappConsentRateLimit`, `whatsappMessageStatus` fora do cascade de eliminação; eliminar convidado não limpa índices/consentimentos no servidor; co-dono removido deixa o email em mapas; TTL desligada (nenhum `expireAt` apaga nada); exportação de dados incompleta; prova de aceitação de termos por casamento e não por pessoa; leitura pública de `rsvp` familiar expõe respostas entre membros; reembolsos/disputas Stripe em `record_only` sem alerta (mantido, política decidida); backups/PITR não documentados; conta impossível de eliminar sem casamento; `robots.txt`/`sitemap.xml` inexistentes; `rsvp.html` sem noindex; importação de convidados bloqueia a linha inteira se o telefone for inválido e não tem testes; contratos de fornecedor/anexos guardam registo sem ficheiro se o upload falhar; objetos de fotos sem documento contam para a quota e nada os recolhe (R4 abaixo); agendadas sem `timeoutSeconds`; sem `package-lock.json` na raiz.
### P3
Ver relatórios (lang `pt-PT`, hero vídeo, `site-protect.js`, CVE de biblioteca Excel, segredos vazios nos webhooks, etc.).

### Cobertura das auditorias
A (K.4), B (segurança), C (RGPD), D (funcional), E (website — **só local**), F+G (infra e pagamentos). Áreas **não revistas em profundidade**: `demo-app.html`, prompts/pós-processamento OpenAI, motor de mesas, relatório do Comparador, XSS exaustivo nos campos de logística.

## 3. Correções efetuadas nesta sessão (local, sem commit)
| Correção | Ficheiro | Teste |
|---|---|---|
| A1 marcador de casamento eliminado revertido se a eliminação falhar | `index.js` | `k4-quota-integrity` A1 (estático) |
| A2 item sem dono: o servidor liberta ao apagar o único documento | `index.js` | A2a, A2b |
| A5 entrada de limpeza `owner_delete` só sai depois de a quota ser libertada | `index.js` | A5a, A5b |
| A6 teto de pendentes não conta entradas abandonadas | `index.js` | A6 |
| A7 cursor na reconciliação de pendentes (>100) | `index.js` | A7 |
| Injeção de HTML/link nos emails de lembrete | `index.js` | `k4-email-injection` (4) |
| `CACHE_NAME` do service worker | `app/sw.js` | — (verificação manual) |

Não corrigido por decisão (billing/regras/dados): ver P1 5, 6, 7, 16–18 e P2.
**Risco residual novo conhecido (R4/A3):** objetos de fotos sem documento (falha do cliente entre o upload e a criação do documento, ou upload direto ao QR público) contam para a quota, ficam invisíveis ao casal e nenhuma rotina os recolhe. Correção proposta (não aplicada): reconciliação que apaga objetos aceites sem dono e sem documento passado X tempo.

## 4. Código e Firebase — o que mudaria num deploy
**Código:** `index.js` (45 exports), `app/index.html` (filtro pendentes), `app/sw.js`; `firestore.rules` e `storage.rules` **não mudam na K.4** mas diferem de produção (ver `AUDITORIA-REGRAS.md`). Dependências: sem novas; `package.json` igual ao de produção (`firebase-admin ^12`, `firebase-functions ^5`, `stripe ^17`, `nodemailer ^6`, Node 22). **Sem `package-lock.json` na raiz** → build não reprodutível.
**Funções:** todas em `europe-west1`. 32 existem em produção (recuperadas), **13 são novas**: `googleCalendarFinalizeOAuth`, `getGuestWhatsappConsent`, `setGuestWhatsappConsent`, `getWhatsappApiStatus`, `sendCoupleEmailDigest`, `unsubscribeNotify`, `validateWeddingStateOnWrite`, `revokeDownloadTokensOnOwnerRemoval`, `memoryQuotaReconcile`, `memoryQuotaOnDocCreated`, `memoryQuotaOnObjectFinalized`, `memoryQuotaOnDocDeleted`, `memoryQuotaOnObjectDeleted`. Nenhuma função de produção desaparece no código local.
**Triggers/Scheduler:** Firestore (`weddings/{id}`, `memories/{id}`), Storage (Eventarc, bucket por omissão), 5 agendadas novas/existentes (`memoryQuotaReconcile` horária, `sendCoupleEmailDigest` 10:00, `syncWeddingSiteLifecycle` horária, `sendRsvpReminders` 09:00, `cleanupActivityLog` 04:00).
**Índices:** nenhum composto necessário (pendente: confirmar que não há isenções de índice simples em produção).
**Segredos (só nomes):** OPENAI_API_KEY (**novo como segredo**), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, REVENUECAT_WEBHOOK_AUTH, SMTP_USER, SMTP_PASS, GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_TOKEN_ENCRYPTION_KEY, APPLE_SIGNIN_PRIVATE_KEY, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN. Parâmetros não secretos sem valor por omissão: SMTP_HOST, SMTP_FROM; confirmar `GOOGLE_CALENDAR_REDIRECT_URI` (o default aponta para o projeto de teste), `STRIPE_REFUND_POLICY=record_only`, `STATE_VALIDATE_MODE`, `NOTIFY_EMAIL_ENABLED`, `WHATSAPP_API_ENABLED=false`.

## 5. Plano de passagem (NÃO executado) — ordem e dependências
Complementa `PLANO-PUBLICACAO.md`, `PROCEDIMENTO-PUBLICACAO.md` e `fase-k3/CHECKLIST-PUBLICACAO-CONTROLADA.md`. Projeto de produção: `weddy-app-bd12f`; teste: `weddy-premium-teste` (**confirmar que é de facto staging antes de o usar**).
1. **Congelar** alterações; rever o diff final (`git diff 04fefc7`); decidir os pontos "decisão" do §2.
2. **Commit local** (só com a tua autorização explícita; sem push) e `cd tests && npm test` completo; correr `npm install` na raiz e versionar `package-lock.json`.
3. **Staging real** (§6) — antes de produção, sobretudo triggers Eventarc/Storage.
4. **Backup/ponto de retorno:** exportar regras atuais (`firestore.rules.prod`, `storage.rules.prod` fora do repo); anotar revisões Cloud Run atuais; confirmar PITR/exports do Firestore; `scripts/backfill-premium-until.js` em dry-run.
5. **Confirmar produção:** `firebase functions:list --project weddy-app-bd12f` vs as 45 funções; `.env.weddy-app-bd12f` (valores de produção, sem `OPENAI_API_KEY=`); segredos existentes (só listar versões com `gcloud secrets versions list`; nunca ler valores).
6. **Segredos** → 7. **Functions por lotes, sempre com `--only functions:<nomes>`**, por esta ordem: (a) IA + contacto; (b) funções novas de apoio e as alteradas (incluir **juntas** `googleCalendarOAuthCallback` + `googleCalendarFinalizeOAuth`); (c) Stripe/RevenueCat/WhatsApp; (d) quota K.4 (5 funções `memoryQuota*`) **depois** da validação em staging.
8. **Cliente web (GitHub Pages)** com `CACHE_NAME` novo e **sem** `docs/`, `tests/`, `scripts/`, `recuperado-producao/`; só depois **regras Firestore → Storage** (a versão antiga do PWA cancela a subscrição com o mapa inteiro, que as regras novas recusam — o cliente tem de sair antes).
9. **Verificar:** logs sem erros novos 30 min; fluxo registo → casamento → convidado → RSVP; upload de foto de convidado (aceita, recusa por limite); eliminação de conta de teste; checkout em modo de teste; abrir o site e a app em telemóvel.
10. **Monitorizar** 24–48 h (erros de funções, `memoryQuotaCleanupQueue`/`Pending` com `giveUp:true`, custos).
**Rollback:** funções — `gcloud run services update-traffic` para a revisão anterior (sem rebuild); funções novas — apagar as **5** `memoryQuota*` (não 4) e as restantes novas só se necessário; regras — repor `*.prod`; cliente — reverter o commit do Pages e subir `CACHE_NAME`; Stripe/RevenueCat — nenhuma configuração alterada neste plano.

## 6. Validação em staging real (proposta; nada criado nem executado)
Antes de qualquer operação apresentar e obter aprovação para: **ID do projeto** (candidato `weddy-premium-teste`, ambiente "teste" segundo `.firebaserc` — a confirmar), **serviços** (Firestore, Storage, Eventarc, Cloud Functions, Cloud Scheduler, Secret Manager), **recursos criados** (as funções do §4 e 1 bucket já existente; documentos de teste), **custos** (invocações e tráfego mínimos; Scheduler horário; Cloud Build por deploy), **dados** (apenas sintéticos), **limpeza** (apagar casamentos/objetos de teste, remover funções de teste, repor regras).
Prioridades: (1) Storage real — upload, metadata, delete e falhas; (2) Eventarc — duplicação, atraso, ordem; (3) Scheduler — execução e recuperação; (4) transações Firestore e contenção; (5) TTL em `expireAt`; (6) regras implantadas; (7) uploads concorrentes com 50/100/200 convidados.
**Nada disto foi validado.** Se não houver staging, criá-lo é um passo teu (projeto novo + faturação).

## 7. Condições para avançar (READY WITH CONDITIONS)
1. Decidir e aplicar (ou aceitar por escrito) P1 5 e 6 (billing) — ou monitorizar ativamente `_incident_log` de webhooks enquanto não forem corrigidos.
2. Não publicar `docs/`, `tests/`, `scripts/`, `recuperado-producao/` no Pages.
3. Páginas legais coerentes (privacidade alinhada com a app, Termos publicados, entidade/NIF/morada, Livro de Reclamações, RAL) — validação jurídica tua.
4. Confirmar em produção: lista real de funções, segredos, `.env`, PITR, localização do bucket/Firestore; dry-run do backfill de Premium.
5. Validação dos triggers de quota K.4 em staging, ou adiar a publicação das 5 funções `memoryQuota*` (mantendo a quota K.3 atual) até ser validada.
6. Autorização explícita para o commit; deploy só a partir da raiz do ramo, com `--only functions:<nomes>`.
Se as condições 1–4 não puderem ser cumpridas hoje, o veredicto passa a **NOT READY** para o lançamento de hoje.
