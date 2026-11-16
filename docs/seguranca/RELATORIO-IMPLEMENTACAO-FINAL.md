# Weddy — Relatório da implementação final (RSVP Autopilot, consentimento, Premium, contacto)
02/11/2026 · branch local `v325-import-guests` · código = commit `c098cd3` · **sem deploy, push ou merge; sem alterações a dados, segredos ou regras de produção** (a única operação em produção até aqui foi a criação, feita pela Rita, do segredo `OPENAI_API_KEY`).

## 1. Ficheiros alterados (face ao `origin/main`: 72 ficheiros, mas nesta fase)
- `index.js` — `sendRsvpReminders` (modos legado/Autopilot, reserva transacional), STOP (`isWhatsappStopText`, `recordWhatsappOptOut`, `handleIncomingWhatsappMessage`), `sendContactMessage` (repetição na contenção).
- `app/index.html` — Memories e Documentos visíveis sem Premium (aviso + botão), chaves PT/EN.
- `rsvp.html` — mensagem neutra ao convidado quando o álbum não aceita fotos.
- `firestore.rules` — coleção `rsvpReminderSends` só servidor (**não publicada**).
- Testes novos: `tests/rsvp/reminders.test.js`, `tests/contact/concurrency-stress.test.js`, `tests/ui/premium_lapsed.py`; alterados `tests/consent/stop-revocation.test.js`, `tests/run-all.js`, `tests/ui/common.py`.
- Docs: `RSVP-AUTOPILOT-SERVIDOR-DESENHO.md`, `PLANO-PUBLICACAO.md` (etapa 2c), `COMPARACAO-RSVP-WEBHOOK.md` (§5), este relatório.
- Commits desta fase (do mais antigo): `de3293e` Autopilot; `a15aaee` STOP; `e4bb4a6` Premium UI; `bd732b7` docs; `1a5553d` plano; `36cd3f2`, `c2c09d0`, `a0c8b28`, `5dda133`, `c098cd3` contacto/testes. Todos os commits anteriores preservados.

## 2. Diferenças face ao comportamento anterior
| Área | Antes | Agora |
|---|---|---|
| Lembretes, casamento **sem** definições | 7/3/1 dias, máx. 3 | **igual** |
| Lembretes, casamento **com** `rsvpAutopilot` | ignorava as definições | intervalo 2–30 (5), máx. 1–10 (3); só pendentes; prazo não passado |
| Duplicação de lembretes | possível (sem transação) | reserva transacional por casamento+convite+membro+nº; SMTP falhado liberta a reserva; contador só avança depois do SMTP |
| STOP | só 5 palavras; datas reescritas; guardava texto/nome/payload | + Pare, Pára, Cancel, Quit, End, Remover, "não quero receber mais", etc.; 1.ª data preservada; `whatsappInbox` mínimo |
| Sem Premium | Memories/Documentos escondidos (página de venda) | conteúdo antigo visível (ver/apagar) + explicação; novos uploads continuam bloqueados |
| Contacto sob rajada | contenção → "fail-open" → limites contornados | repete; se persistir, limita (lado seguro) |

## 3. Testes
Suite completa (26 suites, 1 343 verificações) — execução 1: **26/26, 0 falhas**. Execução 2: ver nota no fim.
| Tema | Resultado |
|---|---|
| Autopilot legado e novo | `rsvp-reminders`: 66 OK (7/3/1 intacto; intervalos 2/5/30; máximos 1/2/6/10; defeitos e valores inválidos; respondidos; Premium; famílias; dois casamentos na mesma execução; campos nulos) |
| Idempotência | 2, 3 e 5 execuções simultâneas → exatamente 1 email por convidado; SMTP falha → reserva libertada e depois 1 envio; sem duplicação em retry; reserva recente ignora, caducada retoma; contador reparado sem reenviar; nada marcado como enviado antes do SMTP; revalidação se o convidado responde durante a execução |
| Sem WhatsApp | zero pedidos de rede; nada escrito em `whatsappInbox`/`whatsappConsents` pelos lembretes |
| STOP | `stop`: 67 OK, 0 lacunas (consentimento antigo/novo/pendente/revogado, STOP repetido e concorrente, mudança de telefone, reativação sem ação do convidado, "SIM" não reativa, 8+ variantes, falsos positivos, inbox mínimo) |
| Premium | `rules-premium` 72 OK (regras inalteradas); `ui-premium-lapsed` 72 OK (PT/EN, mobile/desktop) |
| Contacto | `contact` 37 OK; `contact-stress` 22 OK |

### Investigação do teste intermitente do `sendContactMessage`
- **Defeito real (corrigido, não só do emulador):** sob rajada, a transação do contador abortava por contenção e o código fazia "fail-open" sem contar — no emulador, 40 pedidos simultâneos de um só IP deixaram passar **40** (devia ser 8). Isto contornava os limites.
- **Correção:** repetir (até 12 vezes, espera aleatória); se a contenção persistir, tratar como "limitado". Só falhas que não são contenção continuam fail-open. A quota devolvida após falha SMTP também repete. **Nenhum limite foi reduzido.**
- **Limitação do emulador:** o emulador devolve `INVALID_ARGUMENT: Transaction is invalid or closed` em vez de `ABORTED` quando uma transação é recusada por contenção; passou a ser tratada como repetível (também é inofensivo em produção).
- **Evidência após a correção:** 10, 20, 40 e 60 pedidos de um IP → exatamente 8 passam (≥12 repetições cada; 30 repetições nos de 10 e 40); 3 IPs entrelaçados → 18; mensagem duplicada 12× → 1 email; falhas SMTP em rajada devolvem a quota exatamente (8 repetições). **Zero** emails a mais, **zero** duplicados.
- **Limitação que permanece (lado seguro):** com 40 IPs diferentes a bater no contador global em simultâneo, numa repetição em 12 só passaram 6 em vez de 30 (recusa legítimos, nunca deixa passar de mais). O teste exige "nunca acima do limite" nesse cenário. Não repeti esse cenário depois de subir as tentativas de 8 para 12.

## 4. Problemas conhecidos
1. Utilizadores do Autopilot vs. servidor: a UI usa 5 dias/3 lembretes como predefinição mesmo sem definições; o servidor mantém 7/3/1 nesses casamentos (como pedido). Não se alterou a UI.
2. No Autopilot só se envia email enquanto o prazo não passou e se o convite tiver prazo.
3. Se o processo morrer entre o SMTP aceitar e o Firestore confirmar, pode haver uma repetição rara após 30 min.
4. Regras Firestore/Storage: **não publicadas**; regras de produção ainda não exportadas por ti; `scripts/auditar-dados-para-regras.js` ainda não corrido.
5. Chave OpenAI: o segredo foi criado com a chave antiga (decisão da Rita); continua exposta nos pacotes antigos até ser rodada.
6. `validateWeddingStateOnWrite` e `STATE_VALIDATE_MODE`: fora do plano (custo por escrita por decidir).
