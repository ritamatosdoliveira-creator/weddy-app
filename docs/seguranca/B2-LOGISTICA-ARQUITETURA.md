# B.2 — Gestão integrada da logística dos convidados: auditoria e arquitetura

Estado: auditoria concluída; implementação local por etapas na branch `v325-import-guests` (sem deploy/push/merge).

## 1. Auditoria do que já existe
| Área | Situação atual | Consequência |
|---|---|---|
| Resposta do convidado | `guests/{token}` (documento público por link). Individual: campos no topo (`attending`, `rsvpStatus`, `meal`, `dietary`, `transporte`, `alojamento`, `children[]`). Família: `responses.{rsvpMemberId}` com os mesmos campos, **por pessoa**. | Já existe uma estrutura **por pessoa**. É nela que a logística deve viver. |
| `dietary` | Texto livre (≤500 no cliente, ≤1000 nas regras) que mistura alergias, intolerâncias e preferências. | Não distingue alergia de preferência. Mantém-se (dados antigos) e passa a ser a "nota livre". |
| `transporte` / `alojamento` | Booleanos sem detalhes. Contados em "Respostas" (`transporteCount`, `alojamentoCount`). | Continuam a ser a **única** fonte do "precisa". Os detalhes vão para `logistics`, nunca repetem o booleano. |
| `children` | Lista `{name, age, attending}` por pessoa. | Reutilizada; só se acrescentam dois sinalizadores opcionais por criança (`highchair`, `kidsMeal`). |
| Regras `guests` | Sem sessão só se podem alterar `attending, rsvpStatus, meal, dietary, transporte, alojamento, children, responses, openedAt, respondedAt`, com tipos e tamanhos validados. | Acrescenta-se `logistics` à lista, com validação; `responses` (família) valida tamanho do mapa. |
| Casal: Respostas | `viewRSVPRespostas`: contagens de transporte/alojamento, crianças e extras por linha. | Evolui para a área "Logística" ligada a esta lista. |
| Estado do casamento | `state.guests.<lado>.<categoria>[]` (entradas com `guestId` permanente e `rsvpToken`). `STATE_SHAPE` só fixa os blocos de topo; as entradas são livres. | O **acompanhamento do casal** (organizado / por organizar) guarda-se na própria entrada do convidado, sem novo bloco de topo. |
| Mesas | `state.seating.assignments["t{id}-s{n}"] = guestId`. Seletor de lugar em `viewMesas`. | Só leitura/sugestão: chips de necessidades no seletor; nunca altera lugares. |
| Weddy Concierge (rsvp.html) | Responde por regras sobre o documento **do próprio convidado** (inclui `guestTransportInfo`, `guestAccommodationInfo`, `guestParkingInfo`, FAQ). A IA só vê o texto da pergunta. | O Concierge só pode usar o que o casal publicou em `guest*Info` e a resposta **do próprio** convidado. Nada de dados de terceiros chega ao documento. |
| Wedding Health / Notificações | `computeHealthAreas`; `ntCollect` com limites diários e preferências. | Uma verificação nova ("logística por organizar") e um único candidato de notificação agregado. |
| Dados antigos | Muitos convites só têm os campos antigos. | `logistics` é opcional; sem ele tudo funciona como hoje. Nada é migrado. |

Campos duplicados identificados e **evitados**: `transporte`/`alojamento` (booleanos) vs. "precisa de transporte" no novo bloco; `dietary` vs. alergias. Solução: o booleano manda; o texto livre mantém-se.

