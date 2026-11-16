# Inventário de funcionalidades do branch `v325-import-guests` (2026-11-06)

Base: cliente em produção = `main` (v324, `b9d2fd2`). O branch tem 60 commits (2–5 nov) e ~3 500 linhas novas no cliente. Estado do backend/regras na produção: Functions dos lotes 1, 2, 3, 4a (callback antigo), 4b, 4d e 5 publicadas; **4c (Site do casamento) não publicado**; regras do **Firestore publicadas** (iguais a `firestore.rules` do branch); regras do **Storage não publicadas**; cliente não publicado.

Achado estrutural: o cliente é um ficheiro único (`app/index.html`). Os commits misturam funcionalidades (ex.: `b1e0b4d` junta importação de convidados, notificações, consentimento WhatsApp e Premium no servidor, +946 linhas), por isso **não se publica por commit: cada lote tem de ser extraído por blocos de código e testado à parte**. Isto foi feito para o lote 1.

O cliente do branch só chama duas Functions que o `main` não chama: `getWhatsappApiStatus` e `googleCalendarFinalizeOAuth` (ambas publicadas).

Legenda de risco: B = baixo, M = médio, A = alto. "Testes" = o que existe no repositório; "validado hoje" = o que corri nesta sessão.

| # | Funcionalidade | Commits | Onde vive | Backend (estado) | Regras | Testes | Em produção? | Falta | Risco |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Importar convidados (Excel/CSV)** | `b1e0b4d` (A.1) | `app/index.html` (bloco isolado, +~370 linhas) | nenhum; grava no estado do casamento (`weddings.json`) | nenhuma nova (limite `json` ≤ 900 000 já publicado) | **nenhum no repositório**; validado hoje: 21 verificações (xlsx, csv `;`, tipo/tamanho, duplicados, inválidos, XSS, só-acrescenta, desfazer) | não | publicar cliente | B |
| 2 | **Cancelar subscrição (correção)** | `b1e0b4d` (A.3) | `app/index.html` (4 linhas) | nenhum | **as regras publicadas rejeitam a versão antiga** (escreve o mapa inteiro) | testes de regras; validado hoje: antigo escreve `['subscription']`, novo escreve só `subscription.active/updatedAt` | não (**regressão ativa**) | publicar cliente | B |
| 3 | Notificações inteligentes | `b1e0b4d` (A.2) | `app/index.html` (centro de notificações, ~1 000 linhas) | `sendCoupleEmailDigest`, `unsubscribeNotify` publicadas; resumo por email **desligado** (`enabled=false`) | publicadas | `tests/notify`, `ui/notif_*.py` | não | publicar cliente; email só com decisão tua | M |
| 4 | RSVP melhorado + Autopilot | `1d67f0b`, `de3293e`, `e70eb1d` | `rsvp.html` (+551) e `app/index.html` | `sendRsvpReminders` publicada (modo Autopilot) | publicadas (`logistics`) | `tests/rsvp`, `ui/rsvp_autopilot.py`, `ui/logistics_*.py` | só o backend | publicar `rsvp.html` + cliente juntos | M–A (página pública dos convidados) |
| 5 | Logística (casal, mesas, Health) + Concierge | `35d8bba`, `29de244`, `cf3e6a3`, `66ffc71`, `b2adf32` | `app/index.html` | — | publicadas | `ui/logistics_*`, `ui/phasec_e2e.py` | não | depende de 4 | M |
| 6 | Weddy Copilot | `12ef1da` | `app/index.html` (+559) | `classifyWeddyIntent` publicada (OpenAI, segredo no Secret Manager) | — | `tests/copilot`, `ui/copilot.py` | não | publicar cliente; custo OpenAI | M |
| 7 | AI Seating (mesas com IA) | `e6a41fc` | `app/index.html` (+275) | `generateSeatingProposal` publicada | — | `tests/seating`, `ui/seating_ai.py` | não | publicar cliente; custo OpenAI | M |
| 8 | Weddy Compare | `93493fe`, `1662f5a` | `app/index.html` (+11) | `analyzeCompareProposal`, `generateCompareReport` publicadas | — | `tests/compare`, `ui/compare.py` | o comparador base já está no v324 | correções menores | B |
| 9 | Memories (fotos) | `bb1a29f`, `99b66f8`, K.3/K.4 | `app/index.html`, `memorias.html` | quota K.4 publicada | Firestore publicadas; **Storage por publicar** | `ui/memdocs.py`, regras | só o backend de quota | cliente (filtro `quotaState`) + regras Storage | M–A |
| 10 | Documents | `bb1a29f`, `99b66f8` | `app/index.html` | — | **Storage por publicar** (Premium) | `ui/memdocs.py` | não | idem | M |
| 11 | Bolo, Papelaria, Votos | `ea0c984`, `426ec1d` | `app/index.html` (+90) | — | Storage para fotos de inspiração: **a confirmar** | `ui/cakestatvows.py` | não | confirmar regras de Storage | M |
| 12 | Google Calendar + Site do casamento | `8991505` | `app/index.html` | **callback novo por publicar** (precisa do cliente novo); **4c (site) não publicado** | — | `tests/gcal`, `tests/site` | não | cliente, depois callback e 4c | A |
| 13 | Consentimento WhatsApp (double opt-in) | `b1e0b4d`, `a15aaee`, K.2/K.3 | `rsvp.html`, `app/index.html` | 4b publicado; funcionalidade desligada por defeito | `whatsappConsents` publicadas | `tests/consent` | só o backend | cliente | M |
| 14 | Premium terminado / estado corrompido / inglês / RGPD (fontes alojadas) | `e4bb4a6`, `e38061e`, `8f3a059`, `426ec1d`, `9a3b7f0` | `app/index.html` | eliminação de conta publicada (4d) | — | `ui/premium_lapsed.py`, `ui/robustness_*`, `ui/i18n_en*` | não | publicar com as funcionalidades a que pertencem | B–M |

## Ordem proposta (valor para os noivos × risco × dependências)
- **Lote 1 (preparado hoje):** #1 + #2. Só cliente, sem dependências por publicar, 406 linhas acrescentadas e 1 alterada em relação ao v324.
- **Grupo A (a seguir, um de cada vez):** #8 correções do Compare; #3 notificações (sem email); #6 Copilot; #7 AI Seating — todas com backend já publicado, sem regras novas; cada uma exige extração por blocos e teste próprio.
- **Grupo B:** #4 + #5 RSVP/logística (pares `rsvp.html` + cliente); #13 WhatsApp; #14 conforme dependências.
- **Grupo C (no fim):** #9, #10, #11 (regras de Storage); #12 (callback, 4c, cliente).

## Riscos e limites desta análise
- Estado em produção de cada item baseado nas saídas coladas pela proprietária e no código; não testei em dispositivos reais.
- Itens marcados "a confirmar" ainda não foram lidos a fundo.
- `main` já contém na raiz `index.js`, `firestore.rules`, `storage.rules`, `README.md` e `RECUPERACAO.md`; se o Pages publica o ramo, esses ficheiros são servidos hoje (não verificado; WebFetch esteve bloqueado). Um commit só sobre o `main` não agrava isto.
