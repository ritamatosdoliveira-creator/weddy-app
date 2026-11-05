# Validação final e plano de entrada direta em produção

Data: 2026-11-05. Só auditoria, testes locais e plano. **Nada foi publicado, commitado ou enviado; produção não foi contactada.**

## 0. Estado real
- Branch `v325-import-guests`, HEAD `04fefc7`, sem stash. **Não existe nenhum commit com a K.4 nem com as correções posteriores**: tudo está na árvore de trabalho (10 ficheiros modificados + novos). `firebase deploy` publica a árvore de trabalho, portanto sem commit local não há ponto de retorno rastreável (condição C1).
- Decisão da proprietária registada: avançar diretamente para produção, sem staging. As condições legais/operacionais foram dadas como resolvidas por ela; **não as verifiquei**.

## 1. Auditoria (diff local vs HEAD)
| Área | Resultado |
|---|---|
| Funções | 45 exportadas, **iguais ao HEAD** (nenhuma criada, removida ou renomeada). 32 existem em produção (código recuperado 2026-10-30), 13 são novas para produção, 1 excluída de propósito (`validateWeddingStateOnWrite`). |
| O que o diff altera (index.js, +397/−148) | quota de fotos K.4 (`memoryQuota*`), webhooks Stripe/RevenueCat (retry + atualização por plataforma), `reminderEmailHtml`/`sendReminderEmail` (anti-injeção), `deleteWeddingAccount` (limpeza de quota), `resolveWeddingIdByUid`. |
| Cliente | `app/sw.js` (`CACHE_NAME` → `weddy-v326-k4`) e 1 linha em `app/index.html` (galeria ignora documentos `quotaState:'pending'`). |
| Regras | `firestore.rules`, `storage.rules`, `firebase.json` **inalterados vs HEAD**. As regras implantadas em produção não existem no repositório (não verificáveis aqui). |
| Segredos / parâmetros | iguais ao HEAD (nenhum novo no diff). Continua a valer o plano: `OPENAI_API_KEY` como segredo. |
| Dependências | `package.json` inalterado. `package-lock.json` não existe na raiz (build não reprodutível). |
| Triggers / agendadas | nenhum trigger adicionado por este diff face ao HEAD. Os 4 triggers `memoryQuota*` (Firestore/Storage, `retry:true`, `maxInstances:20`) e `memoryQuotaReconcile` (horária) são dos 13 novos. |
| Desnecessário / fora da publicação | `docs/`, `tests/`, `scripts/`, `recuperado-producao/`, `.github/` (proposta Pages, inativa), `validateWeddingStateOnWrite`, **regras Firestore/Storage** (sem necessidade comprovada para esta release). |

Nota: o código de produção (2026-10-30) difere do atual em ~2866 linhas (45 vs 32 funções); por isso todas as 32 funções existentes entram nos lotes, não só as que este diff toca.

## 2. Testes e regressão
- **Suite completa: 67 suites, 67 aprovadas, 0 falhadas, código de saída 0** (execução aguardada até ao fim, código final; logs em `tests/reports/validacao-final-20261105/`). Cobre memories/quotas, uploads/eliminação de fotos, órfãos, eliminação de casamento/conta, RSVP/emails, Stripe/RevenueCat (ativação, reembolsos, retry, idempotência, plataformas cruzadas), segurança/permissões, regras Firestore+Storage, UI e regressão geral. Nenhum teste foi alterado ou enfraquecido nesta tarefa. (As suites de regras imprimem avisos do runtime de regras nos casos de negação testados; passam.)
- **k3-quota — execuções repetidas** (só essa suite, emulador novo em cada execução):
  | Código | Execuções | Falhas |
  |---|---|---|
  | Atual | 12 | 2 (execuções 1 e 10) |
  | Commit base `04fefc7` | 12 | 1 (execução 6) |
  | Atual com tentativa de correção (repetir a limpeza de recusadas) | 13 | 1 → correção **revertida**, sem benefício demonstrado |
  | Atual, séries anteriores nesta tarefa | ~9 | 2 (e 8/8 sem falha na última série) |
  Total no código final, ~30 execuções isoladas: ~4 falhas (≈ 10–15 %); no commit base ≈ 8 %. **Todas** as falhas: mesmo ponto (passam 11 verificações, falha a 12.ª = 40 pedidos paralelos ao mesmo contador), erro `10 ABORTED: Transaction lock timeout`; numa execução ficou ~9 min antes de falhar. Nas execuções completas da suite passou sempre.
