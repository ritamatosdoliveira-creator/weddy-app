# Documento 3 — Arquitetura técnica

**Versão 2.3 (16/11/2026)** — regista a decisão Q0 (identidade do casal, §8.1–8.2), a verificação P4 e as ressalvas da auditoria à R0. A direção estratégica está aprovada; **a arquitetura técnica tem aprovação condicionada** às questões Q1–Q8 da §16. Nada deste documento está implementado.

Legenda usada em todo o documento:
**[Estado atual]** o que existe hoje (ver Documento 1) · **[Decisão aprovada]** decidido pela proprietária · **[Proposta técnica]** recomendação, ainda não aprovada · **[Questão pendente]** exige decisão (§16) · **[Trabalho futuro]** fora da Fase 1.

Princípio: **um casamento — uma fonte de dados — duas experiências.**

## 1. Componentes e fronteiras

| Componente | O que é | Estado |
|---|---|---|
| **Weddy Core** | Infraestrutura partilhada: Firebase Auth, Firestore, Storage, Cloud Functions, regras, serviços de email, IA, pagamentos | [Estado atual] existe (projeto `weddy-app-bd12f`) |
| **Weddy Couples** | App do casal (`app/index.html`, iOS/Android), páginas públicas (RSVP, convites, website, Memories) | [Estado atual] existe e tem utilizadores; continua **autónoma** |
| **Weddy Planning** | App profissional independente em `/planning/` | [Decisão aprovada] app independente, **React + Vite + shadcn/ui** com tema próprio (`DESIGN.md`) |
| **Serviços partilhados** | Autenticação, envio de email com anti-injeção, registo de incidentes, IA com `store:false`, validação do estado | [Estado atual] no `index.js`; a Planning reutiliza por chamada, não por cópia |
| **Funções da Planning** | Codebase `planning` separada em `firebase.json` | [Decisão aprovada] codebase separada; [Proposta técnica] diretório `planning/functions/` |

Regras de fronteira [Decisão aprovada]:
- A Couples **não depende** da Planning: sem ligação profissional, tudo funciona como hoje; nenhuma chamada da Couples falha se a Planning estiver em baixo.
- A Planning **não duplica** convidados, mesas, orçamento, fornecedores do casal, documentos, Memories, convites ou website: lê e (quando autorizado) escreve os dados existentes do casamento.

## 2. Três categorias de dados

| Categoria | Dono | Onde vive | Quem acede | Estado |
|---|---|---|---|---|
| **Dados do casal** | O casal (sempre) | `weddings/{id}` (`json`, `settings`), `guests/{token}`, `memories`, `documents/{id}/…`, `weddingSites`, `weddingInvitations` | Casal; a organização **só** nas secções que o casal autorizou | [Estado atual] estrutura existente, sem alterações |
| **Dados internos da organização** | A organização | `organizations/{orgId}/…` (leads, clientes, propostas, contratos, notas, tarefas internas, horas, margens, fornecedores da organização) | Membros autorizados da organização; **nunca** o casal | [Proposta técnica] coleções novas |
| **Dados partilhados mediante consentimento** | O casal (origem) | Os próprios dados do casal, expostos à organização por secção e nível; eventualmente uma projeção de leitura derivada (§6) | Organização, enquanto o consentimento estiver ativo | [Proposta técnica] |
| **Conteúdo publicado pela organização ao casal** | A organização (autor), visível ao casal | [Proposta técnica] `weddings/{id}/shared/{itemId}` (propostas aprovadas, cronogramas publicados) | Casal + organização ligada | [Trabalho futuro] |

Regra: os dados internos **nunca** são escritos no `json` do casal. O `json` não tem permissões por secção nas regras (é um único campo), por isso a separação faz-se por caminho, onde as regras conseguem negar.

## 3. Organizações (multi-tenant) — [Proposta técnica]

```
organizations/{orgId}                     name, slug, locale, currency, branding, status, plan{tier, limits} (preparado, sem cobrança)
organizations/{orgId}/members/{uid}       email, role, permissions, status: invited|active|suspended|removed, since, by
organizations/{orgId}/memberInvites/{id}  convites internos (hash do token, validade, estado)
organizations/{orgId}/leads/{leadId}      ciclo comercial (§9)
organizations/{orgId}/clients/{clientId}  cliente contratado (§9)
organizations/{orgId}/weddings/{weddingId}  ficha PROFISSIONAL (interna) ligada ao casamento do casal
organizations/{orgId}/…                   proposals, contracts, suppliers, venues, templates, finance, timeEntries
organizations/{orgId}/auditLog/{id}       só servidor, append-only
```
Isolamento: toda a leitura exige `members/{request.auth.uid}.status == 'active'` na mesma `orgId` do caminho; `role`, `permissions`, `status`, `plan` e `auditLog` são escritos **só** pelo servidor.

## 4. Relação profissional entre organização e casamento

[Questão pendente] **uma ou várias organizações ativas por casamento** (Q1, §16). Até à decisão, o modelo descreve-se de forma neutra:

