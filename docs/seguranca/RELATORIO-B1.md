# Relatório B.1 — RSVP Autopilot no servidor (`sendRsvpReminders`)

Branch `v325-import-guests`. **Tudo local**: nada foi publicado, enviado (push), integrado (merge) nem alterado em produção. Regras Firestore e Storage **não** foram publicadas; `STATE_VALIDATE_MODE` **não** foi ativado; nenhum segredo foi criado, alterado ou lido.

## 1. Alterações no servidor (`index.js`)
- `sendRsvpReminders` (agendada, 09:00 Lisboa) passou a delegar em `runRsvpReminders({nowMs, transporter})`.
- Modo decidido **por casamento**, sem migrar nem alterar definições existentes:
  - **Legado** (sem `settings.rsvpAutopilot` numérico): lembretes a 7, 3 e 1 dias antes do prazo; máximo 3 por convidado.
  - **Autopilot** (`intervalDays` e/ou `maxReminders` numéricos): intervalo 2–30 dias (defeito 5), máximo 1–10 (defeito 3). Valores fora dos limites voltam ao defeito (mesmos limites do cliente).
- Descoberta dos casamentos Autopilot por duas consultas (`settings.rsvpAutopilot.intervalDays >= 0` e `...maxReminders >= 0`); valores não numéricos contam como "não configurado" (legado).
- Regras mantidas: exclui quem já respondeu (sim/não), exige email válido, exige Premium ativo e casamento em estado válido; no Autopilot só envia enquanto o prazo existe e não passou.
- **Só email**: nenhum WhatsApp automático. WhatsApp continua a ser ação manual do casal.
- Coleção nova `rsvpReminderSends` (livro de reservas, só servidor; regra `allow read, write: if false` adicionada ao `firestore.rules` local, **não publicada**).

## 2. Compatibilidade com o legado
| Situação | Comportamento |
|---|---|
| Casamento sem `settings.rsvpAutopilot` | 7/3/1 dias, máximo 3 — exatamente como antes |
| `rsvpAutopilot` com texto / valores inválidos | tratado como legado ou volta aos valores por defeito |
| Casamento Autopilot com prazo passado | não envia (o texto do email fala do prazo) |
| Convidado que já respondeu | nunca recebe |
| Convite de família | contadores por membro (`reminders.{id}.*`), sem tocar nas respostas |
Diferença conhecida (não alterada): a UI usa 5 dias/3 lembretes como predefinição mesmo sem definições; o servidor mantém 7/3/1 para casamentos sem definições, como pedido.

## 3. Idempotência (reserva transacional)
1. Transação: relê o convite, revalida (respondeu? limite? intervalo? email?) e cria `rsvpReminderSends/{rs_<sha256>}` (`reserved`). Uma execução concorrente vê a reserva e ignora.
2. Envio SMTP.
3. **Só depois do SMTP confirmar**: transação que avança `remindersSent`/`lastReminderDay`/`lastReminderAt` e passa a reserva a `sent`.
4. SMTP falhou → reserva libertada, contador não avança, o lembrete volta a poder sair na execução seguinte (sem duplicar).
5. Reserva `sent` com contador atrasado → repara o contador, não reenvia. Reserva `reserved` com mais de 30 min (execução morta) → retomável.
- A reserva não guarda email nem nome.
- Limite conhecido: se o processo morrer depois de o SMTP aceitar e antes de o Firestore confirmar, pode haver uma repetição rara após 30 min (preferida a perder o lembrete).

## 4. Trabalho associado (mesma fase)
- **STOP no WhatsApp**: reconhecimento por normalização (STOP, PARAR, SAIR, CANCELAR, "não quero receber"…), revogação no servidor, idempotente, `whatsappInbox` sem texto/nome/número; "Para quando é o casamento?" não revoga.
- **Proteção do formulário de contacto**: corrigido defeito real (em contenção do Firestore a reserva falhava "aberta" e deixava passar rajadas); passa a repetir com backoff e, se persistir, a limitar (lado seguro).
- **Premium terminado**: Memories e Documentos mostram o conteúdo existente (ver/apagar) com aviso; envio/QR escondidos sem Premium.

## 5. Testes e resultados
- `tests/rsvp/reminders.test.js` (66 verificações): casamentos novos e antigos, várias configurações, respondidos, limites, falha SMTP e libertação, execuções simultâneas, família.
- `tests/consent/stop-revocation.test.js` (67 verificações), `tests/contact/concurrency-stress.test.js`, `tests/ui/premium_lapsed.py` (72), `tests/ui/rsvp_autopilot.py`.
- Suite completa: ver resultado final no relatório B.2 (secção "Suite completa").
