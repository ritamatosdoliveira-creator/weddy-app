# Documento 3 — Arquitetura técnica (proposta)

Princípio: **um casamento — uma fonte de dados — duas experiências**. Os nomes de coleções abaixo partem do esquema auditado (Documento 1). Nada disto foi implementado.

## 1. Visão geral

```
                    ┌────────────────────── Weddy Core (Firebase weddy-app-bd12f) ──────────────────────┐
                    │ Auth · Firestore · Storage · Functions (codebase "default" + nova "planning")      │
                    │                                                                                   │
 Weddy Couples ───► │ weddings/{id}  (ownerEmails, json, settings, subscription)  ◄── fonte única        │
 app/index.html     │      + planningLink (novo, só servidor)                                            │
 (inalterada,       │      └─ grants/{uid}   (novo, só servidor) — acesso profissional por pessoa        │
  exceto Conv.)     │ weddingPlannerViews/{id}  (novo, projeção filtrada para o planner)                 │
                    │ conversations/{weddingId} (novo)                                                    │
 Weddy Planning ──► │ organizations/{orgId} + subcoleções (novo, isolado por organização)                │
 /planning/         │ planningInvites/{id} (novo, só servidor)                                            │
                    └───────────────────────────────────────────────────────────────────────────────────┘
```

- **Mesmo projeto Firebase**, mesma autenticação (uma pessoa pode ser noiva numa conta e planner noutra, ou ambas).
- **Codebase de funções separada** (`planning/functions/`, declarada em `firebase.json` como `codebase: "planning"`): nada da Planning entra no `index.js` atual. Publicação por nome de função, como hoje.
- **App Planning separada** em `/planning/` (HTML/JS próprios), sem tocar em `app/index.html`. Partilha tokens visuais e serviços de baixo nível (cliente Firebase, i18n) por cópia controlada, não por dependência da app do casal.

## 2. Organizações (multi-tenant)

```
organizations/{orgId}
  name, slug, country, locale, currency, vatDefaults, branding{logoPath, accent}, createdAt
  plan: { tier: 'pilot'|'solo'|'studio'|'agency', limits:{members, activeWeddings, storageGB} }   ← preparado, sem cobrança
  status: 'active'|'suspended'
organizations/{orgId}/members/{uid}
  email, displayName, role: 'owner'|'admin'|'planner'|'coordinator'|'assistant',
  permissions: { sections:{crm:'edit'|'view'|'none', finance:..., ...} },  status, invitedAt, joinedAt
organizations/{orgId}/clients/{clientId}         casal enquanto cliente (antes/depois de existir conta Weddy)
organizations/{orgId}/leads/{leadId}             pipeline: stage, source, desiredDate, venue, guestsEst, budgetEst, lostReason
organizations/{orgId}/proposals/{id}/versions/{v} linhas, extras, custos internos, margem, IVA, condições, estado
organizations/{orgId}/contracts/{id}              modelo, campos, versão, estado de assinatura, prova
organizations/{orgId}/weddings/{weddingId}        ficha PROFISSIONAL do casamento (interna): serviço, equipa, template, honorários
organizations/{orgId}/weddings/{weddingId}/tasks|notes|timeEntries|runSheet|approvals|documents
organizations/{orgId}/suppliers/{id} · venues/{id} · templates/{id} · questionnaires/{id}
organizations/{orgId}/finance/{...}               plano de pagamentos, recebimentos, custos (registo de gestão, não fiscal)
organizations/{orgId}/auditLog/{id}               append-only, só servidor
```

Regras: **todas** as leituras exigem `members/{request.auth.uid}` ativo na mesma `orgId` do caminho; escrita de `role`, `permissions`, `status`, `plan` e `auditLog` **só pelo servidor**. O isolamento vem do próprio caminho (`organizations/{orgId}/...`): não há consultas entre organizações.

## 3. Ligação organização ↔ casamento (SAME)

O casamento continua a ser `weddings/{weddingId}` do casal. Não se cria um segundo.

```
weddings/{weddingId}.planningLink   (novo; escrito só pelo servidor; regras impedem o casal de o alterar)
  { orgId, status: 'pending'|'active'|'ended', since, endedAt, sharing: {guests:'edit'|'view'|'hidden', budget:..., ...} }
weddings/{weddingId}/grants/{uid}    (novo; só servidor)
  { orgId, role, sections:{...}, status:'active'|'revoked', grantedBy, at }
```

- **Planner nunca entra em `ownerEmails`** (seria dono total e poderia remover o casal).
- `grants/{uid}` dá acesso **por pessoa** (ABAC por casamento): a Planning atribui membros da equipa a casamentos; o servidor cria/revoga os grants. As regras fazem uma verificação O(1): `exists(grants/{uid})` + `status=='active'` + `planningLink.status=='active'`.
- `sharing` é o consentimento do casal por secção (padrão de mercado em PT, como no Journey 2 Yes). Valor por omissão aceite no convite.
- **Fim da relação**: o servidor põe `planningLink.status='ended'` e revoga todos os grants. O casal mantém tudo; a organização mantém só o que é seu (ficha profissional, faturação, contratos), por obrigação legal; conversas ficam arquivadas e acessíveis ao casal.