## 2. Modelo de dados (uma estrutura, por pessoa)
Dentro da resposta de cada pessoa (topo do documento no convite individual; `responses.{id}` na família) acrescenta-se **um** objeto opcional:
```
logistics: {
  v: 1,
  transport: { from: string≤120, people: int 1–20, pref: 'ida'|'volta'|'ida-volta'|'', notes: string≤200 },   // só faz sentido com transporte=true
  lodging:   { nights: int 1–30, arrive: 'AAAA-MM-DD'|'', depart: 'AAAA-MM-DD'|'', people: int 1–20, notes: string≤200 }, // só com alojamento=true
  food:      { allergies: string[≤10 × ≤60], intolerances: string[≤10 × ≤60], diets: código[]≤8, pref: string≤200 },
  access:    { mobility: bool, assistance: bool, other: string≤200 }
}
```
- Vazio = ausente. Quem responde "não vou" ou não preenche não grava nada.
- Alergias e intolerâncias são listas **separadas** das dietas e preferências (`diets` = vegetariano, vegano, sem glúten, sem lactose, halal, kosher; `pref` = gostos). O texto antigo `dietary` fica como "nota livre / resposta anterior".
- Crianças: `children[i]` ganha `highchair?: bool` e `kidsMeal?: bool` (opcionais). Idade continua só quando o convidado a indica.
- Nada de datas de nascimento, moradas completas, contactos de terceiros nem dados de saúde para além do necessário para a organização (um sinalizador de mobilidade/assistência e uma nota curta; nunca diagnósticos).

**Acompanhamento do casal** (privado, nunca no documento do convidado): na entrada do convidado em `state.guests…`, `logi: { transport: 'todo'|'done'|'na', lodging: 'todo'|'done'|'na', needs: 'todo'|'done'|'na', group: string≤40 }`. Sem este campo = "por organizar". `group` serve para agrupar quem partilha transporte, definido só pelo casal.

## 3. Privacidade e segurança
- O documento `guests/{token}` só é legível por quem tem o link (token impossível de adivinhar) e pelo casal; um convidado nunca vê dados de outro. Em convites de família, quem tem o link vê as respostas **da sua família** (já era assim).
- Minimização: perguntas condicionais; tudo opcional; limites de tamanho nas regras e no cliente; sem imagens, sem serviços externos.
- Alergias e acessibilidade: nunca em emails, notificações push/centro de notificações, resumo por email nem no texto enviado à IA; as notificações usam só contagens ("3 convidados com necessidades por organizar").
- Concierge: só a resposta do próprio convidado e o que o casal publicou (`guest*Info`); testado que o contexto nunca inclui `logistics` de outros.
- Eliminação: apagar/revogar o convite apaga o documento `guests/{token}` (e com ele `logistics`); apagar o convidado remove a entrada com `logi`; `deleteWeddingAccount` já apaga os convites do casamento. Retenção: os dados servem apenas a organização do casamento e desaparecem com a conta/casamento.
- Regras: `logistics` validado no `update` sem sessão (tipos, listas ≤10, textos curtos); o casal continua a poder tudo no seu casamento. Regras **não publicadas** nesta fase.

## 4. Integrações (sem alterar mesas automaticamente)
- **Gestão de convidados:** sub-ecrã "Logística" em Respostas: resumo editorial por necessidade (transporte, alojamento, alimentação com alergias destacadas, acessibilidade, crianças), filtros e detalhe por pessoa; grupos/famílias a organizar em conjunto; marcar "organizado".
- **Mesas:** chips informativos (criança, alergia, acessibilidade) junto de cada convidado no seletor de lugar e uma lista de sugestões ("famílias com crianças", "acessibilidade a considerar") para decisão do casal.
- **Concierge:** o convidado pode perguntar por transporte/alojamento/estacionamento e obtém o que o casal publicou; as suas próprias respostas de logística só são lidas/alteradas com confirmação. Nenhum dado de terceiros.
- **Wedding Health + notificações:** indicador "logística por organizar" (contagem) e um único candidato de notificação agregado, sujeito aos limites diários e às preferências existentes; sem detalhes sensíveis.

## 5. Etapas
1. Modelo + regras + rsvp.html (individual e família). 2. Área do casal. 3. Mesas. 4. Concierge. 5. Health + notificações. 6. Testes (PT/EN, 390 e 1360 px) e relatório.
