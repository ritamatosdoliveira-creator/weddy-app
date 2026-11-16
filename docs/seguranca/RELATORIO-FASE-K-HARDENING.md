# Relatório Fase K — Hardening

Branch `v325-import-guests` · base `9a3b7f0` · tudo local · sem push/merge/deploy/publicação. Distinção usada: **[E]** emulador real · **[M]** serviço externo simulado · **[C]** código · **[X]** não verificado (precisa de produção/credenciais).

## 1. Arquitetura (resumo)
Frontend PWA de ficheiro único (`app/index.html`, + `rsvp.html`, `memorias.html`, site público) → Firebase Auth/Firestore/Storage (SDK web, regras) → Cloud Functions v2 europe-west1 (38 exports: 31 onCall/onRequest + agendadas `cleanupActivityLog`, `sendRsvpReminders`, `syncWeddingSiteLifecycle`, `sendCoupleEmailDigest` + trigger `validateWeddingStateOnWrite`) → integrações: OpenAI (Responses API), Google Calendar (OAuth), Stripe/RevenueCat, SMTP, Meta WhatsApp, EmailJS (cliente), GitHub Pages. Estado do casamento = string JSON em `weddings/{id}`; subcoleções `snapshots`, `activity`, `integrations`, `privateIntegrations`; coleções auxiliares só-servidor.
Pontos de falha e recuperação: escrita do estado em transação com fusão por secção + salvaguardas do cliente contra perda de dados + validador do servidor com quarentena e snapshots; webhooks idempotentes; eliminação ordenada (Storage antes do Firestore; Auth no fim). Sem duplicação de responsabilidades que justifique reestruturação.

## 2. Vulnerabilidades e correções
| ID | Sev. | Achado | Correção | Teste |
|---|---|---|---|---|
| K-1 | M | `returnUrl` do checkout aceitava qualquer https (open redirect pós-pagamento) | Allowlist de hosts | `hard-payments` [M] |
| K-2 | B | Email em log info | Passa a uid | revisão [C] |
Restantes riscos e aceites: ver MATRIZ-RISCOS-HARDENING.md (K-4…K-15). **Sem críticos; sem falhas de integridade abertas.**

## 3. Verificações sem achados (evidência)
- **Autenticação/autorização**: matriz automática sobre todas as callables (sem sessão, email não verificado, sem casamento, IDs alheios; vítima inalterada) [E] 124 verificações.
- **Regras Firestore/Storage**: 89 verificações adversariais [E] + suites anteriores.
- **Stripe/RevenueCat**: assinatura/Authorization, idempotência incluindo entregas simultâneas, async, renovação, sandbox, reembolso [M] 38 verificações. Nenhuma transação real.
- **Erros ao cliente**: sem `err.message` em `HttpsError`; Stripe em falha devolve erro genérico.
- **Concorrência**: ver MATRIZ-SEGURANCA-RESILIENCIA.md. Distinção: concorrência real tratada (webhooks, lembretes, contacto, transação do estado); last-write-wins intencional na mesma secção (K-8).
- **Eliminação**: cascata e falha parcial [E] (Fase J); quarentena e backups preservados; TTL documentado e **não ativado**.
- **Volume**: 50/150/300/500/1000 convidados fictícios: estado 2%–36% do limite do documento; validação <10 ms; AI Seating 600 convidados <4 s (limite de produto 800, inalterado) [E/M].
- **UX**: 366 verificações em 14 separadores + 6 definições × 390/768/1360 × PT/EN sem overflow nem erros [E].

## 4. Limitações
Não testado: sessões expiradas/revogadas e alteração de email (Firebase Auth real); OAuth Google real; Stripe real (modo teste); dispositivos iOS/Android; leituras Firestore em produção; auditoria WCAG formal; UI com Firestore/Storage indisponíveis simulados no browser (cobertos por suites de robustez anteriores e testes de servidor). Resiliência de rede no cliente: suites `ui-robust-*` e `rsvp` já existentes.

## 5. Estado
Testes novos: `hard-payments`, `hard-auth-matrix`, `rules-hardening`, `hard-scale`, `ui-sweep` (+ `privacy-*` da Fase J). Resultado da suite completa em RESUMO-EXECUTIVO-FASE-K.md. Beta: **não autorizada por esta fase**; bloqueadores externos em CHECKLIST-PRONTIDAO-BETA.md.