```
weddings/{weddingId}/professionalLinks/{orgId}       (só servidor)
  status: pending | active | ended, createdAt, acceptedBy, acceptedAt, endedBy, endedAt, endReason
weddings/{weddingId}/professionalLinks/{orgId}/consent/current   (escrito via função chamada pelo CASAL)
  sections: { <secção>: 'none' | 'read' | 'read_write' }, version, updatedBy, updatedAt
weddings/{weddingId}/professionalLinks/{orgId}/grants/{uid}       (só servidor)
  role, status: active | revoked, grantedBy, at
```
- Com a opção A (uma só organização), o mesmo modelo funciona com um único documento ativo; a regra "no máximo um `active`" é aplicada na transação de aceitação.
- O desenho anterior (`weddings/{id}.planningLink`, campo no documento do casamento) fica **substituído por esta proposta**, porque: (1) uma subcoleção serve as duas opções da Q1; (2) não acrescenta campos ao documento que a Couples grava; (3) não exige alterar a regra de `update` de `weddings`.
- O planner **nunca** entra em `ownerEmails` (teria acesso total e poderia remover o casal — Doc. 1 §5).

## 5. Consentimento do casal e permissões por secção — [Decisão aprovada] nos princípios, [Proposta técnica] no modelo

Princípios **[Decisão aprovada]**:
1. O casal é sempre o proprietário dos dados.
2. Três estados por secção: **Não partilhar** (`none`), **Consultar** (`read`), **Consultar e editar** (`read_write`).
3. **Todas as secções começam em "Não partilhar"**; aceitar o convite **não** partilha nada.
4. O casal escolhe afirmativamente; pode alterar a qualquer momento; pode revogar o acesso profissional por completo.
5. A **ausência de configuração** de uma secção significa **acesso negado**.
6. O planner **não pode** atribuir nem alterar permissões em nome do casal (a função de consentimento só aceita pedidos da **raiz do casamento ou de um delegado registado pela raiz**, verificado no servidor — §8.1).
7. A revogação é aplicada **no servidor**, não só na interface.
8. A interface de gestão de permissões existe **desde a primeira integração** com a Couples (pode começar fora da navegação principal — ver Doc. 7).

Secções propostas [Proposta técnica] (mapeiam as chaves de topo existentes do `json`, Doc. 1 §5): `guests` (convidados, RSVP, `confirmed`), `seating`, `budget` (`budget`, `categories`, `expenses`, `payments`), `suppliers`, `compares`, `daySchedule` (programa do dia), `todos` (tarefas e checklists), `design` (`stationery*`, `cake`, `dressStyle`), `documents` (`weddingDocuments` + Storage `documents/`), `memories`, `website`, `invitations`. **Sempre excluídas** (não partilháveis nesta fase): `vows`, `honeymoon`, `checklistPersonal`, `dressVisits` (privacidade pessoal) — [Questão pendente] Q8.

Pedidos de acesso a secções não autorizadas [Proposta técnica]:
- O planner pode **pedir** acesso a uma secção (`accessRequests/{id}` sob a ligação: secção, nível pedido, motivo, estado `pending|accepted|declined|expired`).
- O casal vê o pedido no ecrã de permissões e decide; **nada muda até o casal aceitar**. Recusar não tem efeito colateral; pedidos repetidos têm limite (ex.: 1 pendente por secção, 3 por semana).
- Na Planning, uma secção não autorizada aparece como "Não partilhada pelo casal", sem conteúdo nem contagens.

## 6. Leitura pelo planner: autorização no servidor, projeção só como cache — [Decisão aprovada] nos princípios

Princípios **[Decisão aprovada]**:
- A **fonte de autoridade** das permissões é o consentimento (`consent/current`) + o estado da ligação + o grant do utilizador + a membership — **nunca** uma projeção.
- Triggers do Firestore são assíncronas, podem atrasar ou falhar: a autorização é verificada **no servidor em cada operação sensível**.
- Uma projeção desatualizada **nunca** pode dar acesso a dados revogados; a revogação tem efeito imediato.
- As projeções são **reconstruíveis** e nunca substituem os dados originais.

Opções de leitura [Questão pendente] Q4:

| Opção | Como | Revogação | Custo/latência |
|---|---|---|---|
| **R1. Só funções** | Callable `planningReadSection({weddingId, section})` verifica a autorização atual e devolve a secção lida do `json` | Imediata por construção | Uma chamada por leitura; sem tempo real |
| **R2. Projeção protegida por regras que leem a autorização** | `plannerViews/{weddingId}_{orgId}/sections/{section}` gerada por trigger; a **regra** de leitura verifica, no momento, `consent/current.sections[section] in ['read','read_write']` + `grants/{uid}.status=='active'` + `professionalLinks/{orgId}.status=='active'` + membership ativa | Imediata: a regra lê a autorização atual, mesmo que a projeção ainda tenha dados antigos | Tempo real; 3–4 `get()` por leitura nas regras |
| **R3. Híbrida** | R2 para leitura em tempo real + R1 para operações sensíveis (exportações, IA, documentos) | Imediata | Recomendada |

**Recomendação técnica (pendente de Q4): R3.** Uma projeção por secção (não um documento único) para que retirar uma secção não exija reescrever as outras.