## 4. Como o planner lê e escreve os dados do casal

O `json` é um campo único; as regras não conseguem filtrar secções. Por isso:

| Operação | Mecanismo | Porquê |
|---|---|---|
| Ler | `weddingPlannerViews/{weddingId}` — **projeção** gerada por trigger `onDocumentWritten(weddings/{id})` com só as secções que o `sharing` permite. Regras: lê quem tem grant ativo | Tempo real sem expor secções escondidas; sem alterar o modelo do casal |
| Escrever | Callable `planningUpdateWeddingSection({weddingId, section, patch, baseRev})` → valida grant + `sharing[section]=='edit'` + esquema → transação por **chave de topo** no `json` | Compatível com a fusão a três vias do cliente Couples (Doc. 1 §5) |
| Ver o que mudou | Entrada em `weddings/{id}/activity` com `actor: 'planner'` | O casal vê quem alterou |

Conflitos: se o casal tiver a mesma chave "suja" localmente, a versão dele prevalece ao gravar. Mitigação: `baseRev` (revisão por secção guardada na projeção) e aviso ao planner quando a secção mudou desde a leitura; testes de concorrência obrigatórios (Fase 3).

## 5. Visibilidade (3 níveis)

| Nível | Onde vive | Quem vê |
|---|---|---|
| PARTILHADO | `weddings/{id}.json` (dados do casal) e `conversations` | Casal + planner com grant |
| INTERNO | `organizations/{orgId}/weddings/{id}/...` (notas, tarefas internas, margens, horas) | Só membros da organização com permissão. **Nunca** no `json` do casal |
| PARTILHA CONTROLADA | rascunho em `organizations/...`; ao **publicar/aprovar**, o servidor copia para `weddings/{id}/shared/{itemId}` (novo) | Casal só depois da publicação |

Como o interno vive num caminho diferente, um erro de interface não consegue mostrá-lo ao casal: as regras negam a leitura.

## 6. Convites e associação dos noivos

```
planningInvites/{inviteId}   (só servidor)
  orgId, weddingId|null, clientId, email (normalizado), role:'couple_owner'|'couple_partner'|'couple_member',
  tokenHash (SHA-256 de 32 bytes aleatórios), expiresAt (ex.: 14 dias), status:'pending'|'accepted'|'expired'|'revoked',
  attempts, createdBy, acceptedBy, acceptedAt
```

Fluxo:
1. Planner cria o convite (callable `planningCreateInvite`): rate limit por organização; email enviado pelo servidor (reutiliza o envio com anti-injeção existente). O token só existe no link; guarda-se o hash.
2. O link abre `/aceitar/` (página pública nova, **fora** de `app/index.html`). Sem sessão → entrar ou criar conta (os mesmos métodos da Couples); email tem de estar verificado.
3. Callable `planningAcceptInvite({inviteId, token})`: compara hash em tempo constante, verifica validade, estado, utilização única e **email da conta = email convidado** (convites separados por noivo); máximo de tentativas.
4. Dois casos:
   - **Casamento criado pelo planner** (casal sem conta ou sem casamento): o servidor cria `weddings/{id}` com `ownerEmails=[email do noivo]` e `creatorEmail` = noivo (o casal é dono desde o início; o planner não é dono).
   - **Casal já tem casamento na Couples**: o convite é um pedido de ligação; aceitar = dar consentimento e escolher a partilha. O casamento existente recebe `planningLink`.
5. `planningLink.status='active'`, grants da equipa criados, evento em `auditLog`. O casamento aparece na Couples porque o email do noivo está em `ownerEmails` — **sem alterar a app**.

## 7. Permissões (RBAC + ABAC)

- **RBAC (organização)**: owner > admin > planner > coordinator > assistant. Matriz de omissão por secção (CRM, propostas, contratos, finanças, equipa, definições, casamentos), editável pelo owner/admin.
- **ABAC (casamento)**: grant por pessoa e casamento × consentimento `sharing` do casal × papel. Ex.: assistente com grant no casamento X pode editar `daySchedule` se `sharing.daySchedule=='edit'` e o papel tiver `weddings.timeline:'edit'`.
- **Casal**: Couple Owner/Partner = `ownerEmails` (como hoje). Couple Member (ex.: mãe da noiva) — **não existe hoje**; propor como fase posterior para não alterar a Couples.
- Ninguém altera o próprio papel: `role/permissions` só pelo servidor; callables verificam também o papel de quem concede.
- Operações sensíveis registadas em `auditLog`: convites, aceitação, grants, mudança de papel, fim de relação, exportações, aprovações, alterações financeiras.

## 8. Weddy Conversations

