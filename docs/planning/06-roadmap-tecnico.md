# Documento 6 — Roadmap técnico

**Versão 2.2 (16/11/2026)** — regista a decisão Q0 e o pré-requisito P7 (R0). A Fase 1 passa a cinco entregas independentes (1A–1E). Nada está implementado. Legenda: **[Decisão aprovada]**, **[Proposta técnica]**, **[Questão pendente]** (Doc. 3 §16), **[Trabalho futuro]**.

Complexidade: **S** (dias), **M** (1–2 semanas), **L** (3–5 semanas), **XL** (> 5 semanas) para uma pessoa com apoio de IA.

## Critério de conclusão comum a todas as entregas — [Decisão aprovada]

Uma entrega **não** está concluída porque a interface funciona. Cada uma tem os seus próprios testes automatizados (emulador, sem dados reais) de:
1. acesso autorizado; 2. acesso não autorizado; 3. acesso cruzado entre organizações; 4. utilizador removido e suspenso; 5. consentimento revogado; 6. permissão alterada; 7. operações concorrentes; 8. dados antigos em cache ou projeções; 9. regressões na Weddy Couples (as 76 suites existentes — referência 74/76 a 16/11, com as 2 exceções documentadas).

E termina com relatório de testes e aprovação expressa antes da entrega seguinte. Publicação só pelos scripts, nunca nesta sequência sem autorização.

## Pré-requisitos (antes da Fase 1A)

| # | Item | Dono | Estado |
|---|---|---|---|
| P1 | Origem do GitHub Pages (`docs/integracao/D-github-pages.md`): sem isto nada desta branch entra no `main` | Rita | [Questão pendente] |
| P2 | Tecnologia do frontend | Rita | **[Decisão aprovada] React + Vite + shadcn/ui** com tema próprio |
| P3 | Staging verdadeiramente isolado: auditoria por leitura do projeto candidato (Doc. 3 §12) e decisão Q6 | Rita + Claude | [Questão pendente] |
| P4 | Regras Firestore ativas em produção confirmadas por leitura, na base `(default)` (publicação de 10/11/2026 às 11:38), correspondentes ao `firestore.rules` do commit `b12885c` (Doc. 3 §8.1). Código das Cloud Functions publicadas: só os nomes verificados (53 = 53) | Claude + Rita | **[Verificado a 16/11/2026]** (regras) |
| P5 | Decisões Q1–Q8 (Doc. 3 §16) necessárias a cada entrega (ver coluna "Decisões" abaixo) | Rita | [Questão pendente] |
| P6 | Análise RGPD do reCAPTCHA (App Check) | Rita (jurídico) | [Questão pendente] |
| P7 | **R0 publicada** nas regras da Couples (Doc. 3 §8.1), com testes no emulador e a suite completa a passar, **antes** de qualquer anúncio ou disponibilização da Planning. P4 (regras ativas em produção) verificada a 16/11/2026 | Rita (publicação) + Claude (preparação) | [Decisão aprovada]; publicação pendente de procedimento aprovado |

## Fase 1 — Weddy Core e arquitetura SaaS (cinco entregas)

| Entrega | Âmbito | Decisões necessárias | Complexidade |
|---|---|---|---|
| **1A** Fundação de organizações e memberships | Organizações, identidade, memberships, convites internos, estados dos membros (`invited/active/suspended/removed`), estrutura multi-tenant, auditLog, codebase `planning`, shell da app (React + Vite) | P1–P3 | M |
| **1B** RBAC, ABAC e isolamento | Papéis e matriz de permissões; acesso por organização, por casamento e por secção (estrutura); verificação no servidor; Firestore e Storage Rules; App Check nas callables da Planning; testes de isolamento | Q3, Q7 | M |
| **1C** Grants e ligação profissional | Convites planner ↔ casal; relação profissional; **verificação da propriedade real do casamento**; grants; fim da relação; revogação de utilizador; **sem leitura nem edição de dados do casamento** | Q1, Q2 | L |
| **1D** Consentimento e projeção segura | Interface de gestão de permissões na Couples (mínima, isolada); consentimento por secção (`none/read/read_write`, tudo começa em `none`); pedidos de acesso; projeções de leitura por secção; invalidação, reconciliação e revogação imediata | Q3, Q4, Q8 | L |
| **1E** Escrita controlada por secção | Escrita só em secções `read_write`; validação no servidor; `baseRev`; concorrência casal/planner; histórico (`activity`) e auditoria; regressão completa da Couples | Q8 | L |

