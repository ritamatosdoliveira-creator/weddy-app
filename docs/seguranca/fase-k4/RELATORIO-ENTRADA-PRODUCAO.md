# Relatório de entrada em produção

Atualizado em 2026-11-05 (tarde). **Estado: ENTRADA FASEADA EM CURSO.** Functions dos lotes 1, 2, 3, 4a, 4b, 4d e 5 publicadas; regras do Firestore publicadas; cliente PWA, regras do Storage, lote 4c e callback novo do calendário **por publicar**.

Convenção: "publicado" = observado em produção por saída colada pela proprietária. "Testado" = emulador/mocks, nunca produção, salvo indicação.

## 1. Commit (autorizado)
- Commit local **`3528936`** no branch `v325-import-guests` (pai `04fefc7`), 25 ficheiros. Sem push, merge, rebase, tag nem stash. `firestore.rules`, `storage.rules` e `firebase.json` não fazem parte do diff.
- Este relatório fica **por commitar** (não está coberto pela autorização).
- Entregue ao computador da proprietária: `~/weddy-k4-release.zip` (git archive de `3528936`) e `~/weddy-rollback-prod-1030.zip` (kit de rollback por código).

## 2. Lote 0 (leitura) — executado, correspondeu ao plano
Funções, triggers, Scheduler, segredos, Firestore (eur3), bucket (multirregião UE) e backups verificados pela proprietária. Sem divergências que impedissem avançar. Firestore e Storage em localização compatível.

## 3. Lotes publicados (todas as publicações feitas pela proprietária no seu Terminal; esta sessão nunca iniciou sessão nem usou credenciais)
| Lote | Estado | Notas |
|---|---|---|
| 1 IA/contacto | publicado | verificado; chatbot/IA das mesas confirmado a funcionar |
| 2 apoio/calendário/site/WhatsApp/eliminação | publicado | ver 4a |
| 3 lembretes | publicado | 2026-11-06: `sendRsvpReminders` (09:00) correu e não tinha nada a enviar; `sendCoupleEmailDigest` (10:00) correu com `enabled=false`, 0 enviados. **O código novo de email não foi exercitado em produção.** |
| 4a | publicado **com o código antigo do callback** do calendário | ver incidente 6.1 |
| 4b | publicado | teste de gravar no telemóvel como convidada: **guardou** (2026-11-06) |
| 4c | **saltado pela proprietária** | não publicado |
| 4d | publicado | 4 funções, incl. trigger `revokedownloadtokensonownerremoval` |
| 5 quota fotos | publicado | `memoryQuotaOnDocCreated`, `OnObjectFinalized`, `OnDocDeleted`, `OnObjectDeleted`, `memoryQuotaReconcile` |

Verificação do lote 5 (observada): 4 triggers `memoryquota…` + `revokedownloadtokensonownerremoval` presentes; filtro de erros (200 min) vazio; upload de teste contado (`files=1`); apagar o documento libertou (`files=0`); a foto de teste desapareceu do Storage; job Scheduler `memoryQuotaReconcile` criado, `ENABLED`, 60 min. Execuções horárias do `memoryQuotaReconcile` observadas de 2026-11-06 02:23 a 09:23 UTC: todas `errors:0`, `orphansDeleted:0`, `gaveUp:0`, `truncated:false` (a consulta tinha limite de 30 linhas). Fotos antigas (11 no casamento de teste) não entram na contagem: os contadores começam do zero; o `memoryQuotaReconcile` só trata entradas das suas filas e não percorre o Storage (leitura do código, não observado em produção).

## 4. Regras
- Antes: regras em produção exportadas e comparadas — **idênticas ao `origin/main`** (340 e 100 linhas), confirmando o pressuposto da revisão de compatibilidade.
- Auditoria de dados (só leitura, 221 casamentos): `jsonNaoTexto` 0, `jsonGrande` 0, `premiumUntilNaoTimestamp` 0, `ativaSemSubscricao` 0, `subscricaoSemValidade` 5 (continuam Premium pelo campo `active`; sem backfill).
- **Firestore: publicadas** (autorização expressa da proprietária) — ruleset `6890f6c5-d0a9-4073-ad94-2b09dfda5921`, 2026-11-05T15:49:47Z. Conteúdo exportado e comparado: **idêntico a `firestore.rules` (467 linhas)** de `3528936`. Sem erros nos 15 min seguintes. Testes manuais da proprietária (login/gravar convidado, abrir RSVP, galeria de memórias): passaram.
- Decisões aceites pela proprietária: Premium obrigatório para fotos de convidados e documentos; o cancelar subscrição do PWA antigo falha (de forma segura) até o cliente novo ser publicado.
- **Storage: NÃO publicadas** (ronda e autorização à parte; depende do cliente novo e da permissão cruzada Storage→Firestore por confirmar em ambiente real).
- Ruleset anterior do Firestore: `d4fba0b9-03b4-427f-9279-b6ca8305eb66`; ficheiros exportados em `~/regras-producao/` (rollback = publicar `cloud_firestore.rules`).

## 5. Lote 6 — cliente PWA (preparado, NÃO publicado)
- Cliente ao vivo: `weddy-v324-comparador`. Novo: `weddy-v326-k4` (`app/sw.js` e uma linha em `app/index.html`: a galeria ignora `quotaState==='pending'`).
- Artefacto: `node scripts/build-public.js` → `_site/`, 78 ficheiros da allowlist (sem `docs/`, `tests/`, `scripts/`, `recuperado-producao/`, markdown, `.env`).
- Antes de qualquer push que traga pastas privadas ao ramo publicado: origem do GitHub Pages para "GitHub Actions" (workflow já no commit; só atua após push).
- Com as regras do Firestore já publicadas, o `rsvp.html` novo (`logistics`) deixa de estar bloqueado.
- Pós-publicação: o PWA oferece "Atualizar" e passa a `v326-k4`; galeria mostra fotos antigas; RSVP e login normais; cancelar subscrição volta a funcionar.
- Depois do cliente: callback novo do calendário (`googleCalendarFinalizeOAuth` + callback), e só então as regras do Storage.