Sincronização, invalidação e falhas [Proposta técnica]:
- **Geração**: trigger `onDocumentWritten(weddings/{id})` compara a revisão por chave de topo e reescreve só as secções alteradas e autorizadas; cada documento de projeção guarda `sourceRev` e `generatedAt`.
- **Invalidação na revogação**: a função de consentimento, na mesma operação, (1) grava o novo consentimento (efeito imediato pelas regras), (2) apaga as projeções das secções que deixaram de estar autorizadas, (3) incrementa `consent.version`. Se o passo 2 falhar, os dados ficam inacessíveis na mesma (regras) e um processo de reconciliação apaga-os.
- **Reconciliação**: tarefa agendada (ex.: a cada hora) compara projeções com consentimento e `sourceRev`; reconstrói ou apaga. Também disponível a pedido (função de reconstrução por casamento).
- **Triggers falhadas/atrasadas**: idempotentes (chave = `weddingId + sourceRev`), com repetição; a interface mostra "a atualizar" quando `sourceRev` da projeção < revisão atual conhecida.
- **Cache no cliente**: o SDK pode manter cópias locais; ao receber `permission-denied` num listener, a app apaga a cache dessa secção e esconde-a. Leituras offline da Planning ficam **desativadas** para dados do casal.

## 7. Escrita pelo planner — [Proposta técnica] (Fase 1E)

- Só por função: `planningUpdateSection({weddingId, orgId, section, patch, baseRev})`.
- Verificações no servidor, nesta ordem: autenticação + email verificado → membership ativa → papel permite editar a secção → grant ativo no casamento → ligação ativa → `consent.sections[section]=='read_write'` → `baseRev` atual → validação do esquema da secção → transação por **chave de topo** no `json` (compatível com a fusão a três vias da Couples, Doc. 1 §5).
- Escrita registada em `weddings/{id}/activity` (`actor:'planner'`, organização, utilizador) e em `auditLog`.
- Conflito: se `baseRev` estiver desatualizado, a função recusa e devolve a versão atual; a Planning mostra as diferenças. Edições do casal na mesma chave continuam a prevalecer quando o casal grava com a chave "suja" (risco documentado, testes na Fase 1E).

## 8. Aceitação de convites e verificação de propriedade — [Decisão aprovada] nos requisitos

```
planningInvites/{inviteId}   (só servidor)
  orgId, kind: 'link_existing_wedding' | 'new_wedding', weddingId|null, clientId, email (normalizado),
  tokenHash (SHA-256 de 32 bytes aleatórios), expiresAt, status: pending|accepted|expired|revoked,
  attempts, createdBy, acceptedBy, acceptedAt
```

Validação na função `planningAcceptInvite({inviteId, token, weddingId?})`, toda no servidor e numa transação:
1. Utilizador autenticado, email verificado.
2. Convite existe, `status=='pending'`, não expirado, não revogado, tentativas abaixo do limite (rate limit por utilizador e por convite).
3. Hash do token igual (comparação em tempo constante); utilização única (estado passa a `accepted` na mesma transação).
4. Email da conta = email convidado (normalizado). [Questão pendente] tratamento de contas Apple com email privado (relay).
5. **Propriedade real do casamento**: o servidor lê `weddings/{weddingId}` e confirma que quem aceita é **raiz válida ou delegado registado** (§8.1). Estar em `ownerEmails`/`ownerUids` **não basta**; conhecer o ID do casamento, o email ou o token também não.
6. Organização de destino ativa; o casamento indicado coincide com o do convite (quando o convite o fixa).
7. Relações existentes: se já existir ligação ativa com esta organização → idempotente (sem duplicar); se existir ligação ativa com **outra** organização → depende de Q1 (opção A: recusar com mensagem clara; opção B: permitir, com consentimento independente).
8. Resultado: cria `professionalLinks/{orgId}` com `status:'active'` e `consent/current` com **todas as secções em `none`**; regista em `auditLog`. O planner continua sem ver dados até o casal escolher o que partilha.

Caso "casamento novo criado pelo planner" (`kind:'new_wedding'`): o servidor só cria o casamento **depois** de o noivo aceitar, com `ownerEmails=[email do noivo]` e `creatorEmail` = noivo; o casal é dono desde o início. [Questão pendente] Q2 sobre como a ficha interna da organização se associa a este casamento antes de ele existir.

### 8.1 Identidade do casal — [Decisão aprovada em 16/11/2026] Q0: raiz de confiança + delegação registada

**Factos verificados (código e produção):**
- `ownerEmails` contém qualquer pessoa convidada como «participante no planeamento», sem papéis nem confirmação; qualquer dono pode acrescentar qualquer email.
- `ownerUids`, `uidByEmail`, `lastLoginByEmail` e `createdAt` são escritos pelo cliente e podem ser alterados por qualquer dono; `creators/{uid}` pode ser criado por qualquer utilizador com qualquer `weddingId`. **Nenhum destes campos prova identidade.**
- `creatorEmail` é escrito pela app **apenas na criação** (`app/index.html`, criação do casamento; igual na cópia iOS).
- **P4 (verificada a 16/11/2026):** a Couples usa a base `(default)`; as regras ativas, publicadas a **10/11/2026 às 11:38**, são iguais a `firestore.rules` de `feat/convites-envio-backend` (commit `b12885c`). Nelas, `creatorEmail`, **se existir**, não pode ser alterado nem o criador retirado dos donos por outra pessoa; **se não existir, pode ser acrescentado por qualquer dono** (lacuna fechada pela R0).

