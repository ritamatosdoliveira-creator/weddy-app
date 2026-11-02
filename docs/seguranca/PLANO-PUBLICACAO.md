# Plano de publicação (preparado, NÃO executado)

Nada daqui foi executado. Cada etapa só corre com a tua autorização explícita. Projeto de destino em todas: **`weddy-app-bd12f`** (produção); o ensaio em `weddy-premium-teste` usa os mesmos comandos com `--project weddy-premium-teste`. `.firebaserc` não tem projeto por defeito: **sem `--project` o comando falha**, por segurança. Nunca usar `firebase deploy` sem `--only`.

## Ordem recomendada e porquê
0. Pré-requisitos → 1. Segredos → 2. Functions (2a e 2b) → 3. **Site (GitHub Pages)** → 4. Firestore Rules → 5. Storage Rules.
O site vai **antes** das regras (diferente da ordem em que me pediste as secções) porque a versão antiga do PWA cancela a subscrição escrevendo o mapa inteiro e as regras novas só aceitam campos pontilhados; com o site já publicado, quem recarregar fica compatível. As functions vão antes do site porque o `rsvp.html` novo chama `getGuestWhatsappConsent`/`setGuestWhatsappConsent`.

## 0. Pré-requisitos (todos antes de qualquer deploy)
- [ ] Zips de `sendRsvpReminders` e `whatsappWebhook` recuperados e comparados (`COMPARACAO-RSVP-WEBHOOK.md`).
- [ ] Decisões tuas: Memories/Documentos exigem Premium (regras 4–6); STOP revoga o consentimento no servidor (já em `index.js`); alinhamento do `sendRsvpReminders` com o Autopilot (ver `RSVP-AUTOPILOT-SERVIDOR-DESENHO.md`); custo do gatilho `validateWeddingStateOnWrite` (fica **fora** deste plano até confirmares).
- [ ] Regras de produção exportadas (`AUDITORIA-REGRAS.md`) e guardadas como `firestore.rules.prod` / `storage.rules.prod` **fora** do repositório.
- [ ] `scripts/auditar-dados-para-regras.js` corrido: `jsonNaoTexto = 0` e `jsonGrande = 0`.
- [ ] Branch `v325-import-guests` com working tree limpa, `npm test` 100 % verde (`cd tests && npm test`).
- [ ] No computador do deploy: `git checkout v325-import-guests && npm install` (na raiz) e Node 22 (`node -v`).
- [ ] Cópia de segurança do estado atual das functions: `gcloud run services list --project weddy-app-bd12f --region europe-west1 --format="value(metadata.name,status.latestReadyRevisionName)" > ~/revisoes-antes.txt`.
- [ ] Avisar utilizadores/janela com pouco tráfego (não às 09:00 Lisboa, hora do `sendRsvpReminders`).

## 1. Segredos
- **Ficheiros:** nenhum do repositório (o valor é pedido no terminal). Retirar `OPENAI_API_KEY=` do `.env.weddy-app-bd12f`.
- **Comandos:** os da secção 4.1 de `COMPARADOR-SECRETS-E-PACKAGING.md` (`firebase functions:secrets:set OPENAI_API_KEY --project weddy-app-bd12f`, etc.). Rotação dos restantes: ver `SEGREDOS-INVENTARIO.md`.
- **Antes:** a chave nova criada na OpenAI. **Depois:** `gcloud secrets versions list OPENAI_API_KEY --project weddy-app-bd12f` (versão `enabled`).
- **Sucesso:** segredo existe e tem versão ativa; `grep -c '^OPENAI_API_KEY=' .env.weddy-app-bd12f` = 0.
- **Rollback:** desativar a versão nova (`gcloud secrets versions disable <n> --secret OPENAI_API_KEY --project weddy-app-bd12f`) e criar outra; uma chave revogada na OpenAI **não** se restaura (cria-se nova).

## 2a. Cloud Functions — lote 1 (IA + contacto; sem efeitos noutras áreas)
- **Ficheiros:** `index.js`, `package.json`, `firebase.json`.
- **Funções (5):** `classifyWeddyIntent`, `generateSeatingProposal`, `analyzeCompareProposal`, `generateCompareReport` (passam a ler o segredo) e `sendContactMessage` (limites anti-abuso).
- **Comando:**
  `firebase deploy --only functions:classifyWeddyIntent,functions:generateSeatingProposal,functions:analyzeCompareProposal,functions:generateCompareReport,functions:sendContactMessage --project weddy-app-bd12f`
- **Antes (local):** `cd tests && npm test -- --only compare,contact,packaging`.
- **Depois (prod):** os 4 `gcloud functions describe … serviceConfig.secretEnvironmentVariables` (secção 4.1-5 do doc de segredos); análise e relatório de teste na app; envio do formulário de contactos (chega a `geral@weddy.pt`); `gcloud functions logs read sendContactMessage --gen2 --region europe-west1 --project weddy-app-bd12f --limit 20` sem erros.
- **Sucesso:** 5 funções com revisão nova “Ready”; IA responde; formulário funciona; nenhum 5xx novo em 30 minutos.
- **Rollback (imediato, sem rebuild):** `gcloud run revisions list --service=<nome-em-minúsculas> --region europe-west1 --project weddy-app-bd12f` e `gcloud run services update-traffic <nome-em-minúsculas> --to-revisions=<revisao-anterior>=100 --region europe-west1 --project weddy-app-bd12f` (revisão anterior em `~/revisoes-antes.txt`).

