# sendRsvpReminders + Autopilot e STOP — desenho e estado

**Estado: desenho. `sendRsvpReminders` e `whatsappWebhook` NÃO foram alterados**, porque o brief exige concluir antes a comparação com os zips de produção (bloqueada: faltam os zips; ver `COMPARACAO-RSVP-WEBHOOK.md`).

## B. Alinhamento com o Autopilot (a implementar após a comparação)
Hoje: envia email a 7/3/1 dias antes de `rsvpDeadline`, máx. 3, só Premium, contadores atualizados depois do envio, sem transação (duas execuções concorrentes podem duplicar).

Desenho:
1. **Configuração:** ler `settings.rsvpAutopilot` com os mesmos limites do cliente (`intervalDays` 2–30, defeito 5; `maxReminders` 1–10, defeito 3), valores inválidos → defeito.
2. **Compatibilidade:** casamento **sem** `rsvpAutopilot` mantém o calendário legado 7/3/1 e máx. 3 (decisão pendente tua; alternativa: aplicar 5/3).
3. **Elegibilidade por convidado:** não respondeu, tem email válido, `reminders < maxReminders`, `agora − lastReminderAt ≥ intervalDays`, prazo não passado.
4. **Idempotência:** antes de enviar, transação que (a) relê o convidado, (b) confirma elegibilidade, (c) cria `rsvpReminderLedger/{weddingId}_{guestId}_{n}` com `tx.create` (falha se já existe) e incrementa o contador. Só envia quem ganhou a reserva; se o SMTP falhar, marca o registo como `failed` e liberta o contador. Semântica: no máximo uma vez.
5. **WhatsApp:** nenhum envio automático; o modo assistido continua a ser ação manual do casal.
6. **Testes (emulador):** limites 2/30 e 1/10, defeitos, respondidos excluídos, limite do casal, sem definições (legado), duas execuções simultâneas (1 envio), falha SMTP liberta, não-Premium, sem consentimento.

## C. STOP — estado atual (testado em `tests/consent/stop-revocation.test.js`: 35 OK, 0 FAIL, 11 GAP)
Já garantido e testado: STOP revoga consentimento `granted` e `pending` no servidor com data e origem (`whatsapp_stop`); repetido é idempotente; mudança de número revoga; `updateGuestPhone` ignora `optedIn:true`; `sendWhatsappRsvpReminder` exige `granted`; sincronização/dados antigos não reativam; nenhuma resposta “SIM” confirma consentimento (`confirmWhatsappConsentByReply` não está ligada).

Lacunas (os 11 GAP), a corrigir **depois** da comparação e com autorização:
- reconhecer mais variantes (Pare, pára, Cancel, QUIT, END, Remover, “não quero receber mais”);
- manter a primeira data `optedOutAt` no espelho JSON em STOP repetido;
- `whatsappInbox` guarda texto/raw/nome do contacto: guardar o mínimo para STOP;
- corrigir o comentário obsoleto “DORMENTE” acima de `handleIncomingWhatsappMessage`.
