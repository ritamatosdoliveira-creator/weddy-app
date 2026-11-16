# Documento 7 — Plano de proteção da Weddy Couples

Objetivo: a Couples continua a funcionar exatamente como hoje. Este documento lista **tudo** o que a Planning pode tocar, porquê, e como se prova que nada regrediu.

## 1. Ficheiros que podem precisar de alteração

| Ficheiro | Fase | Alteração | Efeito nos casais sem planner |
|---|---|---|---|
| `firestore.rules` | 1 | (a) bloquear a escrita do campo `planningLink` pelo cliente no `update` de `weddings`; (b) leitura por grant em `weddingPlannerViews` e `weddings/{id}/shared`; (c) blocos novos (`organizations`, `planningInvites`, `conversations`) | Nenhum: o campo não existe hoje; os blocos novos não se aplicam aos caminhos atuais |
| `storage.rules` | 1/4 | Blocos novos (`organizations/`, `conversations/`, `exports/`) | Nenhum |
| `firebase.json` | 1 | Nova codebase `planning` (funções num diretório próprio) | Nenhum: a codebase `default` (`index.js`) não muda |
| `scripts/build-public.js` | 2/3 | Acrescentar `/planning/` e `/aceitar/` | Nenhum |
| `index.js` | 3 | **Só se necessário**: `deleteWeddingAccount` e `revokeDownloadTokensOnOwnerRemoval` passam a terminar a ligação profissional | Nenhum (só atua se existir `planningLink`) |
| `app/index.html` + `app/sw.js` | **4 (única exceção)** | Ícone de Conversations junto às notificações, badge de não lidas, ecrã da conversa, subscrição de leitura; versão de cache | Ícone **não aparece** sem ligação ativa |
| `rsvp.html`, `memorias.html`, `convite.html`, `site.html`, `weddysite.js`, `weddyinvite*.js`, `convites8/` | — | **Nenhuma** | — |

Tudo o resto da Planning vive em ficheiros novos: `planning/` (app), `planning/functions/` (servidor), `aceitar/` (página do convite), `docs/planning/`, `tests/planning/`.

## 2. Serviços partilhados

| Serviço | Uso pela Planning | Proteção |
|---|---|---|
| Firebase Auth | Mesmas contas | Sem custom claims nem alteração de providers; email verificado continua obrigatório |
| `weddings/{id}` | Leitura via projeção; escrita via callable por chave de topo | Nunca escreve `ownerEmails`, `subscription`, `creatorEmail`; nunca escreve dados próprios no `json` |
| `weddings/{id}/activity` | Regista alterações do planner (`actor:'planner'`) | Mesmo formato existente |
| `validateWeddingStateOnWrite` | Valida também as escritas do planner | Sem alteração; as escritas do planner passam pela mesma validação |
| Email (nodemailer/SMTP) | Convites | Mesma proteção anti-injeção; quotas próprias por organização |
| OpenAI | Weddy Intelligence | Quotas separadas por organização (`aiUsage` próprio) para não consumir a quota dos casais |
| Premium (Stripe/RevenueCat) | Não usado | O acesso profissional e Conversations **não** dependem de Premium; nenhuma alteração ao checkout |

## 3. Regras que poderão precisar de evolução (detalhe)

1. `weddings` — `allow update`: acrescentar `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['planningLink'])` (o servidor escreve com Admin SDK). Testar que todas as escritas atuais da app continuam aceites (`rules-state`, `rules-hardening`, `rules-premium`, `ui-*`).
2. `weddings` — `allow read`: **não muda** (o planner lê pela projeção, não pelo documento).
3. Novas coleções: negação por omissão, testes de acesso cruzado.

## 4. Alterações permitidas para Conversations (Fase 4)

Exatamente as da regra 1.3 do pedido:
- Ícone de mensagens junto ao sino no cabeçalho do Início (`.home-header-v2`), mesmo estilo dos botões redondos existentes (`.home-icon-btn`).
- Visível **só** se `planningLink.status=='active'` e o utilizador for participante. Convite pendente, relação terminada, casal sem planner (com ou sem Premium): sem ícone, sem espaço reservado, sem ícone bloqueado.
- Badge discreto com não lidas **do próprio utilizador**.
- Toque abre a conversa do casamento (ecrã sobreposto, padrão das notificações A.2).
- Serviços: subscrição a `conversations/{weddingId}/reads/{uid}` e mensagens; textos PT/EN em `APP_I18N`.
- Isolado num bloco próprio, com feature flag (desligado por omissão até à aprovação), sem alterar outras secções.

## 5. Testes de regressão

Antes e depois de cada alteração relevante:
1. **Suite completa existente** (`node tests/run-all.js`): 50 de servidor/regras + 26 de interface, incluindo `qa-p1p2` (98 casos funcionais) e `ui-sweep` (390/768/1360 × PT/EN). Resultado de referência a 16/11: 74/76 (as 2 exceções estão documentadas e são pré-existentes).
2. **Novos testes de não regressão**:
   - Casal sem planner: documento `weddings` sem `planningLink` → app idêntica (snapshot do DOM do Início: nenhum ícone novo).
   - Casal tenta escrever `planningLink` → recusado; todas as outras escritas atuais → aceites.
   - Fusão a três vias: casal e planner editam chaves diferentes ao mesmo tempo → ambos preservados; mesma chave → comportamento documentado.
   - `deleteWeddingAccount` com e sem ligação profissional.
   - Tamanho do `json` não cresce com a Planning (a Planning não grava lá dados próprios).
3. **Comparação com a app publicada**: as suites de interface correm também contra `origin/main:app/index.html` (`WEDDY_APP_HTML`) para distinguir regressões de problemas pré-existentes.

## 6. Garantias de não regressão

- Nenhum ficheiro da Couples é alterado nas Fases 1–3, exceto regras (com testes) e configuração.
- A única alteração visual na Couples (Fase 4) fica atrás de uma condição que é falsa para todos os casais atuais.
- Nenhuma migração de dados; nenhum campo existente muda de significado.
- Publicação só pelos scripts (`publicar-regras.sh`, `publicar-funcoes.sh`), por nome de função, com confirmação `PUBLICAR`. Nenhum deploy sem autorização expressa.
- Cada fase termina com relatório de testes e aguarda aprovação.