## 6. Incidentes e problemas
### 6.1 Rollback por revisão Cloud Run falhou (lote 4a)
Ao tentar voltar a uma revisão anterior, a imagem do contentor já tinha sido removida ("Container import failed") e um `update-traffic` falhado deixou o tráfego fixado na revisão avariada. Resolvido com `--to-latest` e novo deploy do código antigo do callback a partir do zip de rollback (revisão `googlecalendaroauthcallback-00023-dob`). **Conclusão: o rollback por revisão não é fiável. O único rollback fiável é por código**, uma função de cada vez, com o `.env` original (`~/weddy-rollback-prod-1030.zip`). Os documentos `VALIDACAO-FINAL-PRODUCAO.md` e `PLANO-DEPLOY-EXPLICITO.md` (commitados em `3528936`) ainda dizem o contrário e **devem ser corrigidos** (alteração por commitar, precisa de nova autorização).
### 6.2 Outros
- `.env` copiado continha `OPENAI_API_KEY=` com valor: linha removida só da cópia (original intocado; o segredo existe no Secret Manager).
- Permissão do agente de serviço Eventarc a propagar na primeira criação de trigger: resolvido com espera e repetição.
- `gcloud eventarc triggers list --location europe-west1` mostra 0 para triggers Firestore (vivem em `eur3`): usar `--location=-`.
- Ruído benigno após cada deploy: pares de GET (scanner de URLs) → "Invalid request, unable to process"; filtrados.
- O browser integrado negou o acesso à consola Firebase; não contornado (usadas leituras REST/gcloud executadas pela proprietária).
- Credenciais de aplicação (ADC) criadas pela proprietária para a auditoria: recomendado `gcloud auth application-default revoke`.

## 7. Riscos abertos
- **k3-quota intermitente em emulador** ("Transaction lock timeout" com 40 operações paralelas), causa provável contenção do emulador, **não estabelecida**; não validado em produção. Vigiar ABORTED/contenção nas funções de quota na primeira semana; não é possível garantir ausência de erros.
- Retries de triggers (`retry:true`, até 7 dias) têm custo: vigiar.
- Fotos antigas sem contagem de quota; contas Premium sem `startedAt/premiumUntil` (5) sem tratamento; retenção legal de dados não definida por mim.

## 8. Verificação final — estado por área (o que foi realmente observado)
| Área | Estado |
|---|---|
| Pagamentos/Premium | funções publicadas; não houve compra/reembolso real observado; `record_only` inalterado |
| RSVP/emails | RSVP abre com as regras novas (teste da proprietária); `sendRsvpReminders` e `sendCoupleEmailDigest` correram em 2026-11-06 sem enviar emails: código novo de email não exercitado em produção |
| IA/contacto | IA das mesas confirmada |
| Calendário | callback antigo em produção; novo pendente do cliente |
| WhatsApp | app abre envio padrão; sem API (decisão da proprietária) |
| Site | cliente não publicado; site público não alterado |
| Eliminação de conta | função publicada; não executada em produção |
| Memórias upload/ver/apagar | upload contado, libertação ao apagar e galeria com fotos antigas: observados |
| Quotas/reconciliação | triggers OK; reconciliação horária observada (7 execuções, sem erros nem apagamentos) |
| Erros de funções | filtros de ERROR vazios às verificações feitas |
| Gravar no telemóvel (4b) | guardou (teste da proprietária) |

## 9. Por fazer
1. Vigiar erros das funções de quota na primeira semana (filtro `NOT textPayload:"Invalid request"`); 4 entradas de `googlecalendaroauthcallback` ontem 12:16–12:24 UTC, sem texto, por esclarecer.
2. Observar o primeiro envio real de email com o código novo (hoje não houve envios).
4. Cliente PWA (a proprietária publica) → callback novo do calendário → regras do Storage (autorização à parte).
5. Corrigir os documentos de rollback; verificação Git final (branch `v325-import-guests`, HEAD `3528936`, sem push/tag/stash).

## 10. Publicações do cliente (6 Nov 2026) — registo interno, não vai para o main
| Lote | Commit no main | CACHE_NAME | Estado |
|---|---|---|---|
| 6a, 6a.1, 6b, 6c (RSVP: logística, WhatsApp, Autopilot, fontes) | cfd440e … 8f7ced6 | weddy-v331 … v333 | no ar, hash verificado |
| 7 Memories e Documentos | d72403d | weddy-v334-memorias-documentos | no ar, hash verificado (index 0031516b4171728d, rsvp 0ff057a26de26906) |
| 8 Bolo, Papelaria, Votos | faee97f | weddy-v335-bolo-papelaria-votos | no ar (hash index d634fcaf3442db2a) |
| Regras do Storage | — | — | publicadas pela proprietária a 2026-11-06 ~16:06 (declarado; não verificado por mim, sem credenciais). Rollback: histórico na Consola ou storage.rules.prod |
Por observar após as regras: documento novo com Premium (aceita), foto pelo QR com Premium (aceita), casamento sem Premium (recusa upload; lê e apaga), foto de inspiração do bolo.
Pendente: callback novo do Calendar, lote 4c e Site, A.4 (robustez; inclui documentos nulos), notas de Premium terminado do Calendar/Site.
