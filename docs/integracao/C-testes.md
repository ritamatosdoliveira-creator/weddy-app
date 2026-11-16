# C — Testes da integração

Data: 2026-11-16 · Commit testado: `e9a5aae` (+ correção do teste `site`) · Runner: `tests/run-all.js` (procedimento do `tests/README.md`).

**Tudo local**: emuladores Firestore/Storage do projeto `demo-weddy` (portas 8085/9195), `GOOGLE_APPLICATION_CREDENTIALS` e `FIREBASE_TOKEN` removidos do ambiente, interface com Firebase simulado (sem rede). Sem dados reais, sem produção, sem OpenAI/Meta/SMTP reais.

## 1. Resultado global

| Grupo | Suites | Passaram | Notas |
|---|---|---|---|
| Servidor + regras (Node/emulador) | 50 | **50** | após correção de um teste intermitente (§3) |
| Interface (Playwright, 390/768/1360 px, PT/EN) | 26 | **24** | 2 falhas explicadas (§3), nenhuma regressão |
| **Total** | **76** | **74** | |

## 2. Detalhe

Servidor / regras — todas OK:
`i18n-parity`, `validate-state` (55), `consent` (70), `stop` (67), `rsvp-reminders` (66), `rsvp-reminders-logistics` (10), `migrate` (24), `privacy-static` (78), `privacy-deletion`, `hard-payments`, `hard-auth-matrix`, `hard-scale` (27), `k2-incident-sanitize` (14), `k2-whatsapp-tokens`, `k3-whatsapp-ui` (18), `k3-quota-rules` (33), `k3-quota`, `k3-stripe-refunds`, `k3-quota-defaults`, `k3-quota-integrity`, `k4-email-injection`, `k4-billing-platforms`, `k4-public-artifact`, `k4-deploy-plan`, `k4-quota-integrity`, `packaging` (22), `seating-engine`, `copilot-classify`, `compare`, `gcal`, `invitations`, `invitation-delivery`, `invitations-schema-sync` (38), `invitations-parity` (56), `invitations-e2e-8`, `rules-invitation-delivery` (53), `rules-invitations` (51), `site` (74), `contact` (37), `contact-stress`, `notify`, `backfill`, `rules-premium`, `rules-memdocs`, `rules-site`, `rules-state` (13), `rules-consent` (14), `rules-logistics` (23), `rules-hardening`, `rules-phasec` (31).

Interface — OK: `ui-sweep` (366), `ui-seating-ai` (80), `ui-copilot` (160), `ui-memdocs` (94), `ui-notif-core` (28), `ui-notif-center` (32), `ui-wa-sheet` (11), `ui-wa-rsvp` (42), `ui-robust-state` (46), `ui-robust-paths` (296 casos), `ui-autopilot` (59), `ui-premium-lapsed` (72), `ui-cakestatvows` (129), `ui-gcal-lapsed` (69), `ui-site` (90), `ui-logistics-rsvp` (52), `ui-logistics-couple` (47), `ui-logistics-tables` (24), `ui-phasec-e2e` (89), `ui-logistics-concierge` (26), `ui-state-shape` (3), `ui-i18n-en` (7), `ui-sanitize` (16), **`qa-p1p2` (98 casos funcionais: Início, Orçamento, Convidados, Gastos, Mesas, Checklist, To-do, Fornecedores, planeamento, Health, teclado; 390/768/1440)**.

## 3. Falhas e explicação

| Suite | Resultado | Causa | Regressão? |
|---|---|---|---|
| `site` (1.ª execução) | 73/74 | **Falso positivo do teste**: a expressão de privacidade procurava `20000` (orçamento) em todo o JSON e coincidiu com `"_nanoseconds":162000000` do carimbo `publishedAt`. Reproduzido 1 em 8 execuções. Corrigido em `tests/site/site.test.js` (`\b20000\b`), que continua a detetar um orçamento `20000`. Depois: 74/74 | Não (o teste e o `index.js` são iguais aos da branch do servidor) |
| `ui-compare` | parou após 67 verificações OK, 0 falhas | Falta `pdftotext` (poppler) neste computador para validar o PDF gerado | Não — limitação do ambiente |
| `ui-notif-email` | falha | Procura o interruptor de email nas notificações, que o `main` retirou de propósito (Lote 2 «centro in-app, sem email»). **Falha igual contra a app do `main`** (`WEDDY_APP_HTML`) | Não — pré-existente; ver pendente 2 do doc. B |

## 4. Não executado / limitações

- **Login real, autenticação Firebase real, Premium com pagamento real, PWA instalada e Service Worker num browser real**: não foram testados (exigiriam o projeto real ou um ambiente de teste com credenciais). A interface foi testada com Firebase simulado; as regras e funções com emuladores.
- Validação do PDF do Comparador (falta `pdftotext`).
- Testes manuais em dispositivos (iPhone/Android) não feitos.
- Ambiente: Node 24.20, Java 17, Python 3.14 + Playwright 1.64.1 num ambiente virtual temporário, Chromium 158 headless já existente na máquina.
- Nota de ambiente: as suites de funções exigem que o `index.js` resolva o `firebase-admin` através de `tests/node_modules` (`NODE_PATH`). Um `node_modules` na raiz com outra cópia do `firebase-admin` faz falhar todas as suites de funções com `app/no-app`. A pasta `servidor/` tem hoje um `node_modules` na raiz (e um `package-lock.json` não rastreado), por isso é provável que lá as suites de funções falhem pelo mesmo motivo.

## 5. Como repetir

```bash
cd tests
npm install                # uma vez
node run-all.js --list
node run-all.js            # todas (arranca e pára os emuladores)
WEDDY_APP_HTML=/tmp/app-main.html node run-all.js --only ui-notif-email   # comparar com a app do main
```