**Raiz válida** (todos os critérios, verificados no servidor no momento de cada operação):
1. o casamento tem `creatorEmail`;
2. o email do token está verificado e é igual (normalizado) a `creatorEmail`;
3. `creatorEmail` continua em `ownerEmails`;
4. a pessoa não tem relação atual com a organização envolvida (`invited`, `active`, `suspended`), nem está no período de transição de 90 dias (§10), comparando `uid` e todos os emails conhecidos;
5. o casamento não tem disputa de raiz aberta.

Uma raiz confirmada por verificação assistida (§8.2) substitui os critérios 1 e 2; os critérios 3–5 mantêm-se.

**Autoridade:** só a raiz, ou um **delegado registado pela raiz** (registo escrito só pelo servidor, com quem, quando, ligação e versão; revogável pela raiz), pode aceitar a ligação, alterar o consentimento ou terminar a ligação em nome do casal. Estar em `ownerEmails` não confere autoridade. As delegações mantêm-se se a raiz sair, enquanto o delegado for dono e não estiver associado à organização.

**Proveniência dos donos:** a partir da ativação, um trigger da codebase `planning` com contexto de autenticação regista quem acrescentou cada dono. Serve **apenas** para deteção e conflitos (um dono acrescentado por um associado da organização nunca pode ser delegado; proveniência ainda não registada = desconhecida = não confiável). **Nenhuma decisão de autorização depende de triggers.** A proveniência dos donos anteriores à ativação é desconhecida.

**R0 (alteração às regras da Couples, D1):** na regra `allow update` de `weddings`, acrescentar
`&& (('creatorEmail' in resource.data) == ('creatorEmail' in request.resource.data))`.
Juntamente com a regra existente, `creatorEmail` presente fica igual e ausente continua ausente. A regra de criação **não muda nesta intervenção**. [Estado atual] Desde 05/10/2026 (commit `b13c1b5`) ela já recusa criar um casamento com `creatorEmail` diferente do email autenticado (quando o campo é enviado), e exige `ownerEmails` igual a [email próprio], `ownerUids` igual a [uid próprio] e `creators/{uid}` escrito no mesmo lote. Tornar `creatorEmail` **obrigatório** na criação é a questão separada **R0b** (§16): a evidência indica que provavelmente não partiria nenhum cliente que hoje consiga criar casamentos (as versões que escrevem `creators/{uid}`, exigido desde 05/10/2026, já gravam `creatorEmail`, presente na app desde 10/09/2026), mas a versão iOS publicada na App Store não foi verificada. [Decisão aprovada] Diff da R0 aprovado a 16/11/2026 (commit local `2b1f572` em `feat/convites-envio-backend`, suite `rules-r0` 28/28); push e publicação pendentes de autorização. Sem impacto funcional na Couples (nenhuma escrita da app acrescenta ou altera `creatorEmail`). Tem de entrar em vigor **antes** de qualquer anúncio ou disponibilização da Planning; publicação só com procedimento aprovado.

**Sem raiz válida** (sem `creatorEmail`; criador que saiu sem delegações; criador associado à organização; disputa): sem ligação self-service; verificação assistida (§8.2).

**Riscos aceites:** planner que criou o casamento com uma conta pessoal não associada (só deteção: aviso aos outros donos se o criador for membro de qualquer organização, notificações); alterações a `creatorEmail` anteriores à publicação da regra de proteção (data exata desconhecida); **casamentos criados antes de 05/10/2026**, quando a regra de criação não restringia `creatorEmail`: um cliente manipulado podia ter gravado um `creatorEmail` arbitrário (a app oficial gravou sempre o email do próprio utilizador); engenharia social sobre a raiz para obter delegações (mitigada mostrando a proveniência conhecida no ecrã de delegação). **Trabalho futuro da Couples:** papéis explícitos; corrigir `uid` arbitrário em `ownerUids` e `creators/{uid}` não verificado.

**Transparência:** o ecrã de aceitação e de permissões mostra a raiz e todos os donos; cada aceitação, delegação, alteração de consentimento e fim da ligação é comunicado por email a todos os `ownerEmails` e registado em `auditLog`.

### 8.2 Verificação assistida — [Decisão aprovada em 16/11/2026] D3; implementação só após parecer RGPD sobre as provas

- **Pedido:** só por um dono autenticado, na página de permissões; nunca pela organização.
- **Provas (minimizadas):** controlo do email (sessão); confirmação por email a todos os donos atuais com 7 dias para objeção; pelo menos uma prova não fabricável pela organização (p. ex. registo do pagamento Premium dessa conta, ou videochamada curta com o suporte); sem cópia de documentos de identificação salvo parecer que o exija.
- **Validação:** pessoal Weddy numa lista só do servidor (`weddyStaff/{uid}`, papel verificador) sem relação atual nem histórica com a organização envolvida (verificado automaticamente); com objeção, duas pessoas quando existirem.
- **Registo:** `rootVerifications/{weddingId}`, só servidor (requerente, referências das provas, verificador, `validatedAt`, versão, estado, validade), com eventos só de acrescento.
- **Revogação:** manual (verificador ou outro membro da equipa Weddy) ou automática (requerente deixa de ser dono, passa a estar associado à organização, ou outro dono abre disputa); efeito imediato.
- **Histórico:** auditável, retenção segundo Q5.