```
conversations/{weddingId}                 orgId, participants:{uid:{kind:'couple'|'planner', since}}, status, lastMessageAt
conversations/{weddingId}/messages/{id}   authorUid, text, replyTo, attachments[], decision{type,label}|null,
                                          createdAt, editedAt, revisions[] (texto anterior), deleted:false (nunca apagadas)
conversations/{weddingId}/reads/{uid}     lastReadAt, unread (contador por pessoa)
conversations/{weddingId}/exports/{id}    pedidoPor, filtros, nMensagens, nAnexos, versão, storagePath, sha256, criadoEm
Storage: conversations/{weddingId}/{messageId}/{ficheiro}   · exports/{weddingId}/{exportId}.pdf|.zip
```

- Criada pelo servidor quando `planningLink` passa a `active`. Acesso: casal (`ownerEmails`) **só se** a ligação estiver ativa + planners com grant e permissão de conversas. Ligação terminada → só leitura para o casal (histórico), sem acesso do planner.
- Mensagens criadas pelo cliente com regras estritas (autor = `request.auth.uid`, tamanho, sem campos extra); edição só do próprio texto, com revisão guardada por trigger; **sem eliminação**.
- Leitura **individual**: cada pessoa escreve só o seu `reads/{uid}`. Contadores de não lidas por trigger.
- Decisões e "mensagem → tarefa" por callable (cria a tarefa em `organizations/.../tasks` com referência à mensagem).
- Exportação PDF/ZIP por callable assíncrona: gera no servidor, guarda em Storage privado, regista checksum, devolve URL assinado de curta duração. Texto integral, sem resumos. Aviso explícito: não é assinatura digital qualificada.
- **Notificações push**: não existe FCM hoje. Proposta: Firebase Cloud Messaging (web push + APNs via Capacitor) só para Conversations, com consentimento; até lá, contador in-app e email opcional.
- Ícone na Couples: visível só se `planningLink.status=='active'` (e o casal é participante). Não depende de Premium.

## 9. Storage

Novos caminhos, todos com negação por omissão:
`organizations/{orgId}/...` (documentos internos, logótipo), `conversations/{weddingId}/{messageId}/{file}`, `exports/{weddingId}/{exportId}` (só leitura via URL assinado), `proposals/{orgId}/{proposalId}/...` (imagens da proposta pública). Tamanhos e tipos limitados; sem substituição; leitura verificada contra membership/grant/participação.

## 10. Cloud Functions (codebase `planning`)

Callables: organizações e membros, convites (criar, reenviar, revogar, aceitar), grants, `planningUpdateWeddingSection`, conversas (decisão, tarefa, exportação), propostas (publicar link, aceitar), templates (aplicar a casamento). Triggers: projeção `weddingPlannerViews`, contadores de conversas, revisões de mensagens, auditoria. Agendadas: expiração de convites, radar de riscos diário. Todas com: email verificado, membership ativa, papel/permissão, rate limit, App Check (quando ativado), registo de auditoria.

## 11. Alterações necessárias no que existe (mínimas)

| Ficheiro | Alteração | Motivo |
|---|---|---|
| `firestore.rules` | (a) proteger `planningLink` no `update` de `weddings` (casal não o pode escrever); (b) acrescentar leitura por grant a `weddings/{id}/shared` e `weddingPlannerViews`; (c) blocos novos `organizations`, `planningInvites`, `conversations` | Segurança; sem alterar o acesso atual do casal |
| `storage.rules` | Blocos novos (conversas, organizações, exportações) | Idem |
| `firebase.json` | Codebase `planning` | Isolar funções |
| `scripts/build-public.js` | Acrescentar `/planning/` e `/aceitar/` à allowlist | Publicação |
| `app/index.html` | Só na Fase 4: ícone de Conversations + ecrã da conversa | Exceção autorizada |
| `index.js` | Avaliar só: `deleteWeddingAccount` e `revokeDownloadTokensOnOwnerRemoval` devem terminar a ligação profissional | Coerência no fim de conta |

## 12. Estratégia de migração

**Nenhuma migração de dados existentes.** Todos os campos e coleções são novos e opcionais; casamentos sem `planningLink` comportam-se exatamente como hoje. A única alteração com efeito nos casamentos atuais é a proteção de `planningLink` nas regras (campo que hoje não existe).

## 13. Decisões que dependem da proprietária

1. **Base da branch**: manter `feature/weddy-planning` sobre a integração aprovada (recomendado) em vez do `main` sem backend.
2. **Tecnologia do frontend da Planning**: (A) ES modules sem build (publica como hoje, por branch) ou (B) Vite + framework leve com build em GitHub Actions (exige mudar a origem do Pages — decisão já pendente). Recomendação: **B**, porque a Planning é uma aplicação grande e desktop-first, e a mudança do Pages já é necessária para o merge do backend.
3. **Consentimento de partilha do casal**: por omissão "partilhar tudo em modo ver + editar só cronograma/fornecedores", aceite no ecrã do convite, **sem** ecrã de definições novo na Couples nesta fase (para não alterar a Couples). Alterar a partilha depois passaria por uma página fora da app ou pela Fase 4.
4. **FCM** para notificações de Conversations (nova dependência no iOS).
5. **Couple Member** (familiares) fica fora até haver necessidade, porque mexe no modelo de donos da Couples.
6. **Projeto de testes**: usar `weddy-premium-teste` para um ambiente de staging da Planning.
