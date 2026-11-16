# Matriz do Weddy Copilot — Fase E

Níveis: **L1** leitura · **L2** escrita simples e reversível · **L3** escrita sensível (confirmação explícita ligada à operação) · **L4** recusado e encaminhado.
Testes: `UI` = `tests/ui/copilot.py` (160 verificações), `SRV` = `tests/copilot/copilot-classify.test.js` (60 verificações).
Estado de cada linha: ✅ implementado, testado e commitado localmente; nada publicado.

## Escritas e recusas

| Intenção | Consulta / ação | Permissão | Confirmação | Teste | Resultado |
|---|---|---|---|---|---|
| CREATE_TASK (pedido do casal) | Cria tarefa (categoria `tc3`/1.ª) | L2 | Não (mostra o resultado) | UI E, S, L | ✅ grava com `pushRemoteImmediate`; falha → reverte e diz que falhou |
| CREATE_TASK (sugerida pela IA) | Idem, texto saneado | L2 + origem IA | **Sim** (vê o texto exato) | UI L | ✅ nunca grava sem "sim"; texto vazio → nada |
| COMPLETE_TASK | Marca tarefa como feita | L2 | Não | UI E, I, Q | ✅ idempotente; preserva prazo/hora; registo antigo não ganha campos |
| REOPEN_TASK | Reabre tarefa | L2 | Não | UI E | ✅ idempotente |
| DELETE_TASK | Apaga uma tarefa | L3 | **Sim** | UI G, H, I, K | ✅ uso único, expira em 5 min, revalida, trinco anti-duplo-clique |
| SET_SUPPLIER_PAYMENT_DATE | Muda data do próximo pagamento (só a data) | L3 | **Sim** (mostra atual → nova) | UI F, K | ✅ valida data (2000–2100, calendário real), revalida "data atual", valores intactos |
| CONFIRM_PENDING / CANCEL_PENDING | "sim"/"não" (ou atalhos Sim/Não) | L1 (revalida a ação) | — | UI G, H, I, R | ✅ qualquer outra pergunta invalida a ação pendente |
| UNSUPPORTED_ACTION | Apagar convidados/fornecedores/mesas, marcar pago, aplicar proposta de mesas, mover convidados, enviar mensagens, outro casamento, ativar/cancelar Premium | **L4** | — | UI A, F, R | ✅ recusa e encaminha para o ecrã respetivo; nada executado |

## Consultas (L1, locais, não chamam a IA)

| Intenção | Domínio | Dados | Teste | Resultado |
|---|---|---|---|---|
| GET_WEDDING_INFO | A. Casamento | nomes, data, local, dias em falta | UI B | ✅ novo |
| GET_GUEST_STATUS | B. Convidados/RSVP | estado de UMA pessoa (confirmou/recusou/sem resposta; ambíguo → pergunta) | UI B | ✅ novo |
| GET_DECLINED_GUESTS | B | quem recusou | UI B | ✅ novo |
| GET_PENDING_RSVPS, GET_LATE_RSVPS, GET_RSVPS_NEEDING_REMINDER, GET_RSVP_INFO, GET_GUEST_COUNT | B | existentes | UI S | ✅ regressão |
| GET_LOGISTICS_SUMMARY | C. Logística | transporte, alojamento, alergias ≠ intolerâncias, acessibilidade, crianças, por organizar (só contagens) | UI A, Q | ✅ novo |
| GET_DIETARY_LIST | C | existente (alergias/intolerâncias/dietas) | UI A | ✅ regressão |
| GET_TABLE_AVAILABILITY | D. Mesas | mesas, lugares, ocupados, livres, sem mesa — **não aplica nem altera nada** | UI B | ✅ novo |
| GET_TABLE_COUNT, GET_TABLE_GUESTS, GET_GUEST_TABLE, GET_GUESTS_WITHOUT_TABLE | D | existentes | UI S | ✅ regressão |
| GET_SUPPLIER_CONTACT | E. Fornecedores | contacto guardado; sem contacto → diz que não há (não inventa) | UI B | ✅ novo |
| GET_SUPPLIERS_MISSING_INFO | E | sem contacto / sem valor | UI B | ✅ novo |
| GET_UNCONTRACTED_SUPPLIERS, GET_SUPPLIER_OVERVIEW, GET_SUPPLIER_PAYMENT_INFO, SEARCH_SUPPLIER_CONTRACT, GET_SUPPLIER_BUDGET_MISMATCHES | E/F | existentes | UI S | ✅ regressão |
| GET_BUDGET, GET_REMAINING_PAYMENTS, GET_PAYMENTS_THIS_MONTH | F. Orçamento | existentes (mesmos totais da app) | UI S | ✅ regressão |
| GET_OVERDUE_PAYMENTS | G. Pagamentos | despesas com data vencida e valor em falta, total | UI B | ✅ novo |
| GET_OVERDUE_TASKS, GET_TASK_SUMMARY | H. Tarefas | em atraso; feitas/por fazer/em atraso | UI B | ✅ novo |
| GET_UPCOMING_TASKS | H | existente | UI A | ✅ regressão |
| GET_WEDDING_HEALTH, GET_COUNTDOWN | A | existentes | UI S | ✅ regressão |
| SEARCH_DOCUMENTS, GET_MEMORIES_INFO, GET_HONEYMOON_INFO | I. Premium | só o que existe nos dados; Premium verificado em código | UI J, N | ✅ regressão |

## Camada de permissões (`checkCopilotIntentPermission`)

| Verificação | Onde | Teste |
|---|---|---|
| Intenção conhecida | cliente | UI J |
| Nível da política (L4 nunca) | cliente | UI J |
| Origem IA: só L1 ou CREATE_TASK com confirmação; nunca CONFIRM/CANCEL/apagar/pagamento | cliente | UI J, L |
| Premium ativo/expirado/reativado (em código, não só na UI) | cliente + servidor (`assertPremiumWedding`) | UI J/N, SRV P |
| Sessão e casamento (escritas) | cliente; revalidado ao confirmar | UI J, K |
| Mesmo casamento e mesmo utilizador da preparação | cliente (confirmação) | UI K |
| Casamento derivado da sessão (nunca do cliente) | servidor (`resolveWeddingId`) | SRV M |
| Quota 60/dia por casamento, atómica; falhas não consomem | servidor | SRV L, F |
