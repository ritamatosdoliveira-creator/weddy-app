# Matriz de integração E2E

| Fluxo | Origem | Destino | Resultado | Teste | Observações |
|---|---|---|---|---|---|
| Convite → RSVP individual | rsvp.html | guests/{token} | OK | ui-phasec-e2e A | 390/768/1360 |
| RSVP família (membros distintos) | rsvp.html | responses.{id} | OK | ui-phasec-e2e B | só membros alterados |
| Alteração de resposta | rsvp.html | guests | OK | ui-phasec-e2e C | "organizado" reabre |
| Dispositivo desatualizado | rsvp.html | guests | OK | ui-phasec-e2e H2 | não sobrescreve outro dispositivo |
| Recusar / apagar resposta | rsvp.html | guests | OK | e2e D, rules-logistics | apaga `logistics` |
| Remoção convidado/família/revogação | app | guests/entry | OK | e2e D, rules-phasec | sem órfãos |
| Dados → Logística (casal) | guests | área Logística | OK | ui-logistics-couple (47) | totais = listas |
| Dados → Assistente do casal | guests | getDietaryList | OK (corrigido) | ui-logistics-couple | só local |
| Logística → Mesas | guests | etiquetas | OK | ui-logistics-tables (24) | lugares nunca alterados |
| Logística → Concierge | guests | rsvp.html | OK | ui-logistics-concierge (26) | recusa terceiros, sem IA |
| Logística → Health | guests | healthRules | OK | e2e F | ≤120 dias, só contagem |
| Health → Notificações | healthRules | ntGenHealth | OK | ui-logistics-couple | máx. 2 / 4 semanas |
| Logística → Emails/lembretes | guests | servidor | OK | reminders-logistics (10) | não lê `logistics` |
| Segurança de regras | cliente | Firestore | OK | rules-phasec (28) | matriz completa |
| Premium desligado/ligado | app | UI | OK | e2e I | dados preservados |
| Documentos antigos | guests | app | OK | e2e J | sem migração |
| Tokens inválidos / duplo submit | rsvp.html | guests | OK | e2e K | |