- **Causa provável (não provada):** contenção de locks do **emulador** do Firestore. 40 transações leem-e-escrevem o mesmo documento (`memoryQuota/{casamento}`); o emulador usa locks pessimistas e resolve conflitos de promoção de lock por timeout, e os abortos podem esgotar as tentativas (SDK + `memoryQuotaRetry`, 25×). Indícios: sempre no mesmo cenário; já existia antes da K.4 (commit base); erro vem de `ReactiveLockManager.acquireLocks` do emulador; nenhuma das outras 66 suites falha. Excluí a hipótese "limpeza fora do retry" (corrigi, não resolveu).
- **Relevância para produção:** as funções de quota são idempotentes e os triggers têm `retry:true`, por isso uma contenção transitória faz repetir o evento (mais lento), não perde nem duplica contagem. Um pico de uploads de muitos convidados no mesmo casamento pode gerar muitos `ABORTED`/retries: **monitorizar** na primeira semana. Se for frequente, a solução é contador fragmentado (mudança maior; não feita). Nem o emulador nem este teste provam o comportamento do Firestore real.

## 3. Compatibilidade e segurança
| Pergunta | Resposta |
|---|---|
| Perda de dados? | Nenhuma migração/backfill nesta release. As funções só escrevem coleções novas de servidor (`memoryQuota*`) e, em ficheiros/documentos **novos** recusados ou órfãos (>6 h sem documento), apagam o objeto. Nada legado é apagado: só são tratados objetos com item de quota aceite. |
| Fotos antigas acessíveis? | Sim. Sem alteração de regras; a galeria só oculta `quotaState==='pending'` (campo novo). Apagar uma foto legada nunca contada só cria um marcador; não mexe no contador (testado). |
| Quotas existentes incorretas? | **As fotos já existentes não estão no contador** (não há backfill). O álbum de cada casamento conta a partir de zero após o deploy → limites mais folgados do que o desenhado até recontar. Não é perda, mas é uma decisão (C8). |
| PWA antiga bloqueada? | Funções: assinaturas dos callables inalteradas. Regras: **não publicadas nesta release**, logo o PWA antigo não é afetado por regras. (O problema do cancelar no PWA antigo só surge se as regras novas forem publicadas.) |
| Premium perde acesso? | Não: o diff não altera subscrições existentes nem a leitura do estado Premium; só eventos novos. Testado: reembolso Apple antigo com Stripe ativo, cancelamento Stripe com Apple ativo, fora de ordem, duplicado. Contas `active` sem `premiumUntil` continuam a valer (comportamento anterior). |
| Stripe × RevenueCat | Atualização por campos da plataforma respetiva; testado. Preços, produtos e `record_only` inalterados. |
| Idempotência dos webhooks | Mantida; falha de gravação → 500 `retry`; testado (22 verificações). |
| Funções existentes apagadas? | Não: comandos só com `--only functions:<nome>`; teste `k4-deploy-plan` falha se faltar/sobrar função, houver `--force` ou `functions:delete`. |
| Triggers/agendadas duplicados? | Nomes novos não existem em produção; os existentes mantêm o nome (deploy atualiza no lugar). Confirmar com `firebase functions:list` antes (C3). |
| Custos / operações adicionais | Por upload de foto: 2 eventos (Storage + Firestore) → ~2 invocações + ~6–10 operações Firestore; 1 invocação/h do reconcile (leituras de filas limitadas); `retry:true` pode multiplicar em erros persistentes (até 7 dias no Eventarc). Valor em euros **não estimado**; conferir no painel de faturação. |
| Não verificável antes de publicar | Eventarc de Storage na região/bucket reais, permissões dos agentes de serviço, Scheduler real, comportamento do Firestore real sob contenção, e-mails reais. |