## 9. Leads, clientes e casamentos — [Proposta técnica], modelo definitivo em Q2

Ciclo: **Lead → Contacto → Reunião → Proposta → Negociação → Cliente contratado → Casamento**.

| Entidade | Onde | Relações |
|---|---|---|
| Organização | `organizations/{orgId}` | tem membros, leads, clientes |
| Membro | `…/members/{uid}` | é um Utilizador Weddy (Firebase Auth) |
| Lead | `…/leads/{leadId}` | estado do pipeline; histórico comercial |
| Cliente | `…/clients/{clientId}` | **criado a partir do lead, com `clientId = leadId`** (mesmo identificador, sem duplicar); guarda os contactos do casal enquanto pessoas da organização |
| Casal | pessoas do cliente | podem ou não ter conta Weddy |
| Utilizador Weddy | Firebase Auth | um noivo é Utilizador Weddy quando tem conta; ligação ao cliente só por aceitação de convite |
| Casamento | `weddings/{weddingId}` (do casal) | fonte única; a organização tem uma ficha interna `…/weddings/{weddingId}` |
| Relação profissional | `weddings/{weddingId}/professionalLinks/{orgId}` | liga organização ↔ casamento |
| Convite | `planningInvites/{id}` | liga cliente/organização a um utilizador e a um casamento |

Conversão lead → cliente [Proposta técnica]:
- **Idempotente**: transação que só converte se `lead.status != 'converted'`; repetir devolve o mesmo `clientId`.
- **Preserva identificadores**: `clientId = leadId`; o lead fica com `status:'converted'`, `convertedAt`, `convertedBy` (o histórico comercial mantém-se no lead).
- **Auditável**: evento em `auditLog`.
- **Reversível quando apropriado**: "desfazer conversão" só enquanto não existir convite aceite nem contrato assinado; repõe o estado anterior e regista o evento.
- **Concorrência**: a transação lê e escreve o lead; duas conversões simultâneas resultam numa só.
- **Sem duplicação de dados do casamento**: convidados, mesas, orçamento e fornecedores do casal vivem só no casamento.

## 10. Membros: remover, suspender, terminar relação, revogar acesso — [Decisão aprovada] na distinção

| Operação | Quem | Efeito imediato | O que acontece aos dados |
|---|---|---|---|
| **Remover membro da organização** | owner/admin | `members/{uid}.status='removed'`; **todos** os grants desse utilizador em todos os casamentos da organização → `revoked`; conversas, documentos, anexos e exportações deixam de lhe ser servidos; links temporários emitidos para ele invalidados; operações pendentes dele canceladas | Dados criados por ele ficam na organização (autoria preservada); nada é apagado |
| **Suspender membro** | owner/admin | `status='suspended'`: acesso negado em todas as verificações (regras e funções); grants mantêm-se mas ficam **inoperantes** enquanto suspenso | Reativação restaura o acesso sem reconfigurar grants |
| **Terminar relação profissional** (organização ↔ casamento) | casal **ou** organização (owner/admin) | `professionalLinks/{orgId}.status='ended'`; todos os grants dessa ligação revogados; projeções apagadas; conversa passa a só leitura para o casal | **Os dados do casal não são apagados**; a Couples continua igual; a organização mantém os seus dados internos (contratos, faturação) por obrigação legal |
| **Revogar acesso de um utilizador a um casamento** | owner/admin da organização (gestão da equipa) **ou** o casal (pode retirar uma pessoa específica) [Questão pendente] | `grants/{uid}.status='revoked'` só para esse casamento | Nada é apagado |

Aplicação técnica:
- **Cada operação sensível verifica a autorização atual** (membership + grant + ligação + consentimento) — nas regras e nas funções.
- **Links temporários** (exportações, ficheiros): URLs assinados de curta duração (≤ 15 min), emitidos por função **depois** de verificar a autorização; a revogação impede novas emissões e as existentes expiram depressa. Não usar `getDownloadURL` permanentes para dados do casal ou da organização.
- **Sessões e cache**: sem custom claims para permissões (evita tokens com permissões antigas até 1 h); as permissões vivem em documentos verificados a cada pedido. A app escuta o estado da própria membership e termina a sessão da organização ao detetar `removed/suspended`.
- **Histórico e período de transição (D2, [Decisão aprovada em 16/11/2026])**: `invited`, `active` e `suspended` são **relação atual** com a organização (contam como conflito de propriedade, §8.1); `removed` é **histórico**, não membership. Ao remover, o servidor escreve `members/{uid}.relationEndedAt` com `FieldValue.serverTimestamp()`; cada mudança de estado gera um evento só de acrescento em `organizations/{orgId}/memberHistory/{eventId}` (`uid`, emails conhecidos, de/para, `at` do servidor, autor). Durante **90 dias** após `relationEndedAt` a pessoa conta como associada (não pode ser raiz nem delegada dessa organização). Voltar a convidar ou ativar é relação atual (bloqueia de imediato); remover de novo escreve novo `relationEndedAt` (o prazo só recomeça mais tarde, nunca encurta); documentos de membros e histórico não se apagam. **Readmissão controlada:** convidar ou reativar é recusado enquanto a pessoa (por `uid` ou email conhecido) for raiz, delegada ou dona de um casamento com ligação atual (`pending`, `active`, `blocked`) a essa organização.
- **Operações pendentes** (exportações em curso, envios agendados): verificam a autorização no início e antes de entregar o resultado; se revogada, cancelam e registam.

