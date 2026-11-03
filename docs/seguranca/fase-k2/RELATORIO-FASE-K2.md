# Relatório Fase K.2 — Implementação das decisões aprovadas (local)

Base: branch `v325-import-guests`, K.1 `e7983cc`. Âmbito: apenas as 4 decisões aprovadas. **Sem push/merge/deploy; sem alterações em produção; sem segredos tocados.**

| Decisão | Resultado |
|---|---|
| 1 WhatsApp | Flag `WHATSAPP_API_ENABLED` (defeito `false`) em `sendWhatsappRsvpReminder`; código preservado; webhook/STOP, emails, lembretes manuais e RSVP sem conta intactos → `ALTERACOES-WHATSAPP.md` |
| 2 Tokens | Trigger `revokeDownloadTokensOnOwnerRemoval` roda tokens de documents/memories/sites; sem apagar ficheiros → `REVOGACAO-TOKENS-DOWNLOAD.md` |
| 3 Incident log | Minimização, limites, `expireAt` +90 dias, regras com esquema fechado; TTL não ativado; financeiro separado → `POLITICA-INCIDENT-LOG.md` |
| 4 OpenAI | Só procedimento atualizado → `PLANO-ROTACAO-OPENAI.md` |

Achado corrigido de passagem: `logOutgoingWriteGuardTripped` gravava o estado completo do casamento no log; agora só contagens.

Ficheiros alterados: `index.js`, `app/index.html`, `firestore.rules`, `tests/run-all.js`, `tests/consent/{whatsapp-consent,stop-revocation}.test.js`, `tests/rules/hardening-rules.test.mjs`, `tests/k2/*` (novos), `docs/seguranca/fase-k2/*`.
Testes: regressão completa **56/56** (ver `MATRIZ-TESTES-K2.md`). Pendências e propostas (quota de uploads, App Check, Stripe) em `PENDENCIAS-K2.md`. Fase L não iniciada.
