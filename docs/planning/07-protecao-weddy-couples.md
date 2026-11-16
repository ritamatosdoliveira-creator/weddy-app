# Documento 7 — Plano de integração e proteção da Weddy Couples

**Versão 2.1 (16/11/2026)** — revista após a revisão da Fase 0. Legenda: **[Estado atual]**, **[Decisão aprovada]**, **[Proposta técnica]**, **[Questão pendente]** (Doc. 3 §16), **[Trabalho futuro]**.

Objetivo: a Couples continua a funcionar exatamente como hoje e **nunca depende** da Weddy Planning. Este documento lista tudo o que a Planning pode tocar, porquê, e como se prova que nada regrediu.

## 1. Garantias para o casal — [Decisão aprovada]

O casal continua a usar a Couples normalmente se:

| Situação | Comportamento garantido |
|---|---|
| Nunca usa a Weddy Planning | Nada muda; nenhum ecrã, ícone ou pedido novo |
| Recusa um convite | Nada é criado no casamento; o convite expira |
| Aceita um convite | Nenhuma secção é partilhada até o casal escolher (tudo em "Não partilhar") |
| Revoga permissões | Efeito imediato no servidor; a Couples não perde dados nem funcionalidades |
| Termina a relação profissional | Mantém todos os dados; a organização perde o acesso; conversa fica em só leitura para o casal |
| Remove o planner (ou um membro da equipa) | Idem, só para essa pessoa ou organização |
| A Planning está em baixo | A Couples não faz pedidos à Planning para funcionar |

Não são criados sistemas paralelos de convidados, mesas, orçamento, fornecedores, documentos ou outros módulos existentes: a Planning lê e (quando autorizado) escreve os dados do próprio casamento.

## 2. Ficheiros que podem precisar de alteração

| Ficheiro | Entrega | Alteração | Efeito nos casais sem ligação |
|---|---|---|---|
| `firestore.rules` | 1A–1E | **Só blocos novos**: `organizations/…`, `planningInvites`, `weddings/{id}/professionalLinks/…` (subcoleção), projeções da Planning. [Proposta técnica] **Sem alterar** os blocos existentes de `weddings`, `guests`, `memories`, etc. | Nenhum: os caminhos novos não existem para eles |
| `storage.rules` | 1B / F4 | Blocos novos (`organizations/`, `conversations/`, `exports/`). Ficheiros do casal **sem** novas regras de leitura (acesso profissional por URL assinado emitido por função) | Nenhum |
| `firebase.json` | 1A | Codebase `planning` | Nenhum (a codebase `default` / `index.js` não muda) |
| `scripts/build-public.js` | 1A / 1D | Acrescentar a app `/planning/` e a página de permissões do casal à allowlist | Nenhum |
| `index.js` | 1C | **Só se necessário**: `deleteWeddingAccount` e `revokeDownloadTokensOnOwnerRemoval` passam a terminar a ligação profissional | Nenhum (só atua se existir ligação) |
| Página de permissões do casal (nova, fora de `app/index.html`) | 1D | Ecrã de consentimento (§4) | Nenhum |
| `app/index.html` + `app/sw.js` | 1D/F3 (opcional) e **F4** | 1D/F3: um ponto de entrada discreto para a página de permissões, visível só com ligação; F4: ícone e ecrã de Conversations | Nada visível sem ligação ativa |
| `rsvp.html`, `memorias.html`, `convite.html`, `site.html`, `weddysite.js`, `weddyinvite*.js`, `convites8/` | — | **Nenhuma** | — |

Alteração em relação à v1: a proposta anterior acrescentava um campo `planningLink` ao documento `weddings/{id}` e protegia-o alterando a regra de `update` de `weddings`. Com a ligação numa subcoleção só do servidor (proposta do Doc. 3 §4, pendente de Q1/Q3), **a regra existente de `weddings` não precisaria de mudar**.

## 3. Serviços partilhados

| Serviço | Uso pela Planning | Proteção |
|---|---|---|
| Firebase Auth | Mesmas contas | Sem custom claims nem novos providers; email verificado obrigatório |
| `weddings/{id}` | Leitura por projeção protegida/funções; escrita só por função, por secção, com consentimento `read_write` (1E) | Nunca escreve `ownerEmails`, `ownerUids`, `subscription`, `creatorEmail`, `settings`; nunca grava dados próprios no `json` |
| `weddings/{id}/activity` | Regista alterações do planner (`actor:'planner'`) | Mesmo formato existente |
| `validateWeddingStateOnWrite` | Valida também as escritas do planner | Sem alteração |
| Email (SMTP) | Convites | Mesma proteção anti-injeção; quotas por organização |
| OpenAI | Weddy Intelligence / Compare pelo planner | Quotas por organização (não consome a do casal) |
| Premium | Não usado | Acesso profissional e Conversations **não** dependem de Premium |