## 11. Matriz de autorização

Condição base em **todos** os casos: utilizador autenticado + email verificado (+ App Check quando em enforcement, §13).

| Ação | Utilizador | Membership | Papel | Casamento / ligação | Grant | Secção / consentimento | Verificado em |
|---|---|---|---|---|---|---|---|
| Ler dados internos da organização | membro | `active` na `orgId` do caminho | conforme `permissions` | — | — | — | Regras Firestore/Storage |
| Alterar papéis/membros | owner/admin | `active` | owner/admin | — | — | — | Função (servidor) + auditLog |
| Criar convite ao casal | membro | `active` | planner+ | — | — | — | Função |
| Aceitar convite | **raiz ou delegado (§8.1)** | — | — | casamento sem conflito de propriedade (§8.1) | — | cria consentimento a `none` | Função (transação) |
| Alterar consentimento | **raiz ou delegado (§8.1)** | — | — | ligação existente | — | escreve `consent` | Função |
| Terminar a ligação (pelo casal) | **raiz ou delegado (§8.1)** | — | — | ligação `pending`/`active` | — | revoga grants | Função |
| Delegar / revogar delegação | **só a raiz (§8.1)** | — | — | ligação existente | — | — | Função |
| Ler secção do casal | membro | `active` | papel permite ler a secção | ligação `active` | `active` | `read` ou `read_write` | Regras (projeção, R2) **e** função (R1) |
| Editar secção do casal | membro | `active` | papel permite editar | ligação `active` | `active` | `read_write` | Função (transação) |
| Exportar / IA sobre dados do casal | membro | `active` | permitido | `active` | `active` | secções incluídas autorizadas | Função, no início e na entrega |
| Conversa (ler/escrever) | casal ou membro | casal: dono; membro: `active` | papel com conversas | `active` (escrita); `ended` só leitura para o casal | membro: `active` | — | Regras + funções |
| Ficheiros (anexos, documentos) | idem | idem | idem | idem | idem | `documents` autorizada para ficheiros do casal | Função emite URL assinado de curta duração |
| Casal usar a Couples | dono | — | — | indiferente | — | — | Regras existentes (inalteradas) |

O frontend **esconde** o que não é permitido, mas a segurança está nas regras e nas funções.

## 12. Ambientes e staging — [Questão pendente] Q6

[Estado atual] Existe o alias `teste: weddy-premium-teste` no `.firebaserc`. **O nome não prova isolamento.** Antes de qualquer implementação é obrigatório confirmar, por leitura e sem alterar nada:
- que projeto Firebase/GCP é efetivamente usado por cada ambiente (IDs, faturação, organização GCP);
- Firestore (dados existentes, se há dados reais copiados de produção), Authentication (utilizadores reais?), Storage (buckets e conteúdo), Cloud Functions publicadas e as suas variáveis;
- secrets (Secret Manager) — se partilham valores com produção (SMTP, OpenAI, Stripe, Meta, Google OAuth);
- ligações externas: webhooks Stripe/RevenueCat/WhatsApp, domínios autorizados no Auth, redirect URIs do Google, remetente de email;
- credenciais e permissões IAM (quem tem acesso, contas de serviço).

Requisitos de um staging **verdadeiramente isolado**: projeto próprio sem dados reais; utilizadores de teste; Stripe/RevenueCat em modo teste; SMTP para caixa de testes; WhatsApp desligado; OpenAI com chave e quota próprias; domínios e redirects próprios; regras e funções publicadas só por scripts com o alias de staging; App Check em modo debug documentado. Nesta tarefa **nada foi configurado**.

## 13. App Check — [Decisão aprovada]: obrigatório antes de operações sensíveis com utilizadores reais

[Estado atual] A Couples ativa App Check (reCAPTCHA Enterprise) em modo de **medição**; o servidor **não** exige o token; existe análise RGPD pendente sobre o reCAPTCHA (`docs/seguranca/fase-k1/ANALISE-UPLOADS-APP-CHECK-QUOTAS.md`).

