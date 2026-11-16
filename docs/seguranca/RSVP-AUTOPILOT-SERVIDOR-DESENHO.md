# sendRsvpReminders + Autopilot e STOP — implementação (local, não publicada)

Estado: **implementado e testado localmente** na branch `v325-import-guests`. Nada foi publicado.
Base: os zips de produção de `sendRsvpReminders` e `whatsappWebhook` são o mesmo `index.js` (SHA-256 `4e5f5b56…8a15`), idêntico ao local exceto a revogação por STOP — ver `COMPARACAO-RSVP-WEBHOOK.md` §5.

## A. `sendRsvpReminders` (agendada 09:00 Lisboa)
Dois modos, decididos **por casamento**; nada é migrado nem alterado nas definições existentes.

| | Legado (sem `settings.rsvpAutopilot` numérico) | Autopilot (com `intervalDays` e/ou `maxReminders` numéricos) |
|---|---|---|
| Quando envia | 7, 3 e 1 dias antes de `rsvpDeadline` | se ainda não respondeu, prazo não passado, e passou o intervalo desde o último lembrete |
| Máximo por convidado | 3 (fixo) | `maxReminders` (1–10, defeito 3) |
| Intervalo | — | `intervalDays` (2–30, defeito 5), em dias de calendário (UTC) |
| Valores fora de limites | — | voltam ao defeito (mesmos limites do cliente) |
| Quem não recebe | respondeu sim/não, sem email válido, sem Premium | igual |

- Só email. **Nunca** envia WhatsApp; o modo assistido continua a ser ação manual do casal.
- Um casamento com `rsvpAutopilot` de valores não numéricos (ex. texto) conta como "não configurado" (legado): é o que a consulta de descoberta consegue encontrar e evita que fiquem sem lembretes.
- No Autopilot só se envia enquanto o prazo não passou (o texto do email fala do prazo); convites sem prazo não recebem email automático.
- Diferença conhecida: a UI do Autopilot (cliente) usa 5 dias / 3 lembretes como predefinição mesmo sem definições; o servidor, para casamentos sem definições, mantém 7/3/1 como pedido. Não se alterou a UI.

### Idempotência (reserva transacional)
1. Transação: relê o convite, revalida (respondeu? limite? intervalo? email?) e cria `rsvpReminderSends/{hash(casamento, convite, membro, nº)}` com `status:'reserved'`. Uma execução concorrente vê a reserva e ignora.
2. Envio SMTP.
3. Só depois do SMTP confirmar: transação que avança o contador do convidado (`remindersSent`, `lastReminderDay`, `lastReminderAt`) e passa a reserva a `sent`.
4. SMTP falhou → reserva apagada (libertada); o contador não avança; o lembrete volta a poder sair na execução seguinte.
5. Reserva `sent` com contador atrasado → repara o contador, não reenvia. Reserva `reserved` com mais de 30 min (execução morta) → pode ser retomada.
- Limite conhecido: se o processo morrer **depois** de o SMTP aceitar e **antes** de o Firestore confirmar, pode haver uma repetição rara após 30 min (preferida a perder o lembrete). A reserva não guarda email nem nome.
- Coleção nova `rsvpReminderSends`: só servidor (regra `allow read, write: if false` adicionada localmente; regras não publicadas).

## B. WhatsApp — STOP (webhook)
- Reconhece: STOP, PARAR, PARE, PÁRA/PARA (só sozinho ou com acento), CANCEL, CANCELAR, QUIT, END, SAIR, REMOVER/REMOVE, UNSUBSCRIBE, descadastrar, opt-out, "não quero receber/mais", "deixem de enviar", "não me mandem", "do not contact"… com normalização de espaços, maiúsculas, acentos, pontuação e emojis. Falsos positivos só revogam (lado seguro). "Para quando é o casamento?" não revoga.
- Revoga no servidor `granted` e `pending` (data e origem `whatsapp_stop`); repetido é idempotente; a data da **primeira** revogação é preservada também no espelho do `json`.
- `whatsappInbox` guarda só: tipo, id da mensagem, weddingId/guestId (se o número é conhecido), `kind` (`stop`/`message`), data. **Sem** texto, nome, número nem payload bruto.
- Continua sem confirmação automática por "SIM", sem WhatsApp Business API, sem custos.
- Comentários obsoletos ("DORMENTE", "só regista") corrigidos.

## C. Premium (Memories e Documentos)
Regras mantidas (novos uploads exigem Premium; ler/apagar continuam). A UI escondia o conteúdo antigo sem Premium (mostrava a página de venda); agora mostra-o (ver/apagar) com aviso e botão para o Premium; link/QR de envio escondidos sem Premium. O convidado vê uma mensagem neutra se o álbum não aceitar fotos.