## 4. Gestão de permissões pelo casal — [Decisão aprovada] desde a primeira integração

- Existe a partir da **entrega 1D** (a primeira em que a organização pode ler dados). Na 1C a ligação existe mas não dá acesso a nenhum dado.
- [Proposta técnica] Implementada como **página própria** (ex.: `/permissoes/`), com o mesmo login da Couples, **fora de `app/index.html`**: acessível pelo link do convite aceite e pelos emails de pedido de acesso. Assim a 1D não obriga a alterar a app do casal.
- [Questão pendente] Ponto de entrada dentro da Couples (Definições → "Planner e permissões"), visível só com ligação. É uma alteração mínima e isolada, mas é uma alteração à Couples: requer aprovação.
- Conteúdo: secções com **Não partilhar / Consultar / Consultar e editar** (por omissão "Não partilhar"); pedidos de acesso pendentes; equipa da organização com acesso (e revogar uma pessoa — [Questão pendente]); "Terminar ligação"; histórico.
- Regras: só donos do casamento alteram, verificado no servidor; o planner não consegue alterar por nenhuma via; efeito imediato.

## 5. Regras: o que muda e o que não muda

1. `weddings` — `allow read` e `allow update`: **não mudam**.
2. `weddings/{id}/professionalLinks/{orgId}` e subcoleções: escrita só pelo servidor; leitura pelo casal (dono) e por membros da organização com grant ativo.
3. Projeções da Planning: leitura condicionada à autorização atual (consentimento + grant + ligação + membership), nunca à projeção em si.
4. Coleções novas da organização: negação por omissão; testes de acesso cruzado.

## 6. Alterações permitidas na Couples

| Alteração | Quando | Condição |
|---|---|---|
| Ponto de entrada para as permissões | 1D/F3, **se aprovado** | Só com ligação existente; nada visível sem ligação |
| Ícone de Conversations junto às notificações, badge de não lidas, ecrã da conversa | F4 | Só com ligação ativa; não depende de Premium; convite pendente ou relação terminada = sem ícone |
| Qualquer outra | — | Não prevista; precisa de justificação técnica e aprovação |

Todas isoladas num bloco próprio, com feature flag desligada por omissão, PT/EN em `APP_I18N`, sem alterar outras secções.

## 7. Testes de regressão

Antes e depois de cada entrega:
1. **Suite completa existente** (`node tests/run-all.js`): 50 de servidor/regras + 26 de interface, incluindo `qa-p1p2` (98 casos) e `ui-sweep`. Referência a 16/11: 74/76 (2 exceções pré-existentes documentadas).
2. **Novos testes de não regressão**:
   - Casal sem ligação: nenhum ecrã, ícone ou pedido novo (snapshot do DOM do Início).
   - Todas as escritas atuais da app continuam aceites (regras de `weddings` inalteradas).
   - Convite recusado/expirado: casamento intacto.
   - Ligação aceite sem consentimento: o planner não lê nada; a Couples igual.
   - Revogação e fim da relação: a Couples continua a ler e escrever normalmente; conversa só leitura.
   - Fusão a três vias: casal e planner em chaves diferentes → ambos preservados; mesma chave → comportamento documentado.
   - `deleteWeddingAccount` com e sem ligação.
   - O `json` não cresce com dados da Planning.
3. **Comparação com a app publicada** (`WEDDY_APP_HTML`) para separar regressões de problemas pré-existentes.

## 8. Garantias de não regressão

- Fases 1A–1C: nenhum ficheiro da Couples alterado (só regras novas e configuração).
- 1D: a página de permissões é nova e separada; o ponto de entrada na app só com aprovação.
- F4: a única alteração visual prevista fica atrás de uma condição falsa para todos os casais sem ligação.
- Nenhuma migração de dados; nenhum campo existente muda de significado.
- Publicação só pelos scripts (`publicar-regras.sh`, `publicar-funcoes.sh`), por nome de função, com confirmação `PUBLICAR`. Nenhum deploy sem autorização expressa.
- Cada entrega termina com relatório de testes e aguarda aprovação.
