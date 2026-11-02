# Relatório — Fase E: consolidação do Weddy Copilot

Ramo `v325-import-guests` · base de regressão: Fase D (suite 36/36, AI Seating 97, UI AI Seating 80, regras 31).
**Distinção usada em todo o relatório:** implementado · testado · commitado (local) · enviado (push) · publicado.
Nesta fase: tudo **implementado, testado e commitado localmente**; **nada enviado nem publicado**.

## 1. Estado inicial (auditoria)

Arquitetura real encontrada:
- Cliente (`app/index.html`): `classifyCopilotIntent` (regex, sem rede) → `checkCopilotIntentPermission` → `WeddyActions.read/write` → `respondeAssistente` (texto montado só com dados locais). Se nada é reconhecido (UNKNOWN), `AIService.classify` pede uma 2.ª opinião à Cloud Function `classifyWeddyIntent` (Responses API, JSON Schema estrito `{intent,value}`), só para **escolher a intenção**.
- Servidor (`index.js`): `classifyWeddyIntent` deriva o casamento da sessão (`resolveWeddingId`), exige e-mail verificado, `assertPremiumWedding`, quota `checkAndIncrementAiUsage` (60/dia/casamento), `callOpenAI`.

Lacunas encontradas (antes de qualquer alteração):

| # | Achado | Gravidade |
|---|---|---|
| 1 | `checkCopilotIntentPermission` era um stub (`return {allowed:true}`): nenhuma política por intenção, nem sessão, nem Premium em código | P1 |
| 2 | A IA podia sugerir **qualquer** intenção do cliente, incluindo `CREATE_TASK` com `value` livre → escrita sem confirmação a partir de texto não fiável | P1 |
| 3 | Só existia 1 escrita (`createTask`), sem confirmação, sem idempotência, sem reversão se a gravação falhasse (a tarefa ficava no ecrã) | P2 |
| 4 | O contador de quota era incrementado **antes** da chamada à OpenAI: erro 5xx/rede/resposta vazia/JSON inválido gastava quota do casal | P2 |
| 5 | `COUPLE_INTENTS` cobria 19 das 33+ intenções do cliente; a IA não podia sugerir as restantes | P3 |
| 6 | Sem teste nenhum de `classifyWeddyIntent` nem do Copilot do casal | P2 |
| 7 | Cobertura em falta: info do casamento, estado de um convidado, recusas, logística, lugares livres, tarefas em atraso/resumo, contactos de fornecedores, informação em falta, pagamentos em atraso, concluir/reabrir/apagar tarefa, alterar data de pagamento | P3 |
| 8 | `lastCopilotContext` já era só de sessão e reiniciado no logout; chat sem histórico no Firestore (OK) | — |
| 9 | Pedidos de ações proibidas (apagar convidados, marcar pago…) caíam no fallback genérico em vez de recusa clara | P3 |

Capacidades classificadas: **implementadas e funcionais** (todas as leituras antigas, `createTask`, contexto de sessão), **parciais** (permissões, IA→intenção), **planeadas/inexistentes** (as escritas e leituras acima).

## 2. Implementado

**Permissões (cliente).** `COPILOT_POLICY` com L1–L4 e `checkCopilotIntentPermission` real: intenção conhecida; L4 nunca; origem IA só leitura ou `CREATE_TASK` com confirmação; Premium (`hasActiveSubscription`) e sessão/casamento/primeira sincronização para escritas. Mensagens próprias por motivo.

**Execução segura.** Ação pendente em memória `{id,tipo,parâmetros,criada,casamento,utilizador,usada}`: uso único, expira 5 min, só vale para a mensagem imediatamente anterior, tem de ser do mesmo casamento e utilizador, e é **revalidada** (a tarefa/fornecedor tem de continuar igual). Trinco `copilotExecuting` impede duas escritas simultâneas. Se a gravação (`pushRemoteImmediate`) falhar, o estado local é revertido e a resposta diz que **não** gravou. Atalhos "Sim/Não" no chat (mesmo estilo dos chips) só aparecem com ação pendente.

**Novas escritas:** concluir/reabrir tarefa (L2), apagar tarefa (L3, confirmação), alterar a data do próximo pagamento de um fornecedor (L3, mostra atual → nova; só a data muda). **Recusadas (L4, encaminhadas):** apagar convidados/fornecedores/mesas, marcar pago, aplicar propostas de mesas, mover convidados, enviar mensagens, outro casamento, ativar/cancelar Premium.

**Novas leituras (L1, locais):** info do casamento, estado de um convidado, recusas, logística (contagens; alergias ≠ intolerâncias), lugares livres, tarefas em atraso e resumo, contacto de fornecedor, fornecedores com informação em falta, pagamentos em atraso.

**Servidor.** `COUPLE_INTENTS` +12 intenções **só de leitura** (nenhuma de apagar/pagar/alterar; `CREATE_TASK` mantém-se e o cliente exige confirmação); `refundAiUsage` devolve a quota quando a chamada à OpenAI falha ou não há chave; limite continua 60/dia/casamento.

