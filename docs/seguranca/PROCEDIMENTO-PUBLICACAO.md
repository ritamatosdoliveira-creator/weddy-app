# Procedimento de publicação — A.3 (segurança) + consentimento WhatsApp + A.1/A.2

Estado: **runbook para o futuro**. Nada disto foi executado em produção. Só se executa depois de a Rita dizer "publica" e de cada passo ser confirmado por ela. Os passos de servidor (functions/rules) são sempre da Rita.

## 0. Pré-requisitos
- Branch `v325-import-guests` revista e aprovada; testes locais verdes (ver §7).
- Acesso `gcloud`/`firebase` da Rita ao projeto `weddy-app-bd12f`.
- Nenhum `firebase deploy` sem `--only`.

## 1. Ordem de publicação (importante)
1. **Backfill Premium** (dry-run → revisão → backup → apply) — **antes** das regras, para subscrições antigas não perderem acesso.
2. **Migração dos consentimentos** (dry-run → apply com backup) — opcional para segurança (o servidor já ignora o espelho antigo), útil para a UI.
3. **Functions**: `firebase deploy --only functions:getGuestWhatsappConsent,functions:setGuestWhatsappConsent,functions:updateGuestPhone,functions:recordWhatsappOptOut,functions:sendWhatsappRsvpReminder,...` (lista exata a confirmar com a diff final; incluir tudo o que mudou em `index.js`).
4. **Rules**: `firebase deploy --only firestore:rules,storage` (as regras novas exigem `premiumUntil` e `whatsappConsents`).
5. **App/hosting**: merge em `main` + push (publicação automática do site) — só após os passos 3–4, porque a app nova chama `getGuestWhatsappConsent`/`setGuestWhatsappConsent`.
6. Verificação pós-publicação (§5).

Razão da ordem: app nova sem functions → RSVP mostra erro no consentimento; regras sem backfill → contas Premium antigas ficam sem Memórias/Documentos.

## 2. Backfill de `subscription.premiumUntil`
Script: `scripts/backfill-premium-until.js` (testes: `tests/backfill`, 64).

1. **Dry-run** (não escreve):
   `node scripts/backfill-premium-until.js --project weddy-app-bd12f --report dry.json`
2. **Rever o relatório de impacto** (contagens por categoria: a atualizar, já corretos, sem `startedAt`, data inválida/futura, expirados, inativos). Sem emails nem nomes.
   - Contas **sem `startedAt` ficam intocadas** (listadas para decisão humana).
3. **Backup**: `gcloud firestore export gs://<bucket>/backup-pre-backfill-<data> --collection-ids=weddings --project weddy-app-bd12f`.
4. **Apply** (só aceita dry-run com menos de 24 h e resultado idêntico):
   `WEDDY_CONFIRM_PROD=sim node scripts/backfill-premium-until.js --project weddy-app-bd12f --apply --confirm-dry-run dry.json --backup backup-premiumUntil.json`
5. **Idempotência**: correr outra vez deve indicar 0 a atualizar.
6. **Rollback**: `... --rollback backup-premiumUntil.json` (só remove onde ainda é o valor escrito pelo script).

## 3. Migração dos consentimentos WhatsApp antigos
Script: `scripts/migrate-whatsapp-consents.js` (testes: `tests/consent/migrate-consents.test.js`, 24).

Regra: só se preserva consentimento com **prova do próprio convidado** (registo `whatsappConsents` `granted` com o mesmo número). Tudo o resto → `pendingRenewal`; STOP/opt-outs mantêm-se.
1. Dry-run: `node scripts/migrate-whatsapp-consents.js --project weddy-app-bd12f --report consent-dry.json`
2. Rever (quantos pendentes; sem telefones nem nomes no relatório).
3. Backup Firestore (igual a §2.3, se ainda não feito no mesmo dia).
4. Apply: `... --apply --backup consent-backup.json`
5. Rollback: `... --rollback consent-backup.json`

Efeito para os convidados: quem tinha a caixa marcada pelo casal passa a ver a caixa **desmarcada** no link do RSVP até confirmar. Os lembretes via Meta só saem com registo válido.

## 3b. Novidades de Nov 2026
Ver `docs/seguranca/A3bis-contacto-doubleoptin-resumo.md`: novas functions (`sendContactMessage`, `unsubscribeNotify`, `sendCoupleEmailDigest`), parâmetros `NOTIFY_EMAIL_ENABLED` (manter `false` no 1.º deploy) e `STATE_VALIDATE_MODE` (manter `off` no 1.º deploy; passar a `report` e só depois a `enforce`), `WHATSAPP_PUBLIC_NUMBER` é opcional (sem WhatsApp Business API), regras `notifState`/`weddingStateQuarantine`/guarda de `json`, e a function `validateWeddingStateOnWrite` (trigger Firestore em `weddings/{id}`: custo = 1 invocação por gravação do estado). O deploy de `sendContactMessage` **substitui** qualquer versão já existente com esse nome.

## 4. Avisos operacionais antes de publicar
- **Fotos de convidados (Memórias):** depois das regras A.3, convidados só carregam para casamentos com Premium ativo. Comunicar aos casais não-Premium (a funcionalidade já era Premium).
- **Texto de consentimento** (`WA_CONSENT_VERSION`): alterar o texto exige subir a versão; convidados com versão antiga veem o novo texto (`text_outdated`).
- **Política de privacidade** a atualizar: finalidade WhatsApp, prova de consentimento (data/hora/versão/hash), retirada a qualquer momento.
- **Comparador:** `generateCompareReport`, `analyzeCompareProposal` e `sendContactMessage` não estão no repositório; confirmar onde estão implantadas antes de publicar (ver `generateCompareReport-contrato.md`).
- **Cache do service worker:** `CACHE_NAME` sobe de versão no commit final para forçar atualização.

## 5. Verificação pós-publicação (checklist)
1. Casal Premium: abrir Memórias/Documentos e carregar um ficheiro de teste → permitido.
2. Casal sem Premium: carregar → recusado; ler os próprios ficheiros → permitido.
3. Link RSVP de teste: caixa WhatsApp desmarcada; marcar → "guardado"; recarregar → mantém-se; desmarcar → retirado.
4. Ficha do convidado na app: estado do consentimento só de leitura, a refletir o RSVP.
5. Lembrete WhatsApp de teste (conta de teste Meta): sem consentimento → não envia (`no_consent`).
6. Centro de notificações: abre, sem erros na consola.
7. Logs das Functions durante 24 h: sem erros novos.

## 6. Reversão
- Rules: `firebase deploy --only firestore:rules,storage` com o ficheiro anterior (`git show <commit-anterior>:firestore.rules`).
- Functions: redeploy da versão anterior (commit anterior).
- App: `git revert` do merge e push; subir `CACHE_NAME`.
- Dados: rollback dos scripts (§2.6, §3.5) ou restauro do export (`gcloud firestore import`).

## 7. Testes que têm de estar verdes antes
Um só comando, em `tests/` (emuladores locais, projeto `demo-weddy`, nunca produção):
```
cd tests && npm install && npx playwright install chromium && pip install playwright
npm test                          # todas as suites; relatório em tests/reports/last-run.md
node run-all.js --list            # ver as suites
node run-all.js --only rules,ui   # só alguns grupos ou suites
```
Detalhes e estrutura em `tests/README.md`.
