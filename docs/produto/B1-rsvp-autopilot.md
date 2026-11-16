# B.1 — RSVP Autopilot (extensão do Autopilot v1)

Estado: **implementado localmente · testado localmente · commit local (ver git log) · não enviado · não publicado**.

## O que já existia (não foi reconstruído)
Autopilot v1 em modo assistido (`rsvpAutopilotList`, `rsvpAutopilotBucket`, `reminderInfoOf`, `markRemindersSent`, `startRSVPAutopilotReview`): deteta pendentes, classifica atrasado / precisa de lembrete, conta lembretes (`remindersSent`/`lastReminderAt`, também por membro em convites de família), `openedAt` escrito pelo `rsvp.html`; o Copilot e as notificações já o consultam. A Cloud Function `sendRsvpReminders` (email a 7/3/1 dias do prazo) continua como estava.

## O que foi acrescentado (`app/index.html`)
- **Configuração** `weddingSettings.rsvpAutopilot = { intervalDays (2–30, defeito 5), maxReminders (1–10, defeito 3) }`; valores inválidos voltam ao defeito. Guardada só em `settings` do casamento (não é copiada para os convites).
- **Controlo de frequência** em `rsvpAutopilotBucket`: novos estados `resting` (lembrado há menos que o intervalo) e `maxed` (atingiu o máximo). Deixam de ser sugeridos → sem mensagens repetitivas. Os consumidores existentes (Copilot, botão "Preparar lembrete", notificações) só olham para `late`/`due`, por isso respeitam isto automaticamente.
- **`rsvpAutopilotInsights()`**: 
  - estados por pessoa: sem link · link por abrir · aberto sem resposta · respondeu (**nunca** assume que link gerado/lembrete preparado = recebido);
  - agrupamento familiar (um convite de família = um grupo);
  - **precisam de intervenção**: sem telefone nem email, lembretes esgotados sem resposta, convite nunca aberto com prazo ≤ 7 dias, sem link com prazo ≤ 14 dias;
  - **recuperação**: de quem tem lembrete preparado, quantos responderam depois do último (`respondedAt > lastReminderAt`) — formulado como "lembretes preparados por ti; a Weddy não sabe se foram vistos".
- **Ecrã** Definições → RSVP → Lembretes: três cartões novos (Acompanhamento, Precisam da tua atenção, Frequência dos lembretes) com os componentes e estilos existentes (`stat-card`, `rsvp-pill`, `list-row`, `rsvp-deadline-save`, Cormorant/Manrope, cores atuais). PT/EN.

## Limites assumidos
- Continua **sem envio automático**: a Weddy prepara, o casal revê e envia (o mesmo padrão de antes). Sem novos serviços, sem custos.
- "Convite enviado" não existe como estado porque a app não tem prova de envio (o casal copia o link e envia por fora). Mostra-se "com link por abrir", que é o que é verdade.
- A taxa de recuperação é correlacional (resposta depois de um lembrete), não prova causalidade.
- `sendRsvpReminders` (servidor) ainda não lê `rsvpAutopilot`: o intervalo/máximo configurados aplicam-se ao Autopilot da app, não ao email automático a 7/3/1 dias. Alinhar é uma alteração de comportamento em produção → pedir autorização antes.

## Testes
`tests/ui/rsvp_autopilot.py` (59): estados, grupos, buckets, recuperação, intervenção, prazo passado, configuração (defeito, inválidos, limites), dados degenerados, ecrã PT/EN em telemóvel e desktop (sem português no EN, sem scroll horizontal, sem erros JS). Regressão: `npm test` (20 suites).