## 3. Segurança
- A classificação (regex ou IA) nunca é autorização; o código verifica nível, origem, Premium, sessão e casamento — e **volta a verificar** ao confirmar.
- Os parâmetros da IA não são confiados: o `value` só é usado como texto de tarefa (saneado: controlo/espaços, ≤200) e só depois de o casal confirmar o texto exato; intenções fora da política são ignoradas (`__proto__`, `constructor`, objetos, escritas sensíveis, `CONFIRM_PENDING`).
- Autorização de escrita final: as escritas do Copilot usam o mesmo canal que o resto da app (documento do casamento no Firestore, protegido pelas regras de dono; 31 asserções de regras continuam a passar). O Copilot nunca consegue mais do que a sessão do casal.
- Isolamento (10 casos pedidos): leitura e escrita noutro casamento (casamento vem da sessão; `weddingId`/`guestToken` do cliente ignorados), ids forjados (tarefa/fornecedor de outro casamento rejeitados com erros `weddy-*`, 0 gravações), chamada direta de ação sem confirmação, confirmação antiga/de outro casamento/de outro utilizador — todos testados.

## 4. Privacidade
Auditoria do que vai à OpenAI: **apenas** a string da pergunta (≤500) dentro do prompt, mais a lista de intenções. Testado: nenhum nome de convidado, fornecedor, contacto, valor, e-mail, uid ou weddingId viaja; a chave não vai no corpo. Frases reconhecidas pelas regras (a maioria) **nunca** saem do dispositivo. Os cálculos são locais. Histórico do chat só em memória. Texto do utilizador fica numa única linha entre aspas escapadas; o prompt manda tratar instruções embutidas como UNKNOWN.
Limitação: se o casal escrever dados pessoais numa pergunta que as regras não reconhecem, esse texto vai à OpenAI (já coberto pelo consentimento existente, `ensureAIConsent`).

## 5. Custos e limites
Sem novos serviços, dependências ou custos. Quota 60/dia/casamento inalterada, atómica (10 pedidos simultâneos com 5 lugares → exatamente 5 chamadas). Falhas da OpenAI deixam de consumir quota. Consultas locais não chamam a IA (testado: 0 chamadas).

## 6. Limitações conhecidas
1. A confirmação e a ação pendente vivem no cliente (memória). A defesa do servidor é a mesma de toda a app (regras de dono do documento), não um endpoint dedicado "executar ação do Copilot". Mudar isto seria alteração de arquitetura e não foi feita.
2. O estado do casamento é um documento único gravado por inteiro; duas pessoas a editar em simultâneo continuam sujeitas ao comportamento já existente (último a gravar). A revalidação reduz a janela mas não a elimina entre dispositivos.
3. Tarefas não têm id próprio: a identidade é categoria+texto+estado+prazo, revalidada antes de executar; tarefas totalmente idênticas contam como uma (apaga/atualiza a primeira).
4. Não há "marcar pago" nem "aplicar mesas" pelo chat (decisão: L4). Alterar a data é o único pagamento editável.
5. Compare/Memories/Documents/Cake/Stationery/Vows: o Copilot não os controla; responde só ao que existe (documentos, memórias) e não inventa capacidades.
6. Não existe histórico de conversas persistido (decisão de privacidade já existente).
7. Interpretação de linguagem livre depende das regras + 2.ª opinião da IA (só intenção); frases muito originais podem cair no fallback honesto.

## 7. Testes
Novos: `tests/copilot/copilot-classify.test.js` (60 verificações, servidor/emulador, OpenAI simulada) e `tests/ui/copilot.py` (160 verificações, app real). Cobrem A–S do brief: classificação, consultas reais, contexto, ambiguidade, escritas simples/sensíveis, apagar, confirmação antiga, duplo clique, permissões, isolamento, injeção, IA indisponível, Premium, limites, privacidade, dados antigos, PT/EN, regressão, UI 390/768/1360.
Correção durante a fase: o primeiro teste de UI tinha 15 falhas todas do próprio teste (gancho de subscrição expirada, frases EN sobre tarefas PT, abertura do painel); corrigidas e retiradas duas asserções tautológicas.

## 8. Resultado
Suite completa: **38/38 suites passaram** (36 da Fase D + 2 novas: `copilot-classify` 60 verificações, `ui-copilot` 160 verificações). Mantêm-se: AI Seating 97, UI AI Seating 80, regras 31. Nenhum teste removido. Nenhuma falha P0–P2 em aberto.

Condições de conclusão: auditoria feita · política L1–L4 em código · confirmação segura · escritas validadas · isolamento entre casamentos testado · privacidade auditada · Premium e limites testados · UI sem redesign (apenas atalhos Sim/Não com ação pendente) · PT/EN · testes A–S · regressão completa · documentos. **Fase E: concluída (localmente).** Por publicar: ver `CHECKLIST-WEDDY-COPILOT-PUBLICACAO.md`.