Requisitos para a Planning [Proposta técnica]:
- **Serviços abrangidos**: todas as callables da codebase `planning`; Firestore e Storage acedidos pela app Planning; páginas públicas da Planning com escrita (aceitação de convite, propostas públicas, portal do fornecedor, formulários de leads).
- **Fornecedores**: web (Planning e páginas públicas) — reCAPTCHA Enterprise; iOS (se a Planning vier a ter wrapper) — App Attest; Android — Play Integrity. Tokens de debug só em desenvolvimento e staging, nunca em produção.
- **Estratégia**: (1) instrumentar em modo monitor desde o primeiro dia da Planning em staging; (2) medir a percentagem de pedidos válidos por serviço; (3) callables da Planning com `enforceAppCheck: true` **desde o início** (não há clientes antigos a proteger); (4) Firestore/Storage com enforcement quando > 99 % dos pedidos legítimos forem válidos durante um período definido; (5) considerar *replay protection* (`consumeAppCheckToken`) em operações críticas (aceitar convite, exportar, consentimento).
- **Monitorização**: métricas do App Check na consola (pedidos verificados, não verificados, inválidos) por serviço; alerta quando os inválidos sobem.
- **Clientes não autorizados**: pedido recusado com erro genérico (`unauthenticated`/`failed-precondition`), sem detalhe; registo minimizado; a app mostra "Não foi possível verificar este dispositivo; atualiza a página".
- **Critério de entrada em produção**: nenhuma operação sensível da Planning disponível a utilizadores reais sem enforcement ativo e validado em staging.
- **Impacto na Couples**: nenhum nesta fase (o enforcement da Couples é uma decisão separada).

## 14. Weddy Conversations — [Proposta técnica], Fase 4

```
conversations/{weddingId}_{orgId}            participants, status, lastMessageAt
  /messages/{id}   authorUid, text, replyTo, attachments[], decision|null, createdAt, editedAt, revisions[], sem eliminação
  /reads/{uid}     lastReadAt, unread (por pessoa)
  /exports/{id}    pedidoPor, filtros, nMensagens, nAnexos, versão, storagePath, sha256, criadoEm
Storage: conversations/{weddingId}_{orgId}/{messageId}/{ficheiro} · exports/{…}
```
(Chave por casamento **e** organização para servir as duas opções da Q1.) Acesso: casal (dono) e membros com grant ativo, enquanto a ligação estiver ativa; após o fim, só leitura para o casal. Ficheiros por URL assinado de curta duração. Push (FCM) — [Questão pendente], não existe hoje.

## 15. Storage e funções (resumo)

Storage — novos caminhos com negação por omissão: `organizations/{orgId}/…`, `conversations/…`, `exports/…`, `proposals/{orgId}/…`. Ficheiros do casal (`documents/`, `memories/`) **não** ganham regras de leitura para a organização: o acesso profissional é feito por função que verifica o consentimento e devolve URL assinado.

Funções (codebase `planning`): organizações e membros, convites internos e ao casal, aceitação, consentimento, leitura e escrita por secção, projeções e reconciliação, exportações, auditoria. Todas: verificação da autorização atual, rate limit, App Check, auditoria.

**Estratégia de migração**: nenhuma migração de dados existentes; todas as coleções são novas; casamentos sem ligação comportam-se como hoje.

## 16. Questões pendentes (decisão da proprietária)

**Estado a 16/11/2026: Q0 decidida (§8.1–8.2); Q1–Q8 continuam por decidir.** As recomendações abaixo são propostas técnicas para apoiar a decisão; **não** são decisões aprovadas e nenhuma entrega que dependa delas começa antes da decisão expressa (ver Doc. 6, coluna «Decisões necessárias»). Onde este documento usa um modelo concreto (p. ex. `professionalLinks`, `clientId = leadId`, projeções R3), trata-se da proposta em avaliação.

| Questão | Estado | Recomendação técnica (não aprovada) |
|---|---|---|
| Q0 Identidade do casal | **Decidida (16/11/2026)** — raiz de confiança + delegação registada, com D1 (R0), D2 (90 dias), D3 (verificação assistida); condição P4 verificada | — |
| Q1 Uma ou várias organizações por casamento | Pendente | Dados preparados para várias, produto com uma |
| Q2 Leads, clientes, utilizadores e casamentos | Pendente | `clientId = leadId`; ficha interna após aceitação |
| Q3 Modelo de grants e permissões | Pendente | Documentos por ligação, sem custom claims |
| Q4 Projeções e invalidação | Pendente | R3 (híbrida) |
| Q5 Retenção e auditoria | Pendente | Prazos com aconselhamento jurídico |
| Q6 Staging e prova de isolamento | Pendente | Auditar o candidato; projeto novo se houver partilha |
| Q7 Enforcement do App Check | Pendente | Callables em enforcement desde o início |
| Q8 Operações do planner por secção | Pendente | Editar sem apagar |

### Q0. Identidade do casal — DECIDIDA
Ver §8.1 e §8.2. Decisões: **D1** R0 nas regras da Couples (publicação só com procedimento aprovado e antes de qualquer anúncio da Planning); **D2** período de transição de 90 dias com readmissão controlada (§10); **D3** verificação assistida, implementação após parecer RGPD. Papéis explícitos na Couples: trabalho futuro.