## 4. Plano de publicação direta (lotes pequenos; nada executado)
**Fora da release:** regras Firestore e Storage (sem necessidade comprovada; exigem exportar as implantadas e decisões comerciais — ver `REVISAO-REGRAS-COMPATIBILIDADE.md`). Cliente (GitHub Pages) é passo da proprietária, via artefacto por allowlist.

**Lote 0 — pré-verificações (só leitura).** Autorizar commit local (C1); `firebase functions:list --project weddy-app-bd12f` (confirmar 32 funções esperadas e nenhuma extra); anotar revisões Cloud Run; confirmar PITR/export do Firestore; listar **nomes** dos segredos (`gcloud secrets list`, sem valores) e `OPENAI_API_KEY`; confirmar região do Firestore/bucket compatível com `europe-west1`; `scripts/backfill-premium-until.js` em dry-run. *Sucesso:* tudo coincide. *Rollback:* n/a.

Em cada lote: antes, anotar a revisão atual; depois, ver logs 30 min sem erros novos. Rollback de função: `gcloud run services update-traffic <nome-em-minúsculas> --to-revisions=<revisão-anterior>=100 --region europe-west1 --project weddy-app-bd12f` (funções novas: desativar/apagar só a própria, uma a uma).

| # | Lote | Comando (produção) | Verificação / sucesso |
|---|---|---|---|
| 1 | Pagamentos (3) | `firebase deploy --only functions:createSubscriptionCheckout,functions:stripeWebhook,functions:revenueCatWebhook --project weddy-app-bd12f` | pedido sem assinatura devolve 4xx; sem erros nos logs; no próximo evento real: 200 e Premium correto; nenhuma alteração em Stripe/RevenueCat |
| 2 | Lembretes e resumos (4), fora das 09:00/10:00 de Lisboa | `firebase deploy --only functions:sendRsvpReminders,functions:cleanupActivityLog,functions:sendCoupleEmailDigest,functions:unsubscribeNotify --project weddy-app-bd12f` | agendadas listadas uma só vez; link do email com `?g=` codificado |
| 3 | IA e contacto (5) | `firebase deploy --only functions:classifyWeddyIntent,functions:generateSeatingProposal,functions:analyzeCompareProposal,functions:generateCompareReport,functions:sendContactMessage --project weddy-app-bd12f` | `OPENAI_API_KEY` resolvido (sem erro de segredo); contacto envia |
| 4a | Calendário (10) | `firebase deploy --only functions:googleCalendarStartOAuth,functions:googleCalendarOAuthCallback,functions:googleCalendarFinalizeOAuth,functions:googleCalendarListCalendars,functions:googleCalendarConnectCalendar,functions:googleCalendarSync,functions:googleCalendarListEvents,functions:googleCalendarCreateEvent,functions:googleCalendarDeleteEvent,functions:googleCalendarDisconnect --project weddy-app-bd12f` | segredos Google presentes; ligar calendário de conta própria |
| 4b | WhatsApp/consentimento (6) | `firebase deploy --only functions:getGuestWhatsappConsent,functions:setGuestWhatsappConsent,functions:getWhatsappApiStatus,functions:updateGuestPhone,functions:whatsappWebhook,functions:sendWhatsappRsvpReminder --project weddy-app-bd12f` | consentimento lê/grava; webhook responde ao desafio de verificação sem mexer em dados |
| 4c | Site do casamento (7) | `firebase deploy --only functions:saveWeddingSiteDraft,functions:checkWeddingSiteSlug,functions:publishWeddingSite,functions:unpublishWeddingSite,functions:refreshWeddingSite,functions:reactivateWeddingSite,functions:syncWeddingSiteLifecycle --project weddy-app-bd12f` | rascunho grava; site já publicado continua a abrir |
| 4d | Eliminação e migrações (4) — **antes do lote 5** | `firebase deploy --only functions:deleteWeddingAccount,functions:migrateFamilyGuestIds,functions:migrateMemoriesGuestId,functions:revokeDownloadTokensOnOwnerRemoval --project weddy-app-bd12f` | funções existem; **as migrações não são invocadas** |
| 5 | Quota de fotos K.4 (5) — **último** | `firebase deploy --only functions:memoryQuotaOnDocCreated,functions:memoryQuotaOnObjectFinalized,functions:memoryQuotaOnDocDeleted,functions:memoryQuotaOnObjectDeleted,functions:memoryQuotaReconcile --project weddy-app-bd12f` | 4 triggers + 1 agendada criados (erro de Eventarc/permissões aparece aqui, sem afetar dados); upload de uma foto de teste num casamento da proprietária: aceite e contada; apagar: libertada; sem `ABORTED` em massa nem fila `memoryQuota*` a crescer |
| 6 | Cliente (proprietária) | publicar `_site/` com `scripts/build-public.js` (SW `weddy-v326-k4`) | app abre; galeria mostra fotos antigas |

