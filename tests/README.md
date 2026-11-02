# Testes automáticos da Weddy

Tudo corre **localmente**: emuladores Firebase (projeto `demo-weddy`) e Chromium. Nenhuma suite fala com produção, com a OpenAI, a Meta ou o SMTP real (o email e o Firebase são simulados; o runner remove credenciais do ambiente).

## Preparar (uma vez)
```
cd tests
npm install                      # firebase-tools, firebase-admin, firebase-functions, nodemailer, regras…
pip install playwright           # Python 3 + Playwright
npx playwright install chromium  # (ou usar o Chromium que já existir)
```
Requisitos: Node ≥ 20, Python ≥ 3.10, Java (para o emulador Firestore).

## Correr
```
npm test                         # todas as suites (arranca e pára os emuladores sozinho)
node run-all.js --list           # lista as suites e grupos
node run-all.js --only ui        # um grupo
node run-all.js --only consent,notify,rules-state   # grupos e/ou ids
```
Saída: uma linha por suite (`OK`/`FALHOU` + resumo + tempo), no fim `N/M suites passaram`, código de saída 0/1.
Relatórios: `tests/reports/last-run.md` e `.json`, e um `.log` completo por suite (`tests/reports/<suite>.log`). `reports/` e `.build/` não vão para o git.

## Organização por módulo
| Pasta | Módulo | Corre com |
|---|---|---|
| `unit/` | paridade PT/EN do `rsvp.html` | Node |
| `validate/` | validação do estado JSON no servidor (A.4.3) | Node + emulador Firestore |
| `consent/` | consentimento WhatsApp (functions) e migração | Node + emulador |
| `contact/` | formulário de contacto `sendContactMessage` | Node + emulador (SMTP simulado) |
| `notify/` | email resumo (A.2) | Node + emulador (SMTP simulado) |
| `backfill/` | `premiumUntil` | Node + emulador |
| `rules/` | regras Firestore/Storage (Premium, consentimento, estado JSON/quarentena) | Node + emulador |
| `ui/` | interface (desktop 1360 px + telemóvel 390 px): notificações, preferências do email, ficha do convidado, RSVP, robustez do estado, inglês, paridade do estado | Python + Playwright |

`ui/common.py` constrói em `tests/.build/` uma cópia de `app/index.html` com ganchos de teste (`window.__t`, `window.__a4`); o ficheiro real da app não é alterado. O Firebase é um Proxy sem rede e qualquer pedido que não seja `file://` do repositório é bloqueado. Capturas de ecrã vão para `tests/.build/shots/`.

## Acrescentar uma suite
1. Pôr o ficheiro na pasta do módulo (Node: sair com código ≠ 0 se falhar; Python UI: `from common import *` … `summary()`).
2. Registá-lo no array `SUITES` de `run-all.js` (`emu: true` se precisar do emulador).
3. `node run-all.js --only <id>`.

## Notas
- As suites de regras (`.mjs`) e de functions usam as portas 8085 (Firestore) e 9195 (Storage); se já houver emuladores a correr nessas portas, pará-los antes.
- `tests/.build/emulator/` guarda uma cópia fresca de `firestore.rules`/`storage.rules` (o CLI exige que estejam dentro da pasta do projeto).
- Nunca correr estes testes com `FIRESTORE_EMULATOR_HOST` apontado para outra coisa que não o emulador.