### Q1. Uma ou várias organizações com relação ativa por casamento?
- **Problema**: um casal pode ter, p. ex., uma planner e uma decoradora/coordenadora do dia; ou mudar de planner.
- **A. Uma só**: simples para o casal (um ecrã de permissões, uma conversa); menos superfície de ataque; mudar de planner exige terminar a anterior. Risco: bloqueia casos reais (planner + coordenadora do dia).
- **B. Várias, com permissões independentes**: cobre todos os casos; consentimento, conversa e projeções por organização; o casal gere várias ligações. Riscos: mais complexidade de UI na Couples, mais custo de regras, maior risco de erro de isolamento entre organizações no mesmo casamento.
- **Recomendação técnica**: modelo de dados preparado para B (§4, chave por organização), **produto lançado como A** (máximo 1 ativa, aplicado na transação de aceitação). Passar a B é só retirar essa restrição e acrescentar UI.
- **Decisão necessária**: A, B, ou "dados B / produto A".

### Q2. Associação definitiva entre leads, clientes, utilizadores e casamentos
- **Problema**: o cliente existe antes da conta Weddy e, por vezes, antes do casamento.
- **Opções**: (a) `clientId = leadId` e ficha interna do casamento criada só após aceitação; (b) ficha interna criada no contrato, com `weddingId` provisório substituído na aceitação; (c) cliente como entidade separada com várias pessoas/contas.
- **Vantagens/desvantagens**: (a) simples e sem identificadores provisórios, mas o planner não planeia nada antes da aceitação; (b) permite trabalhar antes, mas exige migrar a ficha interna para o `weddingId` real (risco de duplicação); (c) mais flexível (famílias, pagadores), mais complexo.
- **Recomendação**: (a) + permitir tarefas internas no cliente antes do casamento existir; avaliar (c) na Fase 5.
- **Decisão necessária**: escolher o modelo.

### Q3. Modelo técnico de grants e permissões por secção
- **Opções**: (a) documentos por ligação (`consent/current` + `grants/{uid}`) lidos pelas regras; (b) custom claims no token; (c) tudo só em funções.
- **Prós/contras**: (a) revogação imediata, custo de 3–4 `get()` por leitura; (b) leve nas regras mas o token mantém permissões antigas até 1 h — **incompatível** com revogação imediata; (c) mais simples nas regras, sem tempo real.
- **Recomendação**: (a), com papéis da organização em `members` e consentimento por ligação.
- **Decisão necessária**: aprovar (a) e a lista de secções (§5).

### Q4. Estratégia de projeções e invalidação
- **Opções**: R1, R2, R3 (§6). **Recomendação**: R3. **Decisão**: aprovar R3 e o intervalo de reconciliação.

### Q5. Requisitos de retenção e auditoria
- **Problema**: equilibrar RGPD (minimização) e obrigações legais/contratuais da organização.
- **Opções**: retenção fixa (ex.: auditoria 2 anos, conversas enquanto a ligação existir + N anos para o casal), ou configurável por organização dentro de limites.
- **Riscos**: retenção longa = mais dados pessoais em risco; curta = perda de prova.
- **Recomendação**: valores por omissão definidos com aconselhamento jurídico; auditoria append-only sem conteúdo pessoal desnecessário.
- **Decisão necessária**: prazos e quem os aprova.

### Q6. Ambiente de staging e prova de isolamento
- **Opções**: (a) usar `weddy-premium-teste` após auditoria completa (§12); (b) criar projeto novo dedicado à Planning.
- **Prós/contras**: (a) mais rápido, mas pode ter dados/segredos partilhados; (b) isolamento garantido, mais configuração.
- **Recomendação**: auditar (a) por leitura; se houver qualquer partilha com produção, (b).
- **Decisão necessária**: projeto de staging e quem executa a verificação.

### Q7. Estratégia de enforcement do App Check
- **Opções**: (a) enforcement nas callables da Planning desde o início + Firestore/Storage após medição; (b) tudo em monitor até ao lançamento.
- **Recomendação**: (a) (§13). **Riscos**: reCAPTCHA e RGPD (cookies/IP) — validar juridicamente.
- **Decisão necessária**: aprovar (a) e a análise RGPD do reCAPTCHA.

### Q8. Operações do planner por secção
- **Problema**: "Consultar e editar" pode ser demasiado amplo (ex.: apagar convidados).
- **Opções**: (a) editar = todas as operações; (b) editar sem apagar (apagar exige confirmação do casal); (c) operações finas por secção.
- **Recomendação**: (b) na Fase 1E; tabela por secção no Doc. 4 §M4a como proposta.
- **Decisão necessária**: aprovar a tabela por secção e as secções sempre privadas.

### R0b. Tornar `creatorEmail` obrigatório na criação — [Questão pendente], separada da R0
- **Problema**: um cliente manipulado ainda pode criar um casamento **sem** `creatorEmail` (fica sem raiz; com a R0 nunca a ganha).
- **Evidência**: a regra de criação exige `creators/{uid}` desde 05/10/2026; todas as versões da app que o escrevem já gravam `creatorEmail` (desde 10/09/2026) [inferência]; a versão iOS publicada não foi verificada.
- **Decisão necessária**: depois de confirmar a versão iOS publicada, decidir se a regra de criação passa a exigir `creatorEmail`. Não misturar com a R0.

### Outras questões (já registadas antes)
Revogação de um utilizador pelo casal (§10); contas Apple com email privado (§8); FCM (§14); tecnologia de componentes já decidida (React + Vite + shadcn/ui).