Os lotes 4a–4d são a subdivisão do lote 2 de `scripts/deploy-plan.json` (27 funções = 10+6+7+4, verificado), e `googleCalendarOAuthCallback`/`FinalizeOAuth` ficam no mesmo lote 4a por serem um par OAuth (a regra do teste do plano continua a aplicar-se ao `deploy-plan.json`, que mantém os 5 lotes originais). Dentro dos lotes 1–5 o deploy é por nomes explícitos; nenhum comando genérico.

**Rollback global:** reverter as revisões Cloud Run anotadas, por ordem inversa (5 → 1); funções novas: desativar só as `memoryQuota*` se houver problema (dados de quota ficam, são só de servidor e podem ser apagados depois); cliente: reverter artefacto e subir `CACHE_NAME`; regras: não alteradas; Stripe/RevenueCat: nada a repor.

## 5. Condições antes do primeiro deploy
- **C1** Autorizar um commit local (sem push) para ter ponto de retorno e saber exatamente o que foi publicado.
- **C2** Lote 0 completo e coincidente (lista de funções, segredos, região, PITR).
- **C3** Gerar e versionar `package-lock.json` (ou aceitar build não reprodutível).
- **C4** Aceitar o `k3-quota` intermitente (emulador) e monitorizar `ABORTED` na primeira semana.
- **C5** Decidir sobre fotos já existentes não contadas (aceitar contadores a partir de zero).
- **C6** Janela de baixo tráfego; alguém a ver os logs 30 min por lote.
- **C7** Publicar cada lote só depois do anterior estar verificado.

## 6. Riscos para casamentos, convidados, fotografias, Premium
- Fotografias: uma recusa/limpeza incorreta apaga um ficheiro novo (só novos, até 20 por convite / 500 por casamento / 5 GB). Mitigação: contadores a partir de zero (mais folgado) e 1 foto de teste no lote 5. Órfãos: objeto sem documento >6 h é apagado (intencional).
- Convidados/RSVP: sem alteração funcional além do email (link codificado).
- Premium: sem alteração em estados existentes; risco residual só em eventos novos fora de ordem (testados).
- Operacional: retries de eventos com erro persistente (custos); Eventarc/permissões só se confirmam ao publicar o lote 5.

## 7. Decisão
**APROVADO COM CONDIÇÕES** (C1–C7). Não é "APROVADO PARA PRODUÇÃO" sem reservas porque: não há commit, o `k3-quota` tem uma intermitência de causa só provável, e Eventarc/Scheduler/permissões só se validam no projeto real. Não há regressão conhecida. As regras ficam fora desta release.
