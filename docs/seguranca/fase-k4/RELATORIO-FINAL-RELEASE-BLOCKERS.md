# Weddy — Relatório final: bloqueadores de release

Estado: tudo **local, sem commit, sem push, sem tag, sem deploy, sem contacto com produção**.
Branch `v325-import-guests`, HEAD `04fefc7`, sem stash.

## 1. Correções efetuadas
- **T1 Billing (P1 A+B)**: webhooks Stripe e RevenueCat respondem 500 `retry` quando a gravação da ativação falha (retry do webhook possível; idempotência mantida). Ativação por campos pontilhados da plataforma respetiva (`subscription.<plataforma>…`), sem substituir o mapa inteiro. REFUND/cancelamento de uma plataforma não desativa Premium se a outra estiver ativa (`hasApple`/transações reembolsadas). Preços, produtos, `record_only` inalterados. Sem migração de dados.
- **T2 GitHub Pages**: `scripts/build-public.js` gera `_site/` por allowlist; `.github/workflows/pages.yml` (proposta, não ativada); teste automático falha se ficheiros privados entrarem. A mudança de fonte do Pages para "GitHub Actions" é passo da proprietária.
- **T3 R4**: fila servidor `memoryQuotaOrphans`; reconciliação com janela de tolerância de 6 h, idempotente, só liberta quota após eliminação confirmada, claim por doc tardio sem recontagem. Custo: leituras/escritas Firestore + listagens Storage no `memoryQuotaReconcile` já existente (sem novo scheduler).
- **T4 Regras**: `firestore.rules`/`storage.rules` **não alteradas**; análise em `REVISAO-REGRAS-COMPATIBILIDADE.md`.
- **T5 Deploy**: `scripts/deploy-plan.json` + `scripts/deploy-preflight.js` (só imprime comandos); sem `functions:delete` nem deploy genérico `--only functions`; `PLANO-DEPLOY-EXPLICITO.md`.
- Extra: correção de injeção em HTML de email (`escapeHtmlServer`, `encodeURIComponent`), cache do SW `weddy-v326-k4`.

## 2. Ficheiros alterados
Modificados: `.gitignore`, `app/index.html`, `app/sw.js`, `index.js`, `tests/k3/quota.test.js`, `tests/rules/quota-rules.test.mjs`, `tests/run-all.js`, 3 docs K3.
Novos: `.github/workflows/pages.yml`, `scripts/build-public.js`, `scripts/deploy-plan.json`, `scripts/deploy-preflight.js`, `tests/k4/*` (quota-integrity, email-injection, billing-platforms, public-artifact, deploy-plan), `docs/seguranca/fase-k4/*`.

## 3–4. Testes e resultados
- Específicos: `k4-billing-platforms` 22 OK; `k4-quota-integrity` 64 OK; `k4-email-injection`, `k4-public-artifact`, `k4-deploy-plan` OK.
- **Suite completa: 67 suites, 67 aprovadas, 0 falhadas, código de saída 0** (aguardada até ao fim).
- **k3-quota**: passou na suite completa. **Intermitente em execuções isoladas**: erro do emulador "Transaction lock timeout" no cenário de 40 operações paralelas. Observado em ~2/4 e ~2/5 repetições isoladas nesta sessão (e ~1/4 no código original, antes das alterações); na última série de 8 repetições isoladas: 8/8 passaram. **Causa raiz não estabelecida** — apontada a contenção do emulador (o código já repete aborts com backoff). Teste não enfraquecido. Não é falha explicada: fica como risco aberto.

## 5. Riscos restantes
- Flake k3-quota (acima); validar em staging com carga real.
- Objetos R4 legados anteriores à fila de órfãos só são apanhados pela reconciliação (sem migração).
- Eventarc (Storage), Scheduler e TTL não validados fora do emulador.
- PWA antigo: cancelamento falha com as regras novas (ver revisão de regras) — atualizar cliente (SW v326) antes das regras.
- Contas Premium sem `startedAt/premiumUntil` — tratamento por validar.
- `package-lock.json` ausente; site público real não verificado (WebFetch bloqueado); políticas de privacidade/T&C e política Google Play/Apple por confirmar.
- Retenção legal de dados: não definida por mim.

## 6. Decisões da proprietária
Projeto/ambiente de staging; mudar fonte do Pages para Actions; prazos legais de retenção; aceitar/mitigar flake k3-quota; momento de atualizar PWA; revisão jurídica (privacidade/T&C, faturação); autorizar commit.

## 7. Condições de staging (nada executado)
Confirmar `weddy-premium-teste`, serviços ativos (Eventarc, Scheduler, Storage), custos, dados sintéticos e limpeza posterior; segredos/parâmetros configurados por ti (não lidos por mim); modo de teste Stripe/RevenueCat; validar webhooks com retry, quota, reconciliação de órfãos, fluxo Premium e PWA antigo.

## 8. Comandos de deploy preparados
Gerados por `node scripts/deploy-preflight.js` (não executados): 5 lotes com `firebase deploy --only functions:<nomes explícitos> --project <id>` — 1 IA/contacto, 2 apoio/calendário/site/WhatsApp/eliminação, 3 lembretes, 4 pagamentos, 5 quota fotos K4. Ordem completa em `PLANO-DEPLOY-EXPLICITO.md` (funções → regras Firestore → cliente → regras Storage → funções de quota). 45 funções no código; 32 em produção, 13 novas; 1 excluída deliberadamente. Staging primeiro.

## 9. Rollback
Cliente: reverter `CACHE_NAME` e republicar versão anterior. Funções: redeploy da versão anterior (`recuperado-producao/`) com nomes explícitos; regras: reaplicar ficheiros anteriores guardados antes do deploy; nenhuma migração a reverter. Pages: manter fonte atual até validar o artefacto.

## 10. Veredicto
**READY FOR STAGING** (com a ressalva do k3-quota intermitente por explicar). **Não** READY FOR PRODUCTION: faltam validações críticas em staging e condições legais/operacionais.