### 1A — Fundação de organizações e memberships
- **Entregáveis**: coleções `organizations`, `members`, `memberInvites`, `auditLog`; funções de criar organização, convidar/aceitar membro, suspender/reativar/remover; regras com negação por omissão; app Planning com login e seletor de organização; **`relationEndedAt`, histórico de membros só de acrescento, período de transição de 90 dias e readmissão controlada (D2)**.
- **Aceitação**: dois utilizadores em duas organizações não se veem; convite interno de uso único, com validade e revogável; remoção e suspensão efetivas em regras e funções.
- **Testes específicos**: convite expirado/reutilizado/revogado; membro de A tenta ler B; utilizador tenta alterar o próprio papel/estado; remoção concorrente com ação do próprio membro.

### 1B — RBAC, ABAC e isolamento
- **Entregáveis**: matriz de papéis (owner, admin, planner, coordinator, assistant) e permissões por área da organização; helpers de autorização partilhados pelas funções; regras correspondentes; App Check com a estratégia decidida em Q7 (proposta: enforcement nas callables da Planning; Firestore/Storage em monitor).
- **Aceitação**: matriz de autorização do Doc. 3 §11 coberta por testes (cada linha, caso permitido e recusado); nenhuma decisão de segurança só no frontend.
- **Testes específicos**: 2 organizações × 5 papéis × operações; pedidos sem App Check recusados nas callables; IDOR trocando `orgId` no caminho e no corpo do pedido.

### 1C — Grants e ligação profissional
- **Entregáveis**: `planningInvites`; `professionalLinks/{orgId}` com `status`; `grants/{uid}`; **raiz e delegação registada (Doc. 3 §8.1)**; registo de proveniência dos donos (só deteção); aceitação apenas pela raiz ou delegado; fim da relação; revogação de grant; notificações a todos os donos; e-mails de convite com o envio existente (anti-injeção). **Depende de P7 (R0 publicada).**
- **Fora de âmbito**: qualquer leitura ou escrita dos dados do casal.
- **Aceitação**: só a raiz ou um delegado registado associa o casamento; estar em `ownerEmails`, conhecer ID, email ou token não basta; comportamento com várias organizações conforme a decisão Q1 — **a 1C não começa sem essa decisão**.
- **Testes específicos**: ataques A1–A4 da análise Q0 (segundo email do planner acrescentado como dono; duas identidades a confirmarem-se; planner sai e deixa a outra identidade; identidades de outra organização; casamento sem `creatorEmail`; `creators/{uid}` forjado; criador associado); delegação e revogação pela raiz; utilizador não-dono com token válido; dono com token de outro convite; convite expirado/revogado/reutilizado; força bruta (rate limit); casamento já ligado a esta/outra organização; contas Apple com email privado; fim da relação pelo casal e pela organização; Couples intacta após cada caso.

### 1D — Consentimento e projeção segura
- **Entregáveis**: ecrã de permissões do casal (Doc. 7 §4); função de consentimento (só raiz ou delegado, Doc. 3 §8.1); `accessRequests`; projeções conforme a estratégia decidida em Q4 (proposta: por secção, com `sourceRev`); regras de leitura que verificam a autorização atual; invalidação na revogação; reconciliação agendada e a pedido; leitura sensível por função.
- **Aceitação**: nenhuma secção visível sem escolha afirmativa do casal; revogação com efeito imediato mesmo com projeção antiga.
- **Testes específicos**: revogação durante uma leitura; alterações rápidas de permissões (`none→read→none` em < 1 s); trigger atrasada (simulada); trigger falhada (sem projeção); projeção desatualizada após revogação; casal e planner em simultâneo; cache local do planner após `permission-denied`; membro removido com listener aberto.