## 2b. Cloud Functions — lote 2 (consentimento WhatsApp, Premium, resumo por email) — só com autorização
- **Funções (11):** novas `getGuestWhatsappConsent`, `setGuestWhatsappConsent`, `sendCoupleEmailDigest` (desligada: `NOTIFY_EMAIL_ENABLED=false` por defeito), `unsubscribeNotify`; alteradas `updateGuestPhone`, `whatsappWebhook` (STOP revoga o consentimento no servidor), `sendWhatsappRsvpReminder`, `stripeWebhook`, `revenueCatWebhook` (gravam `premiumUntil`), `deleteWeddingAccount`, `googleCalendarOAuthCallback` (URL base).
- **Comando:** `firebase deploy --only functions:getGuestWhatsappConsent,functions:setGuestWhatsappConsent,functions:sendCoupleEmailDigest,functions:unsubscribeNotify,functions:updateGuestPhone,functions:whatsappWebhook,functions:sendWhatsappRsvpReminder,functions:stripeWebhook,functions:revenueCatWebhook,functions:deleteWeddingAccount,functions:googleCalendarOAuthCallback --project weddy-app-bd12f`
- **Fora deste lote (de propósito):** `validateWeddingStateOnWrite` (custo por escrita; `STATE_VALIDATE_MODE` fica `off`), `sendRsvpReminders` (aguarda zips + autorização).
- **Antes (local):** `cd tests && npm test` completo.
- **Depois:** página RSVP de um convite de teste mostra o consentimento (sem texto de confirmação automática); GET ao webhook com token errado → 403; compra de teste/webhook de teste só em modo teste do Stripe; `gcloud functions logs read` sem erros.
- **Sucesso:** 11 revisões “Ready”, sem erros nos logs, compra/renovação Stripe de teste grava `subscription.premiumUntil`.
- **Rollback:** igual a 2a, função a função (ou todas).

## 3. Site (GitHub Pages)
- **Ficheiros:** `app/index.html`, `app/sw.js` (cache `weddy-v325-comparador`), `rsvp.html`.
- **Comandos (só tu):** abrir um *pull request* `v325-import-guests → main` no GitHub, rever o diff, aguardar o fim dos testes locais, *merge* e esperar o *build* do Pages (1–2 min). Nada disto foi feito.
- **Antes:** `cd tests && npm test -- --only ui,i18n` (verde) e abrir `app/index.html` local em PT/EN.
- **Depois:** em janela anónima, `https://www.weddy.pt/app/` carrega; `sw.js` mostra `weddy-v325-comparador`; criar convite de teste e testar o RSVP e o consentimento; instalar o PWA e confirmar que recarrega para a versão nova.
- **Sucesso:** sem erros de consola; utilizadores com PWA antigo recebem o aviso de atualização.
- **Rollback:** *revert* do commit de merge no GitHub (repõe os ficheiros) **e** subir a versão da cache em `app/sw.js` (ex. `weddy-v326-…`) para os clientes largarem a cache da versão com problema (ver `RECUPERACAO.md`).

## 4. Firestore Rules
- **Ficheiro:** `firestore.rules`. **Projeto:** `weddy-app-bd12f`.
- **Comando:** `firebase deploy --only firestore:rules --project weddy-app-bd12f`
- **Antes:** `AUDITORIA-REGRAS.md` lida e decisões 4–6 tomadas; `npm test -- --only rules` verde; regras de produção guardadas.
- **Depois:** (a) o casal abre o casamento, edita, guarda; (b) cancelar subscrição na versão nova; (c) o guest abre o RSVP e responde; (d) Memories com casamento Premium e sem Premium (esperado: o segundo recusa); (e) logs do Firestore sem pico de `PERMISSION_DENIED` (Console → Firestore → Uso).
- **Sucesso:** (a)–(d) como esperado; sem aumento de `PERMISSION_DENIED` em casais Premium.
- **Rollback:** repor o ficheiro exportado: copiar `firestore.rules.prod` para `firestore.rules` **fora** do repositório (ou numa cópia) e `firebase deploy --only firestore:rules --project weddy-app-bd12f`; as regras têm versões na Consola (Firestore → Regras → histórico), onde também se repõe com um clique.

## 5. Storage Rules
- **Ficheiro:** `storage.rules`.
- **Comando:** `firebase deploy --only storage --project weddy-app-bd12f`
- **Antes/depois:** como acima, mais carregar um documento em casamento Premium (esperado: aceita), em casamento gratuito (esperado: recusa; ler/apagar continuam), foto de Memories num casamento Premium.
- **Sucesso:** uploads Premium funcionam; leituras de ficheiros existentes funcionam.
- **Rollback:** `storage.rules.prod` + `firebase deploy --only storage --project weddy-app-bd12f`, ou histórico de regras na Consola (Storage → Regras).

## Janela e observação
Fazer 2a numa manhã de dia útil com pouco tráfego, observar 30 min, e só depois avançar. Cada etapa tem rollback independente; **não se avança** se o critério de sucesso da anterior não estiver cumprido. Não ativar `STATE_VALIDATE_MODE` nem `NOTIFY_EMAIL_ENABLED` neste plano.