### 1E — Escrita controlada por secção
- **Entregáveis**: função `planningUpdateSection` com verificação completa, `baseRev`, validação de esquema por secção e operações da tabela M4a (Doc. 4); registo em `activity` e `auditLog`.
- **Aceitação**: escrita só em secções `read_write`; operações do planner por secção conforme a decisão Q8 (proposta: sem eliminação); Couples sem regressões.
- **Testes específicos**: escrita em `read` e `none` recusada; revogação entre leitura e escrita; conflito de `baseRev`; edição simultânea do casal e do planner na mesma chave e em chaves diferentes; tamanho do `json` dentro do limite; `validateWeddingStateOnWrite` aceita as escritas válidas; suite completa da Couples.

### Fase posterior — Verificação assistida (D3)
Processo do Doc. 3 §8.2 (`weddyStaff`, `rootVerifications`, objeção de 7 dias, revogação). **Só depois de parecer RGPD sobre as provas.** Até lá, casamentos sem raiz válida não têm ligação self-service.

## Fases seguintes (inalteradas no âmbito, reordenadas na dependência)

### Fase 2 — Weddy Planning Core · **XL**
Hoje, CRM inicial (leads, pipeline, conversão idempotente), clientes, carteira, calendário, equipa, tarefas, notas internas, templates com prazos relativos. Usa 1A–1E. **Testes**: regras de cada coleção, UI (Playwright), templates.

### Fase 3 — Integração Weddy Couples (experiência completa) · **L**
O núcleo técnico (convites, ligação, consentimento) passou para 1C–1D. Fica aqui: página de aceitação final, ponto de entrada das permissões na Couples, casamento novo criado a partir do convite, mensagens e emails ao casal, revisão de UX. **Testes**: fluxo completo com conta nova e conta existente; Couples sem planner inalterada.

### Fase 4 — Weddy Conversations · **L**
Conversas por casamento e organização, anexos por URL temporário, leitura individual, decisões, exportação PDF/ZIP com checksum, ícone na Couples (exceção autorizada), FCM se aprovado.

### Fase 5 — Gestão profissional avançada · **XL** (sub-fases)
5a Propostas · 5b Contratos + assinatura (integração) · 5c Fornecedores e espaços · 5d Portal de fornecedores · 5e Financeiro + horas · 5f Run sheet + PDFs · 5g Questionários, reuniões e aprovações · 5h Documentos.

### Fase 6 — Weddy Intelligence · **L**
Radar, workflows, assistente com contexto montado no servidor com a autorização atual; testes adversariais de fuga de dados.

### Fase 7 — SaaS comercial e lançamento · **L**
Planos, subscrições, limites no servidor, onboarding, marca do planner, integrações, pilotos.

## Ordem e dependências

```
P1–P7 ─► 1A ─► 1B ─► 1C ─► 1D ─► 1E ─► F2 ─► F3 ─► F4
                                          └──► F5 (sub-fases, após F3) ─► F6 ─► F7
```

## Riscos transversais

| Risco | Mitigação |
|---|---|
| Regressão na Couples | Suite completa antes e depois de cada entrega; alterações na Couples mínimas e isoladas (Doc. 7) |
| Projeções a expor dados revogados | Regras que verificam a autorização atual; invalidação + reconciliação (Doc. 3 §6) |
| Associação indevida de casamentos | Verificação de propriedade no servidor (Doc. 3 §8) |
| Permissões antigas em cache | Sem custom claims para permissões; verificação a cada pedido |
| Staging que afinal toca produção | Auditoria por leitura antes da 1A (Doc. 3 §12) |
| Custo das regras (`get`) | Grants e consentimento por ligação (O(1) por verificação); medir em staging |
| Limite de 900 KB do `json` | A Planning nunca grava dados próprios no `json` |
